from typing import Annotated
from fastapi import APIRouter, Depends
from app.core.deps import TeacherDep, DbDep
from app.core.responses import ok
from app.services.report_service import ReportService

router = APIRouter()


def get_report_service(db: DbDep) -> ReportService:
    """Instantiate the ReportService with the current DB connection."""
    return ReportService(db)


ReportServiceDep = Annotated[ReportService, Depends(get_report_service)]


@router.get("/", response_model=dict)
async def get_dashboard(_: TeacherDep, svc: ReportServiceDep):
    """Return all submissions with ownership scores for the educator dashboard."""
    rows = await svc.get_dashboard()
    return ok(data=rows)
