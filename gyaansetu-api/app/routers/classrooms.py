from uuid import UUID
from typing import Annotated
from fastapi import APIRouter, Depends
from app.core.deps import DbDep, TeacherDep, CurrentUserDep
from app.core.responses import ok
from app.models.classroom import ClassroomCreate, BatchCreate, JoinBatchRequest
from app.models.assignment import ClassroomAssignmentCreate, ClassroomAssignmentUpdate
from app.services.classroom_service import ClassroomService
from app.services.assignment_service import AssignmentService

router = APIRouter()


def get_classroom_service(db: DbDep) -> ClassroomService:
    return ClassroomService(db)


ClassroomServiceDep = Annotated[ClassroomService, Depends(get_classroom_service)]


def get_assignment_service(db: DbDep) -> AssignmentService:
    return AssignmentService(db)


AssignmentServiceDep = Annotated[AssignmentService, Depends(get_assignment_service)]


# ------------------------------------------------------------------ #
# Classrooms                                                           #
# ------------------------------------------------------------------ #

@router.post("", response_model=dict, status_code=201)
async def create_classroom(
    body: ClassroomCreate, teacher: TeacherDep, svc: ClassroomServiceDep
):
    """Create a classroom (auto-creates a General batch)."""
    result = await svc.create_classroom(teacher_id=teacher.id, data=body)
    return ok(data=result, message="Classroom created")


@router.get("", response_model=dict)
async def list_classrooms(teacher: TeacherDep, svc: ClassroomServiceDep):
    """List all classrooms owned by the authenticated teacher."""
    result = await svc.list_classrooms(teacher_id=teacher.id)
    return ok(data=result)


@router.get("/{classroom_id}", response_model=dict)
async def get_classroom(
    classroom_id: UUID, teacher: TeacherDep, svc: ClassroomServiceDep
):
    """Get a single classroom owned by the authenticated teacher."""
    result = await svc.get_classroom(classroom_id=classroom_id, teacher_id=teacher.id)
    return ok(data=result)


@router.delete("/{classroom_id}", response_model=dict)
async def delete_classroom(
    classroom_id: UUID, teacher: TeacherDep, svc: ClassroomServiceDep
):
    """Delete a classroom (and cascade its batches) owned by the authenticated teacher."""
    await svc.delete_classroom(classroom_id=classroom_id, teacher_id=teacher.id)
    return ok(message="Classroom deleted")


# ------------------------------------------------------------------ #
# Batches                                                              #
# ------------------------------------------------------------------ #

@router.post("/{classroom_id}/batches", response_model=dict, status_code=201)
async def create_batch(
    classroom_id: UUID,
    body: BatchCreate,
    teacher: TeacherDep,
    svc: ClassroomServiceDep,
):
    """Create a new batch inside a classroom."""
    result = await svc.create_batch(
        classroom_id=classroom_id, teacher_id=teacher.id, data=body
    )
    return ok(data=result, message="Batch created")


@router.get("/{classroom_id}/batches", response_model=dict)
async def list_batches(
    classroom_id: UUID, teacher: TeacherDep, svc: ClassroomServiceDep
):
    """List all batches in a classroom."""
    result = await svc.list_batches(classroom_id=classroom_id, teacher_id=teacher.id)
    return ok(data=result)


# ------------------------------------------------------------------ #
# Batch membership                                                     #
# ------------------------------------------------------------------ #

@router.post("/batches/join", response_model=dict, status_code=201)
async def join_batch(
    body: JoinBatchRequest, current_user: CurrentUserDep, svc: ClassroomServiceDep
):
    """Join a batch using a join code (student-facing)."""
    result = await svc.join_batch(student_id=current_user.id, join_code=body.join_code)
    return ok(data=result, message="Joined batch successfully")


@router.get("/batches/{batch_id}/members", response_model=dict)
async def list_members(
    batch_id: UUID, teacher: TeacherDep, svc: ClassroomServiceDep
):
    """List all members of a batch (teacher-facing)."""
    result = await svc.list_members(batch_id=batch_id, teacher_id=teacher.id)
    return ok(data=result)


# ------------------------------------------------------------------ #
# Assignments                                                        #
# ------------------------------------------------------------------ #

@router.post("/{classroom_id}/assignments", response_model=dict, status_code=201)
async def create_classroom_assignment(
    classroom_id: UUID, body: ClassroomAssignmentCreate, _: TeacherDep, svc: AssignmentServiceDep
):
    """Create a new assignment template for the classroom."""
    result = await svc.create_classroom_assignment(classroom_id, body.model_dump())
    return ok(data=result, message="Assignment created")


@router.get("/{classroom_id}/assignments", response_model=dict)
async def list_classroom_assignments(
    classroom_id: UUID, _: TeacherDep, svc: AssignmentServiceDep
):
    """List all assignment templates in a classroom."""
    result = await svc.list_classroom_assignments(classroom_id)
    return ok(data=result)


@router.patch("/{classroom_id}/assignments/{assignment_id}", response_model=dict)
async def update_classroom_assignment(
    classroom_id: UUID,
    assignment_id: UUID,
    body: ClassroomAssignmentUpdate,
    _: TeacherDep,
    svc: AssignmentServiceDep,
):
    """Partially update an existing classroom assignment."""
    update_data = body.model_dump(exclude_none=True)
    result = await svc.update_classroom_assignment(assignment_id, update_data)
    return ok(data=result, message="Assignment updated")
