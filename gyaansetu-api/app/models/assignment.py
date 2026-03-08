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


class ClassroomAssignmentCreate(BaseModel):
    """Request body for creating a classroom-level assignment with granular controls."""
    topic: str
    description: str | None = None
    difficulty: Literal["easy", "medium", "hard"]
    mode: Literal["proactive", "reactive"]
    
    # Granular Detection Controls
    enable_behavioral: bool = True
    enable_socratic: bool = True
    
    # Granular Honeypot Controls
    honeypot_hidden_instruction: bool = True
    honeypot_zero_width: bool = True
    honeypot_fake_fact: bool = True
    honeypot_sentiment_contradiction: bool = False


class ClassroomAssignmentResponse(TimestampedModel):
    """Outbound shape for a classroom assignment."""
    classroom_id: UUID
    topic: str
    description: str | None = None
    difficulty: Literal["easy", "medium", "hard"]
    mode: Literal["proactive", "reactive"]
    
    enable_behavioral: bool
    enable_socratic: bool
    
    honeypot_hidden_instruction: bool
    honeypot_zero_width: bool
    honeypot_fake_fact: bool
    honeypot_sentiment_contradiction: bool


class AssignmentAIGenerateRequest(BaseModel):
    """Request for AI-assisted assignment content generation."""
    topic: str
    difficulty: Literal["easy", "medium", "hard"]
