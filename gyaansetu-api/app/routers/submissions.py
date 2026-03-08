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


@router.post("", response_model=dict, status_code=201)
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


@router.get("", response_model=dict)
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
    """Return all submissions for a specific assignment (teacher view).

    The ``assignment_id`` can be either:
      • a classroom_assignment ID (template) — we look up all per-student
        variants first, then fetch their submissions, OR
      • a direct per-student assignment ID.
    """
    # 1. Try to find per-student variant IDs linked to this classroom assignment
    variants_res = await db.table("assignments") \
        .select("id") \
        .eq("classroom_assignment_id", str(assignment_id)) \
        .execute()

    variant_ids = [v["id"] for v in (variants_res.data or [])]

    # 2. Fetch submissions — match against variant IDs if any were found,
    #    otherwise fall back to treating assignment_id as a direct match.
    if variant_ids:
        res = await db.table("submissions") \
            .select("*") \
            .in_("assignment_id", variant_ids) \
            .order("created_at", desc=True) \
            .execute()
    else:
        res = await db.table("submissions") \
            .select("*") \
            .eq("assignment_id", str(assignment_id)) \
            .order("created_at", desc=True) \
            .execute()

    submissions = res.data or []

    # Collect unique student IDs and resolve names from Supabase Auth metadata
    student_ids = list({sub["student_id"] for sub in submissions if sub.get("student_id")})
    profiles_map: dict = {}
    for sid in student_ids:
        try:
            user_res = await db.auth.admin.get_user_by_id(sid)
            if user_res and user_res.user:
                name = (user_res.user.user_metadata or {}).get("name")
                profiles_map[sid] = {"full_name": name}
        except Exception:
            profiles_map[sid] = {"full_name": None}

    # Also fetch scores for each submission
    for sub in submissions:
        score_res = await db.table("scores").select("*").eq("submission_id", sub["id"]).maybe_single().execute()
        sub["scores"] = score_res.data if score_res.data else {}
        profile = profiles_map.get(sub.get("student_id"), {})
        sub["profiles"] = {"full_name": profile.get("full_name")} if profile else {"full_name": None}

    return ok(data=submissions)


@router.get("/{submission_id}", response_model=dict)
async def get_submission(submission_id: UUID, _: CurrentUserDep, svc: SubmissionServiceDep):
    """Fetch a single submission by ID."""
    result = await svc.get_by_id(submission_id)
    return ok(data=result)


@router.get("/{submission_id}/replay", response_model=dict)
async def get_submission_replay(submission_id: UUID, _: CurrentUserDep, db: DbDep):
    """Fetch the WritingDNA replay log for a specific submission (teacher view).

    Primary source: the replay_log JSON blob stored on the submission.
    Fallback: reconstruct from the submission_snapshots table (used when the
    student's session was interrupted before the final JSON was serialised).
    """
    import json

    res = await db.table("submissions").select("replay_log").eq("id", str(submission_id)).maybe_single().execute()

    # ── Primary: full replay_log JSON stored at submission time ──────────────
    if res.data and res.data.get("replay_log"):
        try:
            log_obj = json.loads(res.data["replay_log"])
            return ok(data=log_obj)
        except Exception:
            pass  # fall through to snapshot reconstruction

    # ── Fallback: reconstruct from the incremental snapshot table ────────────
    snaps_res = await db.table("submission_snapshots") \
        .select("t, code") \
        .eq("submission_id", str(submission_id)) \
        .order("t") \
        .execute()

    if snaps_res.data:
        snapshots = snaps_res.data  # list of {t, code}
        log_obj = {
            "snapshots": snapshots,
            "events": [],
            "pastes": [],
            "tabSwitches": 0,
            "totalDuration": max(s["t"] for s in snapshots),
            "idleTime": 0,
        }
        return ok(data=log_obj)

    return ok(data=None)
