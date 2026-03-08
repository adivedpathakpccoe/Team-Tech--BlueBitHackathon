from uuid import UUID
from pydantic import BaseModel


class EvidenceItem(BaseModel):
    """Single evidence observation for a submission."""
    label: str
    detail: str


class ReportResponse(BaseModel):
    """Full evidence report for a single submission."""
    submission_id: UUID
    student_id: UUID
    student_name: str
    ownership_score: float | None
    risk_level: str
    behavior_score: float | None
    honeypot_score: float | None
    socratic_score: float | None
    similarity_score: float | None
    evidence: list[EvidenceItem]


class DashboardRow(BaseModel):
    """Single row in the educator dashboard table."""
    student_id: UUID
    student_name: str
    submission_id: UUID
    behavior_score: float | None
    honeypot_score: float | None
    socratic_score: float | None
    similarity_score: float | None
    ownership_score: float | None
    risk_level: str
    mode: str
