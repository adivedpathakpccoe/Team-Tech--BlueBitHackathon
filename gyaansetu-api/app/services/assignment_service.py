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
_model = genai.GenerativeModel("gemini-2.0-flash-lite")
logger = logging.getLogger(__name__)

# Zero-width character encoding: 0 → ZWSP, 1 → ZWNJ
_ZWSP = "\u200b"
_ZWNJ = "\u200c"

# Required fields and their validation rules
_REQUIRED_FIELDS = {
    "assignment_text": lambda v: isinstance(v, str) and len(v) > 50,
    "honeypot_phrase": lambda v: isinstance(v, str) and 5 <= len(v.split()) <= 20,
    "expected_interpretations": lambda v: isinstance(v, list) and len(v) == 3 and all(isinstance(i, str) for i in v),
    "hidden_trigger_phrase": lambda v: isinstance(v, str) and 4 <= len(v.split()) <= 8,
    "wrong_fact_signal": lambda v: isinstance(v, str) and len(v) > 0,
}

_SYSTEM_PROMPT = dedent("""\
    You are an academic content generator. Your output is always valid JSON — no markdown, 
    no code fences, no explanation. Every string value must be original, specific, and 
    non-generic. Never reuse phrases across fields.
""")

_USER_PROMPT_TEMPLATE = dedent("""\
    Generate a unique assignment variant for the following parameters:

    Topic: {topic}
    Difficulty: {difficulty}

    Requirements per field:

    "assignment_text"
      - 2-3 sentences forming a complete academic prompt
      - Must ask the student to argue a specific, debatable stance
      - Must NOT contain any of the phrases used in the other fields below

    "honeypot_phrase"
      - 5-20 words, naturally embedded in the assignment_text above
      - Phrased so that an AI plagiarising the prompt would reproduce it verbatim
      - Must appear word-for-word somewhere inside assignment_text

    "expected_interpretations"
      - Exactly 3 distinct, non-overlapping ways a student could interpret the prompt
      - Each must be a complete sentence, 10-25 words

    "hidden_trigger_phrase"
      - 4-8 words, highly specific to this topic (not a generic phrase)
      - Must NOT appear in assignment_text — it is injected separately as a hidden element
      - Example of BAD (too generic): "please include this in your response"
      - Example of GOOD (specific): "the Malthusian ceiling collapsed before 1820"

    "wrong_fact_signal"
      - A plausible-sounding but factually incorrect claim or fabricated citation
      - Short substring (10-30 words) that an AI fed this prompt would reproduce
      - Must be subtly wrong, not obviously absurd

    Return ONLY this JSON shape:
    {{
      "assignment_text": "...",
      "honeypot_phrase": "...",
      "expected_interpretations": ["...", "...", "..."],
      "hidden_trigger_phrase": "...",
      "wrong_fact_signal": "..."
    }}
""")


def _encode_zero_width(text: str) -> str:
    """Binary-encode a string using zero-width characters."""
    bits = "".join(format(ord(c), "08b") for c in text)
    return "".join(_ZWSP if b == "0" else _ZWNJ for b in bits)


def _strip_fences(raw: str) -> str:
    """Remove markdown code fences if the model wraps its response."""
    raw = raw.strip()
    if raw.startswith("```"):
        parts = raw.split("```")
        # parts[1] is the fenced block; strip leading language tag e.g. 'json\n'
        inner = parts[1]
        if inner.startswith("json"):
            inner = inner[4:]
        return inner.strip()
    return raw


def _validate_parsed(parsed: dict) -> list[str]:
    """Return a list of validation error messages; empty means valid."""
    errors = []
    for field, rule in _REQUIRED_FIELDS.items():
        if field not in parsed:
            errors.append(f"Missing field: {field!r}")
        elif not rule(parsed[field]):
            errors.append(f"Field {field!r} failed validation (value: {parsed[field]!r})")
    return errors


def _validate_honeypot_embedded(parsed: dict) -> None:
    """Warn (don't raise) if the honeypot phrase isn't actually in the assignment text."""
    phrase = parsed.get("honeypot_phrase", "")
    text = parsed.get("assignment_text", "")
    if phrase and phrase.lower() not in text.lower():
        logger.warning(
            "honeypot_phrase not found verbatim in assignment_text — "
            "model may have ignored the embedding requirement. "
            "phrase=%r", phrase
        )


async def _call_gemini(prompt: str, max_retries: int = 2) -> dict:
    """Call Gemini, strip fences, parse JSON, validate, and retry on failure."""
    last_error: Exception | None = None

    for attempt in range(1, max_retries + 1):
        try:
            response = await _model.generate_content_async(
                [
                    {"role": "user", "parts": [_SYSTEM_PROMPT]},
                    {"role": "model", "parts": ["Understood. I will return only valid JSON."]},
                    {"role": "user", "parts": [prompt]},
                ]
            )
            raw = _strip_fences(response.text)
            parsed = json.loads(raw)

            errors = _validate_parsed(parsed)
            if errors:
                raise ValueError(f"Schema validation failed: {errors}")

            _validate_honeypot_embedded(parsed)
            return parsed

        except (json.JSONDecodeError, ValueError, KeyError) as e:
            last_error = e
            logger.warning("Gemini attempt %d/%d failed: %s", attempt, max_retries, e)

    raise ExternalServiceError("Gemini", f"All {max_retries} attempts failed. Last error: {last_error}")


class AssignmentService(BaseService):
    """Service for generating and fetching student assignment variants."""

    table = "assignments"

    def __init__(self, db: AsyncClient):
        super().__init__(db)

    async def generate(self, data: AssignmentCreate) -> dict:
        """Generate a unique assignment variant with honeypot traps and persist it."""
        prompt = _USER_PROMPT_TEMPLATE.format(topic=data.topic, difficulty=data.difficulty)
        parsed = await _call_gemini(prompt)

        zero_width_encoded_id = None
        hidden_trigger_phrase = None
        wrong_fact_signal = None

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
        """Call Gemini to generate assignment content (returns topic, instructions)."""
        prompt = _USER_PROMPT_TEMPLATE.format(topic=topic, difficulty=difficulty)
        parsed = await _call_gemini(prompt)
        return {
            "topic": topic,
            "description": parsed.get("assignment_text", ""),
            "difficulty": difficulty
        }

    async def create_classroom_assignment(self, classroom_id: UUID, data: dict) -> dict:
        """Create a new classroom-level assignment record."""
        # Note: Ideally, this will be in a new table 'classroom_assignments'
        # For simplicity, we assume this table matches the ClassroomAssignmentCreate schema.
        res = await self.db.table("classroom_assignments").insert({
            **data,
            "classroom_id": str(classroom_id)
        }).execute()
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