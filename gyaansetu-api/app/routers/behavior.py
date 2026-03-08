from typing import Annotated
from fastapi import APIRouter, Depends
from app.core.deps import CurrentUserDep, DbDep
from app.core.responses import ok
from app.models.submission import BehaviorLogCreate
from app.services.behavior_service import BehaviorService

router = APIRouter()


def get_behavior_service(db: DbDep) -> BehaviorService:
    """Instantiate the BehaviorService with the current DB connection."""
    return BehaviorService(db)


BehaviorServiceDep = Annotated[BehaviorService, Depends(get_behavior_service)]


@router.post("/log", response_model=dict, status_code=201)
async def log_behavior(body: BehaviorLogCreate, _: CurrentUserDep, svc: BehaviorServiceDep, db: DbDep):
    """Persist behavioral telemetry and update the behavior score on the scores table."""
    log = await svc.log(body)
    behavior_score = svc.compute_score(log)

    # Upsert score row
    await db.table("scores").upsert(
        {"submission_id": str(body.submission_id), "behavior_score": behavior_score},
        on_conflict="submission_id",
    ).execute()

    return ok(data={"behavior_score": behavior_score}, message="Behavior logged")
