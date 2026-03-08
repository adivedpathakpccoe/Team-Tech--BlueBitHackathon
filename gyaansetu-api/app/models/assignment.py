from typing import Literal
from uuid import UUID
from pydantic import BaseModel
from app.models.base import TimestampedModel


class AssignmentCreate(BaseModel):
    """Request body for generating a new assignment."""
    topic: str
    difficulty: Literal["easy", "medium", "hard"]
    student_id: UUID
    mode: Literal["proactive", "reactive"]


class AssignmentResponse(TimestampedModel):
    """Outbound assignment shape returned to the client."""
    student_id: UUID
    assignment_text: str
    honeypot_phrase: str
    expected_interpretations: list[str]
    mode: Literal["proactive", "reactive"]
    # Honeypot trap fields (proactive mode only)
    hidden_trigger_phrase: str | None = None   # Trap 1: CSS hidden span trigger
    wrong_fact_signal: str | None = None       # Trap 3: substring to look for in submission
    zero_width_encoded_id: str | None = None   # Trap 2: binary-encoded student ID in zero-width chars
