from typing import Annotated
from uuid import UUID
from fastapi import APIRouter, Depends
from app.core.deps import CurrentUserDep, DbDep
from app.core.responses import ok
from app.models.score import SocraticScoreCreate
from app.services.socratic_service import SocraticService
from app.services.detection_service import compute_ownership_score

router = APIRouter()


def get_socratic_service(db: DbDep) -> SocraticService:
    """Instantiate the SocraticService with the current DB connection."""
    return SocraticService(db)


SocraticServiceDep = Annotated[SocraticService, Depends(get_socratic_service)]


@router.post("/challenge", response_model=dict, status_code=201)
async def get_challenge(submission_id: UUID, _: CurrentUserDep, svc: SocraticServiceDep, db: DbDep):
    """Generate and store a Socratic challenge question for the given submission."""
    sub_res = await db.table("submissions").select("essay_text").eq("id", str(submission_id)).maybe_single().execute()
    essay_text = sub_res.data["essay_text"] if sub_res.data else ""
    result = await svc.generate_challenge(submission_id, essay_text)
    return ok(data={"submission_id": submission_id, "challenge": result["challenge"]})


@router.post("/score", response_model=dict)
async def score_response(body: SocraticScoreCreate, _: CurrentUserDep, svc: SocraticServiceDep, db: DbDep):
    """Score the student's Socratic response and update the ownership score."""
    session = await svc.score_response(body.submission_id, body.student_response)
    socratic_score = session["socratic_score"]

    # Fetch existing scores to recompute ownership
    scores_res = await db.table("scores").select("behavior_score, honeypot_score").eq("submission_id", str(body.submission_id)).maybe_single().execute()
    scores_data = scores_res.data or {}
    behavior_score = scores_data.get("behavior_score") or 0.0
    honeypot_score = scores_data.get("honeypot_score") or 0.0
    ownership_score = compute_ownership_score(behavior_score, honeypot_score, socratic_score)

    await db.table("scores").upsert({
        "submission_id": str(body.submission_id),
        "socratic_score": socratic_score,
        "ownership_score": ownership_score,
    }, on_conflict="submission_id").execute()

    return ok(data={
        "socratic_score": socratic_score,
        "ownership_score": ownership_score,
        "analysis": session["analysis"],
        "followup": session.get("followup"),
    })
