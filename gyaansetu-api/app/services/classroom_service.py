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
        return res.data or []

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
            .select("*, batch_members(count)")
            .eq("classroom_id", str(classroom_id))
            .order("created_at", desc=False)
            .execute()
        )
        batches = []
        for batch in (res.data or []):
            members = batch.pop("batch_members", [])
            batch["member_count"] = members[0]["count"] if members else 0
            batches.append(batch)
        return batches

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
        """Return all batches a student is enrolled in, with classroom info.

        Uses flat queries instead of nested PostgREST joins to avoid
        intermittent 500s caused by PostgREST schema-cache refreshes.
        """
        # 1. Student's batch memberships
        membership_res = await (
            self.db.table("batch_members")
            .select("batch_id")
            .eq("student_id", str(student_id))
            .execute()
        )
        if not membership_res.data:
            return []

        batch_ids = [m["batch_id"] for m in membership_res.data]

        # 2. Fetch batch rows (id, name, classroom_id) — no nested join
        batches_res = await (
            self.db.table("batches")
            .select("id, name, classroom_id")
            .in_("id", batch_ids)
            .execute()
        )
        if not batches_res.data:
            return []

        # 3. Fetch classroom names in one shot
        classroom_ids = list({b["classroom_id"] for b in batches_res.data})
        classrooms_res = await (
            self.db.table("classrooms")
            .select("id, name")
            .in_("id", classroom_ids)
            .execute()
        )
        classroom_map = {c["id"]: c["name"] for c in (classrooms_res.data or [])}

        return [
            {
                "batch_id": b["id"],
                "batch_name": b["name"],
                "classroom_id": b["classroom_id"],
                "classroom_name": classroom_map.get(b["classroom_id"], ""),
            }
            for b in batches_res.data
        ]

    async def get_classroom_assignments_for_student(self, student_id: UUID, classroom_id: UUID) -> list:
        """Return classroom assignments visible to a student, including submitted status.

        Uses flat queries instead of nested PostgREST joins. Returns an empty
        list (never raises ForbiddenError) so the frontend always gets clean data.
        """
        # 1. Student's batch memberships (all classrooms)
        membership_res = await (
            self.db.table("batch_members")
            .select("batch_id")
            .eq("student_id", str(student_id))
            .execute()
        )
        if not membership_res.data:
            return []

        all_my_batch_ids = {m["batch_id"] for m in membership_res.data}

        # 2. Narrow to batches that belong to THIS classroom
        classroom_batches_res = await (
            self.db.table("batches")
            .select("id")
            .eq("classroom_id", str(classroom_id))
            .in_("id", list(all_my_batch_ids))
            .execute()
        )
        my_batch_ids = {b["id"] for b in (classroom_batches_res.data or [])}

        if not my_batch_ids:
            return []

        # 3. All assignments for this classroom
        assignments_res = await (
            self.db.table("classroom_assignments")
            .select("*")
            .eq("classroom_id", str(classroom_id))
            .order("created_at", desc=True)
            .execute()
        )

        # 4. Filter: batch_ids null/empty → visible to all; otherwise must overlap
        filtered = []
        for ca in (assignments_res.data or []):
            ca_batch_ids = ca.get("batch_ids")
            if not ca_batch_ids:
                filtered.append(ca)
            elif any(str(bid) in my_batch_ids for bid in ca_batch_ids):
                filtered.append(ca)

        if not filtered:
            return []

        # 5. Compute submitted status so the student knows what they've already done
        ca_ids = [str(ca["id"]) for ca in filtered]
        variants_res = await (
            self.db.table("assignments")
            .select("id, classroom_assignment_id")
            .eq("student_id", str(student_id))
            .in_("classroom_assignment_id", ca_ids)
            .execute()
        )
        variant_map = {
            v["classroom_assignment_id"]: v["id"]
            for v in (variants_res.data or [])
        }

        submitted_ca_ids: set = set()
        if variant_map:
            subs_res = await (
                self.db.table("submissions")
                .select("assignment_id")
                .in_("assignment_id", list(variant_map.values()))
                .execute()
            )
            submitted_variant_ids = {s["assignment_id"] for s in (subs_res.data or [])}
            submitted_ca_ids = {
                ca_id
                for ca_id, variant_id in variant_map.items()
                if variant_id in submitted_variant_ids
            }

        for ca in filtered:
            ca["submitted"] = ca["id"] in submitted_ca_ids

        return filtered

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

        classroom_rel = batch_res.data.get("classrooms")
        if not classroom_rel or classroom_rel.get("teacher_id") != str(teacher_id):
            raise ForbiddenError("You do not own the classroom this batch belongs to")

        res = await (
            self.db.table("batch_members")
            .select("*")
            .eq("batch_id", str(batch_id))
            .order("joined_at", desc=False)
            .execute()
        )
        return res.data
