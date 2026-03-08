from uuid import UUID
from datetime import datetime
from pydantic import BaseModel
from app.models.base import TimestampedModel


class SubmissionCreate(BaseModel):
    """Request body for submitting an essay (proactive mode)."""
    assignment_id: UUID
    essay_text: str
    replay_log: str | None = None


class SubmissionResponse(TimestampedModel):
    """Outbound submission shape returned to the client."""
    student_id: UUID
    assignment_id: UUID
    essay_text: str
    submitted_at: datetime
    replay_log: str | None = None
    honeypot_score: float | None = None


class BehaviorLogCreate(BaseModel):
    """Behavioral telemetry payload from the writing editor."""
    submission_id: UUID
    typing_events: list[dict]
    paste_events: list[dict]
    largest_paste: int
    tab_switches: int
    idle_time: float


class UploadCreate(BaseModel):
    """Parsed file upload record for reactive mode."""
    submission_id: UUID
    filename: str
    extracted_text: str


class HoneypotFlagsCreate(BaseModel):
    """Honeypot trap evaluation results for a proactive submission."""
    submission_id: UUID
    hidden_phrase_triggered: bool = False   # Trap 1: CSS hidden span phrase found in essay
    wrong_fact_reproduced: bool = False     # Trap 3: fake citation/fact found in essay
    zero_width_id_mismatch: bool = False    # Trap 2: zero-width encoding matches different student
    stance_contradiction: bool = False      # Trap 4: essay contradicts visible instruction


class HoneypotFlagsResponse(HoneypotFlagsCreate):
    """Stored honeypot flags record returned from DB."""
    id: UUID
