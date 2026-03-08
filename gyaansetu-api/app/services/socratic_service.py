import json
from uuid import UUID
import google.generativeai as genai
from supabase import AsyncClient
from app.config import settings
from app.services.base import BaseService
from app.core.exceptions import ExternalServiceError, NotFoundError

genai.configure(api_key=settings.gemini_api_key)
_model = genai.GenerativeModel("gemini-1.5-flash")

_CHALLENGE_PROMPT = """
You are an academic integrity examiner. Read the following student essay and generate ONE probing challenge question that tests whether the student truly understands what they wrote.

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

Return ONLY valid JSON:
{{
  "socratic_score": <float 0-100>,
  "analysis": "One sentence explanation of the score",
  "followup": "An optional follow-up question if the response was weak, or null"
}}
"""


class SocraticService(BaseService):
    """Service for generating and scoring Socratic challenge sessions."""

    table = "socratic_sessions"

    def __init__(self, db: AsyncClient):
        """Bind to the Supabase client."""
        super().__init__(db)

    async def generate_challenge(self, submission_id: UUID, essay_text: str) -> dict:
        """Call Gemini to extract a key claim and generate a challenge question."""
        prompt = _CHALLENGE_PROMPT.format(essay=essay_text)
        try:
            response = await _model.generate_content_async(prompt)
            parsed = json.loads(response.text)
        except Exception as e:
            raise ExternalServiceError("Gemini", str(e))

        record = await self.create({
            "submission_id": str(submission_id),
            "challenge": parsed["challenge"],
        })
        return record

    async def score_response(self, submission_id: UUID, student_response: str) -> dict:
        """Score the student's Socratic response via Gemini and persist the result."""
        session = await self.get_by_field("submission_id", str(submission_id))
        if not session:
            raise NotFoundError("socratic_sessions", submission_id)

        # Fetch the original essay for context
        essay_res = await self.db.table("submissions").select("essay_text").eq("id", str(submission_id)).maybe_single().execute()
        essay_text = essay_res.data["essay_text"] if essay_res.data else ""

        prompt = _SCORE_PROMPT.format(
            essay=essay_text,
            challenge=session["challenge"],
            response=student_response,
        )
        try:
            response = await _model.generate_content_async(prompt)
            parsed = json.loads(response.text)
        except Exception as e:
            raise ExternalServiceError("Gemini", str(e))

        return await self.update(session["id"], {
            "student_response": student_response,
            "socratic_score": parsed["socratic_score"],
            "analysis": parsed["analysis"],
            "followup": parsed.get("followup"),
        })
