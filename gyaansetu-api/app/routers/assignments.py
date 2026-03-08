from uuid import UUID
from typing import Annotated
from fastapi import APIRouter, Depends
from app.core.deps import DbDep, TeacherDep
from app.core.responses import ok
from app.models.assignment import AssignmentCreate
from app.services.assignment_service import AssignmentService

router = APIRouter()


def get_assignment_service(db: DbDep) -> AssignmentService:
    """Instantiate the AssignmentService with the current DB connection."""
    return AssignmentService(db)


AssignmentServiceDep = Annotated[AssignmentService, Depends(get_assignment_service)]


@router.post("/generate", response_model=dict, status_code=201)
async def generate_assignment(body: AssignmentCreate, _: TeacherDep, svc: AssignmentServiceDep):
    """Generate a unique assignment variant via Gemini and persist it."""
    result = await svc.generate(body)
    return ok(data=result, message="Assignment generated")


@router.get("/{student_id}", response_model=dict)
async def get_assignment(student_id: UUID, svc: AssignmentServiceDep):
    """Fetch the most recent assignment variant for a given student."""
    result = await svc.get_for_student(student_id)
    return ok(data=result)
