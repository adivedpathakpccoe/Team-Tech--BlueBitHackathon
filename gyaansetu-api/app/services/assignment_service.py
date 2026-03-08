import asyncio
import json
import logging
from uuid import UUID
from textwrap import dedent
import google.generativeai as genai
from supabase import AsyncClient
from app.config import settings
from app.services.base import BaseService
from app.models.assignment import AssignmentCreate
from app.core.exceptions import ExternalServiceError

genai.configure(api_key=settings.gemini_api_key)
_model = genai.GenerativeModel("gemini-2.5-flash")
logger = logging.getLogger(__name__)

# Zero-width character encoding: 0 → ZWSP, 1 → ZWNJ
_ZWSP = "\u200b"
_ZWNJ = "\u200c"

# ── Validation ────────────────────────────────────────────────────────────────

_REQUIRED_FIELDS: dict[str, tuple[str, callable]] = {
    "assignment_text": (
        "A 2–3 sentence academic prompt (>50 chars)",
        lambda v: isinstance(v, str) and len(v.strip()) > 50,
    ),
    "honeypot_phrase": (
        "A 5–20 word phrase that appears verbatim in assignment_text",
        lambda v: isinstance(v, str) and 5 <= len(v.split()) <= 20,
    ),
    "expected_interpretations": (
        "Exactly 3 distinct string interpretations",
        lambda v: (
            isinstance(v, list)
            and len(v) == 3
            and all(isinstance(i, str) and len(i.split()) >= 5 for i in v)
        ),
    ),
    "hidden_trigger_phrase": (
        "A 4–8 word topic-specific phrase NOT in assignment_text",
        lambda v: isinstance(v, str) and 4 <= len(v.split()) <= 8,
    ),
    "wrong_fact_signal": (
        "A plausible but subtly false claim (10–80 chars)",
        lambda v: isinstance(v, str) and 10 <= len(v.strip()) <= 80,
    ),
}

# ── Shared model priming ──────────────────────────────────────────────────────

_JSON_ONLY_PRIME = [
    {"role": "user", "parts": [
        "You are a JSON-only responder. Output raw JSON with no markdown, "
        "no code fences, and no explanatory text — ever."
    ]},
    {"role": "model", "parts": ["Understood. I will output only raw JSON."]},
]

# ── Assignment variant prompt ─────────────────────────────────────────────────

_VARIANT_PROMPT = dedent("""\
    Generate a single assignment variant as a JSON object.

    Topic: {topic}
    Difficulty: {difficulty}

    ─── FIELD SPECIFICATIONS ────────────────────────────────────────────────────

    "assignment_text"  (string)
        • 2–3 complete sentences forming an academic writing prompt.
        • Must ask the student to argue a specific, debatable position.
        • Calibrated to the stated difficulty level.
        • Must contain the honeypot_phrase verbatim (see below).

    "honeypot_phrase"  (string, 5–20 words)
        • A natural-sounding clause or sentence fragment.
        • Must appear word-for-word inside assignment_text.
        • Purpose: if an AI paraphrases the prompt rather than responding
          to it, this phrase should surface in its output.

    "expected_interpretations"  (array of exactly 3 strings)
        • Three distinct, non-overlapping angles a genuine student might take.
        • Each must be a complete sentence of 10–25 words.
        • Must NOT overlap with wording in assignment_text or honeypot_phrase.

    "hidden_trigger_phrase"  (string, 4–8 words)
        • A highly specific, topic-anchored phrase.
        • Must NOT appear in assignment_text — it is injected as a hidden
          steganographic element to test whether AI copies it.
        • BAD example (too generic): "please include this in your response"
        • GOOD example (specific): "the Malthusian ceiling collapsed before 1820"

    "wrong_fact_signal"  (string, 10–80 characters)
        • A plausible-sounding but factually incorrect claim or fabricated
          citation. Subtly wrong — not obviously absurd.
        • An AI reproducing this verbatim signals it is parroting the prompt.

    ─── CONSTRAINTS ─────────────────────────────────────────────────────────────
    • No field may reuse significant phrases from another field.
    • All content must be original and specific to the topic — no filler.
    • Difficulty level must influence vocabulary, cognitive depth, and scope.

    ─── OUTPUT FORMAT ───────────────────────────────────────────────────────────
    Return ONLY this JSON object, no other text:
    {{
      "assignment_text": "...",
      "honeypot_phrase": "...",
      "expected_interpretations": ["...", "...", "..."],
      "hidden_trigger_phrase": "...",
      "wrong_fact_signal": "..."
    }}
""")

# ── Description prompt (teacher-facing, no honeypot) ─────────────────────────

_DESC_PROMPT = dedent("""\
    Design a classroom assignment for a teacher to assign to students.

    Topic: {topic}
    Difficulty: {difficulty}

    ─── FIELD SPECIFICATIONS ────────────────────────────────────────────────────

    "topic"  (string, 5–15 words)
        • A refined, specific academic title. Clear, scoped, and unambiguous.

    "description"  (string, 3–5 sentences)
        • Detailed instructions telling the student exactly what to do,
          argue, or produce. Include required components and constraints.
        • Academic tone calibrated to the difficulty level.

    "suggested_difficulty"  (one of: "easy", "medium", "hard")
        • Reflect the actual cognitive demand implied by the topic and
          instructions — not necessarily the input difficulty.

    ─── OUTPUT FORMAT ───────────────────────────────────────────────────────────
    Return ONLY this JSON object, no other text:
    {{
      "topic": "...",
      "description": "...",
      "suggested_difficulty": "easy" | "medium" | "hard"
    }}
""")

# ── Helpers ───────────────────────────────────────────────────────────────────

def _encode_zero_width(text: str) -> str:
    """Binary-encode a string using zero-width characters."""
    bits = "".join(format(ord(c), "08b") for c in text)
    return "".join(_ZWSP if b == "0" else _ZWNJ for b in bits)


def _strip_fences(raw: str) -> str:
    """Remove markdown code fences if the model wraps its response anyway."""
    raw = raw.strip()
    if raw.startswith("```"):
        parts = raw.split("```")
        inner = parts[1]
        if inner.lower().startswith("json"):
            inner = inner[4:]
        return inner.strip()
    return raw


def _validate_variant(parsed: dict) -> list[str]:
    """Return validation error messages; empty list means valid."""
    errors: list[str] = []
    for field, (description, rule) in _REQUIRED_FIELDS.items():
        if field not in parsed:
            errors.append(f"Missing field '{field}': {description}")
        elif not rule(parsed[field]):
            errors.append(f"Field '{field}' failed validation — {description}. Got: {parsed[field]!r}")
    return errors


def _check_honeypot_embedded(parsed: dict) -> None:
    """Warn if the honeypot phrase isn't present verbatim in the assignment text."""
    phrase = parsed.get("honeypot_phrase", "").strip()
    text = parsed.get("assignment_text", "")
    if phrase and phrase.lower() not in text.lower():
        logger.warning(
            "honeypot_phrase not found verbatim in assignment_text — "
            "model may have violated the embedding requirement. phrase=%r",
            phrase,
        )


def _check_trigger_not_in_text(parsed: dict) -> None:
    """Warn if the hidden trigger phrase leaked into the assignment text."""
    trigger = parsed.get("hidden_trigger_phrase", "").strip()
    text = parsed.get("assignment_text", "")
    if trigger and trigger.lower() in text.lower():
        logger.warning(
            "hidden_trigger_phrase appears in assignment_text — "
            "it should be injected separately, not embedded. trigger=%r",
            trigger,
        )

# ── Gemini callers ────────────────────────────────────────────────────────────

async def _call_gemini_variant(topic: str, difficulty: str, max_retries: int = 3) -> dict:
    """Call Gemini to generate a full assignment variant with honeypot fields."""
    prompt = _VARIANT_PROMPT.format(topic=topic, difficulty=difficulty)
    last_error: Exception | None = None

    for attempt in range(1, max_retries + 1):
        try:
            response = await _model.generate_content_async(
                _JSON_ONLY_PRIME + [{"role": "user", "parts": [prompt]}]
            )
            raw = _strip_fences(response.text)
            parsed = json.loads(raw)

            errors = _validate_variant(parsed)
            if errors:
                raise ValueError(f"Schema validation failed on attempt {attempt}: {errors}")

            _check_honeypot_embedded(parsed)
            _check_trigger_not_in_text(parsed)
            return parsed

        except (json.JSONDecodeError, ValueError, KeyError) as exc:
            last_error = exc
            logger.warning(
                "Gemini variant attempt %d/%d failed: %s",
                attempt, max_retries, exc,
            )

    raise ExternalServiceError(
        "Gemini",
        f"All {max_retries} variant generation attempts failed. Last error: {last_error}",
    )


async def _call_gemini_description(topic: str, difficulty: str, max_retries: int = 3) -> dict:
    """Call Gemini to generate a teacher-facing assignment description (no honeypot fields)."""
    import asyncio
    prompt = _DESC_PROMPT.format(topic=topic, difficulty=difficulty)
    last_error: Exception | None = None

    for attempt in range(1, max_retries + 1):
        try:
            response = await asyncio.wait_for(
                _model.generate_content_async(
                    _JSON_ONLY_PRIME + [{"role": "user", "parts": [prompt]}]
                ),
                timeout=15.0,
            )
            raw = _strip_fences(response.text)
            parsed = json.loads(raw)

            topic_val = parsed.get("topic", "")
            desc_val = parsed.get("description", "")
            if not isinstance(topic_val, str) or not topic_val.strip():
                raise ValueError("Missing or empty field: 'topic'")
            if not isinstance(desc_val, str) or len(desc_val.strip()) < 30:
                raise ValueError("Field 'description' is too short or missing")
            if parsed.get("suggested_difficulty") not in ("easy", "medium", "hard"):
                raise ValueError(f"Invalid suggested_difficulty: {parsed.get('suggested_difficulty')!r}")

            return parsed

        except (json.JSONDecodeError, ValueError, KeyError, asyncio.TimeoutError) as exc:
            last_error = exc
            logger.warning(
                "Gemini description attempt %d/%d failed: %s",
                attempt, max_retries, exc,
            )

    raise ExternalServiceError(
        "Gemini",
        f"All {max_retries} description generation attempts failed. Last error: {last_error}",
    )

# ── Service ───────────────────────────────────────────────────────────────────

class AssignmentService(BaseService):
    """Service for generating and fetching student assignment variants."""

    table = "assignments"

    def __init__(self, db: AsyncClient):
        super().__init__(db)

    async def generate(self, data: AssignmentCreate) -> dict:
        """Generate a unique assignment variant with honeypot traps and persist it."""
        parsed = await _call_gemini_variant(data.topic, data.difficulty)

        zero_width_encoded_id: str | None = None
        hidden_trigger_phrase: str | None = None
        wrong_fact_signal: str | None = None

        if data.mode == "proactive":
            zero_width_encoded_id = _encode_zero_width(str(data.student_id))
            hidden_trigger_phrase = parsed["hidden_trigger_phrase"]
            wrong_fact_signal = parsed["wrong_fact_signal"]

        return await self.create({
            "student_id": str(data.student_id),
            "assignment_text": parsed["assignment_text"],
            "honeypot_phrase": parsed["honeypot_phrase"],
            "expected_interpretations": parsed["expected_interpretations"],
            "mode": data.mode,
            "hidden_trigger_phrase": hidden_trigger_phrase,
            "wrong_fact_signal": wrong_fact_signal,
            "zero_width_encoded_id": zero_width_encoded_id,
        })

    async def generate_ai_data(self, topic: str, difficulty: str) -> dict:
        """Generate teacher-facing assignment content (no persistence)."""
        parsed = await _call_gemini_description(topic, difficulty)
        return {
            "topic": parsed["topic"].strip(),
            "description": parsed["description"].strip(),
            "difficulty": parsed["suggested_difficulty"],
        }

    async def create_classroom_assignment(self, classroom_id: UUID, data: dict) -> dict:
        """Create a new classroom-level assignment record."""
        res = await (
            self.db.table("classroom_assignments")
            .insert({**data, "classroom_id": str(classroom_id)})
            .execute()
        )
        return res.data[0]

    async def update_classroom_assignment(self, assignment_id: UUID, data: dict) -> dict:
        """Partially update a classroom-level assignment record."""
        res = await (
            self.db.table("classroom_assignments")
            .update(data)
            .eq("id", str(assignment_id))
            .execute()
        )
        return res.data[0]

    async def list_classroom_assignments(self, classroom_id: UUID) -> list[dict]:
        """List all assignments defined for a specific classroom."""
        res = await (
            self.db.table("classroom_assignments")
            .select("*")
            .eq("classroom_id", str(classroom_id))
            .order("created_at", desc=True)
            .execute()
        )
        return res.data

    async def distribute(self, classroom_assignment_id: UUID, batch_id: UUID) -> dict:
        """Generate unique honeypot variants for every student in a batch and persist them."""
        # 1. Fetch the classroom assignment template
        ca_res = await (
            self.db.table("classroom_assignments")
            .select("*")
            .eq("id", str(classroom_assignment_id))
            .single()
            .execute()
        )
        ca = ca_res.data

        # 2. Fetch all students in the batch
        members_res = await (
            self.db.table("batch_members")
            .select("student_id")
            .eq("batch_id", str(batch_id))
            .execute()
        )
        student_ids = [m["student_id"] for m in members_res.data]

        if not student_ids:
            return {"distributed_to": 0, "assignments": []}

        # 3. Generate a unique variant per student concurrently
        async def _generate_for_student(student_id: str) -> dict:
            parsed = await _call_gemini_variant(ca["topic"], ca["difficulty"])

            record: dict = {
                "classroom_assignment_id": str(classroom_assignment_id),
                "student_id": student_id,
                "assignment_text": parsed["assignment_text"],
                "honeypot_phrase": parsed["honeypot_phrase"] if ca["honeypot_hidden_instruction"] else None,
                "expected_interpretations": parsed["expected_interpretations"],
                "mode": ca["mode"],
            }

            if ca["mode"] == "proactive":
                record["hidden_trigger_phrase"] = parsed["hidden_trigger_phrase"]
                if ca["honeypot_zero_width"]:
                    record["zero_width_encoded_id"] = _encode_zero_width(student_id)
                if ca["honeypot_fake_fact"]:
                    record["wrong_fact_signal"] = parsed["wrong_fact_signal"]

            res = await self.db.table("assignments").insert(record).execute()
            return res.data[0]

        assignments = await asyncio.gather(*[_generate_for_student(sid) for sid in student_ids])
        return {"distributed_to": len(assignments), "assignments": list(assignments)}

    async def get_for_student(self, student_id: UUID) -> dict | None:
        """Fetch the most recent assignment variant for a given student."""
        res = await (
            self.db.table(self.table)
            .select("*")
            .eq("student_id", str(student_id))
            .order("created_at", desc=True)
            .limit(1)
            .maybe_single()
            .execute()
        )
        return res.data