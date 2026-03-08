from uuid import UUID
from typing import Annotated
from fastapi import APIRouter, Depends
from app.core.deps import DbDep, CurrentUserDep
from app.core.responses import ok
from app.services.classroom_service import ClassroomService
from app.services.assignment_service import AssignmentService

router = APIRouter()


def get_classroom_service(db: DbDep) -> ClassroomService:
    return ClassroomService(db)


def get_assignment_service(db: DbDep) -> AssignmentService:
    return AssignmentService(db)


ClassroomServiceDep = Annotated[ClassroomService, Depends(get_classroom_service)]
AssignmentServiceDep = Annotated[AssignmentService, Depends(get_assignment_service)]


@router.get("/batches", response_model=dict)
async def get_my_batches(current_user: CurrentUserDep, svc: ClassroomServiceDep):
    """Return all batches the authenticated student is enrolled in."""
    result = await svc.get_enrolled_batches(student_id=current_user.id)
    return ok(data=result)


@router.get("/classrooms/{classroom_id}/assignments", response_model=dict)
async def get_classroom_assignments(
    classroom_id: UUID,
    current_user: CurrentUserDep,
    svc: ClassroomServiceDep,
):
    """Return assignments for a classroom the student is enrolled in."""
    result = await svc.get_classroom_assignments_for_student(
        student_id=current_user.id,
        classroom_id=classroom_id,
    )
    return ok(data=result)


@router.get("/assignments/{classroom_assignment_id}", response_model=dict)
async def get_my_assignment_variant(
    classroom_assignment_id: UUID,
    current_user: CurrentUserDep,
    svc: AssignmentServiceDep,
):
    """Return the student's unique distributed variant for a given classroom assignment."""
    result = await svc.get_student_variant(
        student_id=UUID(current_user.id),
        classroom_assignment_id=classroom_assignment_id,
    )
    return ok(data=result)
