from typing import Annotated
from uuid import UUID
from fastapi import APIRouter, Depends
from app.core.deps import TeacherDep, DbDep
from app.core.responses import ok
from app.services.report_service import ReportService

router = APIRouter()


def get_report_service(db: DbDep) -> ReportService:
    """Instantiate the ReportService with the current DB connection."""
    return ReportService(db)


ReportServiceDep = Annotated[ReportService, Depends(get_report_service)]


@router.get("/{submission_id}", response_model=dict)
async def get_report(submission_id: UUID, _: TeacherDep, svc: ReportServiceDep):
    """Return the full evidence report for a single submission."""
    result = await svc.get_report(submission_id)
    return ok(data=result)
