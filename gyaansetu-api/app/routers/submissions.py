from typing import Annotated
from uuid import UUID
from fastapi import APIRouter, Depends, Query
from app.core.deps import CurrentUserDep, DbDep
from app.core.responses import ok, paginated
from app.models.submission import SubmissionCreate
from app.services.submission_service import SubmissionService
from app.services.behavior_service import BehaviorService
from app.services.detection_service import compute_honeypot_score, compute_ownership_score

router = APIRouter()


def get_submission_service(db: DbDep) -> SubmissionService:
    """Instantiate the SubmissionService with the current DB connection."""
    return SubmissionService(db)


SubmissionServiceDep = Annotated[SubmissionService, Depends(get_submission_service)]


@router.post("/", response_model=dict, status_code=201)
async def create_submission(body: SubmissionCreate, current_user: CurrentUserDep, svc: SubmissionServiceDep, db: DbDep):
    """Accept a proactive essay submission and trigger honeypot scoring."""
    student_id = UUID(current_user.id)
    result = await svc.create_submission(body, student_id)
    submission_id = result["id"]

    # Fetch assignment for honeypot data
    assignment_res = await db.table("assignments").select("honeypot_phrase, expected_interpretations").eq("id", str(body.assignment_id)).maybe_single().execute()
    honeypot_score = None
    if assignment_res.data:
        honeypot_score = await compute_honeypot_score(
            body.essay_text,
            assignment_res.data["honeypot_phrase"],
            assignment_res.data["expected_interpretations"],
        )
        await db.table("scores").insert({"submission_id": submission_id, "honeypot_score": honeypot_score}).execute()

    return ok(data={**result, "honeypot_score": honeypot_score}, message="Submission created")


@router.get("/", response_model=dict)
async def list_my_submissions(
    current_user: CurrentUserDep,
    svc: SubmissionServiceDep,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    """Return a paginated list of the authenticated student's submissions."""
    items, total = await svc.get_student_submissions(UUID(current_user.id), page, page_size)
    return paginated(items, total, page, page_size)


@router.get("/assignment/{assignment_id}", response_model=dict)
async def list_assignment_submissions(
    assignment_id: UUID, current_user: CurrentUserDep, db: DbDep
):
    """Return all submissions for a specific assignment (teacher view)."""
    # In a real app, verify current_user is the owner of the classroom
    # For now, we fetch all submissions for this assignment with student info
    res = await db.table("submissions") \
        .select("*, profiles:student_id(full_name)") \
        .eq("assignment_id", str(assignment_id)) \
        .order("submitted_at", desc=True) \
        .execute()
    
    # Also fetch scores for each submission
    submissions = res.data or []
    for sub in submissions:
        score_res = await db.table("scores").select("*").eq("submission_id", sub["id"]).maybe_single().execute()
        sub["scores"] = score_res.data if score_res.data else {}

    return ok(data=submissions)


@router.get("/{submission_id}", response_model=dict)
async def get_submission(submission_id: UUID, _: CurrentUserDep, svc: SubmissionServiceDep):
    """Fetch a single submission by ID."""
    result = await svc.get_by_id(submission_id)
    return ok(data=result)


@router.get("/{submission_id}/replay", response_model=dict)
async def get_submission_replay(submission_id: UUID, _: CurrentUserDep, db: DbDep):
    """Fetch the WritingDNA replay log for a specific submission (teacher view)."""
    res = await db.table("submissions").select("replay_log").eq("id", str(submission_id)).maybe_single().execute()
    if not res.data or not res.data.get("replay_log"):
        return ok(data=None)

    # Return the stringified JSON as a parsed object
    import json
    try:
        log_obj = json.loads(res.data["replay_log"])
        return ok(data=log_obj)
    except:
        return ok(data=None)
