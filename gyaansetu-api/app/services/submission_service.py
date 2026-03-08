from uuid import UUID
from supabase import AsyncClient
from app.services.base import BaseService
from app.models.submission import SubmissionCreate
from app.core.exceptions import ConflictError


class SubmissionService(BaseService):
    """Service for student submission lifecycle management."""

    table = "submissions"

    def __init__(self, db: AsyncClient):
        """Bind to the Supabase client."""
        super().__init__(db)

    async def create_submission(self, data: SubmissionCreate, student_id: UUID) -> dict:
        """Validate and persist a new submission; raises ConflictError on duplicate."""
        duplicate = await self.exists(student_id=str(student_id), assignment_id=str(data.assignment_id))
        if duplicate:
            raise ConflictError("Submission already exists for this assignment")
        return await self.create({
            **data.model_dump(exclude_none=True),
            "student_id": str(student_id),
            "assignment_id": str(data.assignment_id),
        })

    async def get_student_submissions(self, student_id: UUID, page: int, page_size: int) -> tuple[list, int]:
        """Return paginated submissions scoped to a single student."""
        return await self.list_paginated(page, page_size, filters={"student_id": str(student_id)})
