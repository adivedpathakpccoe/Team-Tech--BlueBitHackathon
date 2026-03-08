import secrets
import string
from uuid import UUID
from supabase import AsyncClient
from app.services.base import BaseService
from app.models.classroom import ClassroomCreate, BatchCreate
from app.core.exceptions import ConflictError, NotFoundError, ForbiddenError

_CODE_ALPHABET = string.ascii_uppercase + string.digits
_CODE_LENGTH = 8


def _generate_join_code() -> str:
    """Generate a random 8-character alphanumeric join code."""
    return "".join(secrets.choice(_CODE_ALPHABET) for _ in range(_CODE_LENGTH))


class ClassroomService(BaseService):
    """Service for managing classrooms and batches."""

    table = "classrooms"

    def __init__(self, db: AsyncClient):
        super().__init__(db)

    # ------------------------------------------------------------------ #
    # Classrooms                                                           #
    # ------------------------------------------------------------------ #

    async def create_classroom(self, teacher_id: UUID, data: ClassroomCreate) -> dict:
        """Create a classroom and auto-create a 'General' batch inside it."""
        if await self.exists(teacher_id=str(teacher_id), name=data.name):
            raise ConflictError(f"Classroom '{data.name}' already exists")

        classroom = await self.create({
            "teacher_id": str(teacher_id),
            "name": data.name,
            "description": data.description,
        })

        await self._create_batch_record(
            classroom_id=classroom["id"],
            name="General",
            description="Default batch",
        )
        return classroom

    async def list_classrooms(self, teacher_id: UUID) -> list:
        """Return all classrooms owned by a teacher."""
        res = await (
            self.db.table("classrooms")
            .select("*")
            .eq("teacher_id", str(teacher_id))
            .order("created_at", desc=False)
            .execute()
        )
        return res.data

    async def get_classroom(self, classroom_id: UUID, teacher_id: UUID) -> dict:
        """Return a classroom, verifying ownership."""
        row = await self.get_by_id(classroom_id)
        if row["teacher_id"] != str(teacher_id):
            raise ForbiddenError("You do not own this classroom")
        return row

    async def delete_classroom(self, classroom_id: UUID, teacher_id: UUID) -> None:
        """Delete a classroom, verifying ownership first."""
        row = await self.get_by_id(classroom_id)
        if row["teacher_id"] != str(teacher_id):
            raise ForbiddenError("You do not own this classroom")
        await self.delete(classroom_id)

    # ------------------------------------------------------------------ #
    # Batches                                                              #
    # ------------------------------------------------------------------ #

    async def create_batch(
        self, classroom_id: UUID, teacher_id: UUID, data: BatchCreate
    ) -> dict:
        """Create a batch inside a classroom the teacher owns."""
        classroom = await self.get_by_id(classroom_id)
        if classroom["teacher_id"] != str(teacher_id):
            raise ForbiddenError("You do not own this classroom")

        duplicate = await (
            self.db.table("batches")
            .select("id", count="exact", head=True)
            .eq("classroom_id", str(classroom_id))
            .eq("name", data.name)
            .execute()
        )
        if (duplicate.count or 0) > 0:
            raise ConflictError(f"Batch '{data.name}' already exists in this classroom")

        return await self._create_batch_record(
            classroom_id=str(classroom_id),
            name=data.name,
            description=data.description,
        )

    async def list_batches(self, classroom_id: UUID, teacher_id: UUID) -> list:
        """Return all batches in a classroom the teacher owns."""
        classroom = await self.get_by_id(classroom_id)
        if classroom["teacher_id"] != str(teacher_id):
            raise ForbiddenError("You do not own this classroom")

        res = await (
            self.db.table("batches")
            .select("*")
            .eq("classroom_id", str(classroom_id))
            .order("created_at", desc=False)
            .execute()
        )
        return res.data

    async def _create_batch_record(
        self, classroom_id: str, name: str, description: str | None
    ) -> dict:
        """Insert a batch row, retrying on join_code collision (extremely rare)."""
        for _ in range(5):
            code = _generate_join_code()
            collision = await (
                self.db.table("batches")
                .select("id", count="exact", head=True)
                .eq("join_code", code)
                .execute()
            )
            if (collision.count or 0) == 0:
                res = await (
                    self.db.table("batches")
                    .insert({
                        "classroom_id": str(classroom_id),
                        "name": name,
                        "description": description,
                        "join_code": code,
                    })                    .execute()
                )
                return res.data[0]
        raise RuntimeError("Failed to generate a unique join code after 5 attempts")

    # ------------------------------------------------------------------ #
    # Batch membership                                                     #
    # ------------------------------------------------------------------ #

    async def join_batch(self, student_id: UUID, join_code: str) -> dict:
        """Add a student to the batch identified by join_code."""
        batch_res = await (
            self.db.table("batches")
            .select("*")
            .eq("join_code", join_code.strip().upper())
            .maybe_single()
            .execute()
        )
        if not batch_res.data:
            raise NotFoundError("batches", join_code)

        batch = batch_res.data
        already = await (
            self.db.table("batch_members")
            .select("id", count="exact", head=True)
            .eq("batch_id", batch["id"])
            .eq("student_id", str(student_id))
            .execute()
        )
        if (already.count or 0) > 0:
            raise ConflictError("You have already joined this batch")

        res = await (
            self.db.table("batch_members")
            .insert({"batch_id": batch["id"], "student_id": str(student_id)})
            .execute()
        )
        return {"membership": res.data[0], "batch": batch}

    async def get_enrolled_batches(self, student_id: UUID) -> list:
        """Return all batches a student is enrolled in, with classroom info."""
        res = await (
            self.db.table("batch_members")
            .select("batch_id, batches(id, name, classroom_id, classrooms(id, name))")
            .eq("student_id", str(student_id))
            .execute()
        )
        result = []
        for m in res.data:
            batch = m["batches"]
            classroom = batch["classrooms"]
            result.append({
                "batch_id": batch["id"],
                "batch_name": batch["name"],
                "classroom_id": classroom["id"],
                "classroom_name": classroom["name"],
            })
        return result

    async def get_classroom_assignments_for_student(self, student_id: UUID, classroom_id: UUID) -> list:
        """Return classroom assignments for a classroom the student is enrolled in."""
        # Verify student is in at least one batch in this classroom
        check = await (
            self.db.table("batch_members")
            .select("batches(classroom_id)", count="exact", head=True)
            .eq("student_id", str(student_id))
            .execute()
        )
        # Fetch all batch classroom_ids the student belongs to
        batches_res = await (
            self.db.table("batch_members")
            .select("batches(classroom_id)")
            .eq("student_id", str(student_id))
            .execute()
        )
        enrolled_classroom_ids = {m["batches"]["classroom_id"] for m in batches_res.data}
        if str(classroom_id) not in enrolled_classroom_ids:
            raise ForbiddenError("Not enrolled in this classroom")

        res = await (
            self.db.table("classroom_assignments")
            .select("*")
            .eq("classroom_id", str(classroom_id))
            .order("created_at", desc=True)
            .execute()
        )
        return res.data

    async def list_members(self, batch_id: UUID, teacher_id: UUID) -> list:
        """Return all members of a batch, verifying the caller owns the parent classroom."""
        batch_res = await (
            self.db.table("batches")
            .select("*, classrooms(teacher_id)")
            .eq("id", str(batch_id))
            .maybe_single()
            .execute()
        )
        if not batch_res.data:
            raise NotFoundError("batches", batch_id)

        if batch_res.data["classrooms"]["teacher_id"] != str(teacher_id):
            raise ForbiddenError("You do not own the classroom this batch belongs to")

        res = await (
            self.db.table("batch_members")
            .select("*")
            .eq("batch_id", str(batch_id))
            .order("joined_at", desc=False)
            .execute()
        )
        return res.data
