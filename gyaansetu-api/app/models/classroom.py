from uuid import UUID
from pydantic import BaseModel
from app.models.base import TimestampedModel


class ClassroomCreate(BaseModel):
    """Request body for creating a new classroom."""
    name: str
    description: str | None = None


class BatchCreate(BaseModel):
    """Request body for creating a new batch inside a classroom."""
    name: str
    description: str | None = None


class JoinBatchRequest(BaseModel):
    """Request body for a student joining a batch via join code."""
    join_code: str


class ClassroomResponse(TimestampedModel):
    """Outbound classroom shape."""
    teacher_id: UUID
    name: str
    description: str | None = None


class BatchResponse(TimestampedModel):
    """Outbound batch shape."""
    classroom_id: UUID
    name: str
    description: str | None = None
    join_code: str


class BatchMemberResponse(TimestampedModel):
    """Outbound batch membership record."""
    batch_id: UUID
    student_id: UUID
