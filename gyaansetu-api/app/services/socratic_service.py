import json
from datetime import datetime, timezone
from uuid import UUID
import google.generativeai as genai
from supabase import AsyncClient
from app.config import settings
from app.services.base import BaseService
from app.core.exceptions import ExternalServiceError, NotFoundError, BusinessLogicError

genai.configure(api_key=settings.gemini_api_key)
_model = genai.GenerativeModel("gemini-1.5-flash")

_CHALLENGE_PROMPT = """
You are an academic integrity examiner. Read the following student essay and generate ONE broad, open-ended question that tests whether the student genuinely understands the overall argument and key ideas of what they wrote. The question should require the student to explain their reasoning or evidence in their own words — not just recite facts.

Essay:
{essay}

Return ONLY valid JSON:
{{"challenge": "Your single challenge question here"}}
"""

_SCORE_PROMPT = """
You are evaluating a student's Socratic response for academic authenticity.

Original Essay:
{essay}

Challenge Question:
{challenge}

Student Response:
{response}

Score the response on:
- depth (understanding beyond surface level)
- consistency (response matches the essay's claims)
- specificity (concrete details, not vague generalities)
- counterargument engagement (acknowledges complexity)

Follow-up rules:
- If socratic_score >= 60, set followup to null. The student has demonstrated sufficient understanding.
- Only generate a followup if socratic_score < 60 AND there is a meaningfully different aspect of the WHOLE essay that remains unprobed.
- The follow-up must probe a different part of the essay than the current question — do not ask about the same point.
{final_note}

Return ONLY valid JSON:
{{
  "socratic_score": <float 0-100>,
  "analysis": "One sentence explanation of the score",
  "followup": null
}}

If a follow-up IS warranted (score < 60, not the final question), use:
{{
  "socratic_score": <float 0-100>,
  "analysis": "One sentence explanation of the score",
  "followup": "A probing question about a DIFFERENT part of the essay"
}}
"""

_FINAL_NOTE = "IMPORTANT: This is the FINAL question. You MUST return null for followup regardless of the score."
_INTERIM_NOTE = ""


def _strip_fences(raw: str) -> str:
    """Remove markdown code fences if the model wraps its response."""
    raw = raw.strip()
    if raw.startswith("```"):
        parts = raw.split("```")
        inner = parts[1]
        if inner.lower().startswith("json"):
            inner = inner[4:]
        return inner.strip()
    return raw


class SocraticService(BaseService):
    """Service for generating and scoring Socratic challenge sessions."""

    table = "socratic_sessions"

    def __init__(self, db: AsyncClient):
        super().__init__(db)

    async def generate_challenge(self, submission_id: UUID, essay_text: str) -> dict:
        """Call Gemini to generate a challenge question and persist the session."""
        prompt = _CHALLENGE_PROMPT.format(essay=essay_text)
        try:
            response = await _model.generate_content_async(prompt)
            raw = _strip_fences(response.text)
            parsed = json.loads(raw)
        except Exception as e:
            raise ExternalServiceError("Gemini", f"Failed to generate challenge: {e}")

        record = await self.create({
            "submission_id": str(submission_id),
            "challenge": parsed["challenge"],
            "started_at": datetime.now(timezone.utc).isoformat(),
        })
        return record

    async def _get_essay(self, submission_id: UUID) -> str:
        """Fetch essay text from submissions or reactive_submissions."""
        try:
            res = await self.db.table("submissions").select("essay_text").eq("id", str(submission_id)).execute()
            if res.data:
                return res.data[0]["essay_text"]
        except Exception:
            pass
        try:
            res = await self.db.table("reactive_submissions").select("extracted_text").eq("id", str(submission_id)).execute()
            if res.data:
                return res.data[0]["extracted_text"]
        except Exception:
            pass
        return ""

    def _check_timer(self, started_at_str: str | None, time_limit: int) -> str:
        """Return a late-submission note if the timer was exceeded."""
        if not started_at_str:
            return ""
        try:
            started = datetime.fromisoformat(started_at_str.replace("Z", "+00:00"))
            elapsed = (datetime.now(timezone.utc) - started).total_seconds()
            if elapsed > (time_limit + 20):
                return f" (Submitted {int(elapsed - time_limit)}s late)"
        except Exception:
            pass
        return ""

    async def score_response(self, submission_id: UUID, student_response: str) -> dict:
        """
        Score the student's response, supporting up to 3 questions (Q1 + 2 follow-ups).
        Returns the updated session with normalised 'followup' (next question or null)
        and 'followup_started_at' for the timer anchor.
        """
        session = await self.get_by_field("submission_id", str(submission_id))
        if not session:
            raise NotFoundError("socratic_sessions", submission_id)

        # ── Determine which question is being answered ────────────────────────
        if not session.get("student_response"):
            question_num = 1
            active_challenge = session["challenge"]
            active_started_at = session.get("started_at")
        elif session.get("followup") and not session.get("followup_response"):
            question_num = 2
            active_challenge = session["followup"]
            active_started_at = session.get("followup_started_at")
        elif session.get("followup2") and not session.get("followup2_response"):
            question_num = 3
            active_challenge = session["followup2"]
            active_started_at = session.get("followup2_started_at")
        else:
            raise BusinessLogicError("Socratic session is already complete")

        time_limit = session.get("time_limit") or 180
        timer_note = self._check_timer(active_started_at, time_limit)
        is_final = question_num >= 3

        # ── Score via Gemini ──────────────────────────────────────────────────
        essay_text = await self._get_essay(submission_id)
        prompt = _SCORE_PROMPT.format(
            essay=essay_text or "No essay text found.",
            challenge=active_challenge,
            response=student_response,
            final_note=_FINAL_NOTE if is_final else _INTERIM_NOTE,
        )
        try:
            response = await _model.generate_content_async(prompt)
            raw = _strip_fences(response.text)
            parsed = json.loads(raw)
        except Exception as e:
            raise ExternalServiceError("Gemini", f"Failed to score response: {e}")

        raw_score = float(parsed["socratic_score"])
        analysis = parsed["analysis"] + timer_note
        next_question = parsed.get("followup") if not is_final else None

        # ── Apply paste penalty (max 20-point deduction) ──────────────────────
        paste_penalty = float(session.get("paste_penalty") or 0)
        penalized_score = max(0.0, raw_score - paste_penalty)

        now = datetime.now(timezone.utc).isoformat()

        # ── Build update dict and compute running average score ───────────────
        update_data: dict = {"analysis": analysis}

        if question_num == 1:
            update_data["student_response"] = student_response
            update_data["socratic_score"] = penalized_score
            update_data["followup"] = next_question
            if next_question:
                update_data["followup_started_at"] = now
            next_started_at = now if next_question else None

        elif question_num == 2:
            update_data["followup_response"] = student_response
            update_data["followup2"] = next_question
            if next_question:
                update_data["followup2_started_at"] = now
            # Average Q1 + Q2
            q1 = float(session.get("socratic_score") or 0)
            update_data["socratic_score"] = (q1 + penalized_score) / 2
            next_started_at = now if next_question else None

        else:  # question_num == 3 — final
            update_data["followup2_response"] = student_response
            # Running average: stored = avg(Q1, Q2); final = (stored*2 + Q3) / 3
            stored = float(session.get("socratic_score") or 0)
            update_data["socratic_score"] = (stored * 2 + penalized_score) / 3
            next_question = None
            next_started_at = None

        updated = await self.update(session["id"], update_data)

        # Normalise return so routers always find "followup" / "followup_started_at"
        updated["followup"] = next_question
        updated["followup_started_at"] = next_started_at
        updated["question_just_answered"] = question_num
        return updated

    async def record_paste_violation(self, submission_id: UUID) -> dict:
        """Increment paste violations and increase the score penalty (5pts each, max 20)."""
        session = await self.get_by_field("submission_id", str(submission_id))
        if not session:
            raise NotFoundError("socratic_sessions", submission_id)

        violations = (session.get("paste_violations") or 0) + 1
        penalty = min(float(violations * 5), 20.0)

        return await self.update(session["id"], {
            "paste_violations": violations,
            "paste_penalty": penalty,
        })
