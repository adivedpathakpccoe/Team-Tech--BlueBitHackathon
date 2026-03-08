from uuid import UUID
from pydantic import BaseModel
from app.models.base import TimestampedModel


class ScoreResponse(TimestampedModel):
    """Outbound scores shape for a submission."""
    submission_id: UUID
    behavior_score: float | None = None
    honeypot_score: float | None = None
    socratic_score: float | None = None
    similarity_score: float | None = None
    ownership_score: float | None = None


class SocraticChallengeResponse(BaseModel):
    """Challenge question generated from a submitted essay."""
    submission_id: UUID
    challenge: str


class SocraticScoreCreate(BaseModel):
    """Student's response to the Socratic challenge."""
    submission_id: UUID
    student_response: str


class SocraticScoreResponse(BaseModel):
    """Scored Socratic session result."""
    submission_id: UUID
    socratic_score: float
    analysis: str
    followup: str | None = None


class HoneypotScoreResult(BaseModel):
    """Output from the string-match honeypot scoring function."""
    submission_id: UUID
    flags_triggered: int          # 0–4 traps triggered
    hidden_phrase_triggered: bool
    wrong_fact_reproduced: bool
    zero_width_id_mismatch: bool
    stance_contradiction: bool
    honeypot_score: float         # 100 - (flags / 4 * 100)
