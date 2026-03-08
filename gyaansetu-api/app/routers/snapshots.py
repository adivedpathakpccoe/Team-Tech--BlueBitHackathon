from uuid import UUID
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from app.core.deps import CurrentUserDep, DbDep
from app.core.responses import ok

router = APIRouter()


class SnapshotEntry(BaseModel):
    t: int      # ms since session start
    code: str   # full content at this moment


class SnapshotBatchCreate(BaseModel):
    assignment_id: UUID
    snapshots: list[SnapshotEntry]


@router.post("", status_code=201)
async def push_snapshots(
    body: SnapshotBatchCreate,
    current_user: CurrentUserDep,
    db: DbDep,
):
    """Bulk-insert in-progress snapshots for a student's assignment session.

    Called periodically from the frontend (~every 30s) so replay data is
    preserved even if the student never submits or the page crashes.
    """
    if not body.snapshots:
        return ok(message="No snapshots to save")

    # Verify this assignment belongs to the authenticated student
    res = await db.table("assignments") \
        .select("id") \
        .eq("id", str(body.assignment_id)) \
        .eq("student_id", current_user.id) \
        .maybe_single() \
        .execute()

    if not res.data:
        raise HTTPException(403, "Not authorized to save snapshots for this assignment")

    rows = [
        {
            "assignment_id": str(body.assignment_id),
            "t": s.t,
            "code": s.code,
        }
        for s in body.snapshots
    ]

    await db.table("submission_snapshots").insert(rows).execute()
    return ok(message=f"{len(rows)} snapshots saved")


@router.patch("/link")
async def link_snapshots(
    current_user: CurrentUserDep,
    db: DbDep,
    assignment_id: UUID = Query(...),
    submission_id: UUID = Query(...),
):
    """Back-fill submission_id on all saved snapshots for an assignment session.

    Called immediately after a submission is accepted so the teacher's replay
    endpoint can join through submission_id.
    """
    # Verify ownership
    res = await db.table("assignments") \
        .select("id") \
        .eq("id", str(assignment_id)) \
        .eq("student_id", current_user.id) \
        .maybe_single() \
        .execute()

    if not res.data:
        raise HTTPException(403, "Not authorized")

    await db.table("submission_snapshots") \
        .update({"submission_id": str(submission_id)}) \
        .eq("assignment_id", str(assignment_id)) \
        .is_("submission_id", "null") \
        .execute()

    return ok(message="Snapshots linked to submission")
