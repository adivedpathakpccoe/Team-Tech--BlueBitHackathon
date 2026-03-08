import asyncio
from uuid import UUID
from supabase import AsyncClient, acreate_client
from app.config import settings
from app.services.classroom_service import ClassroomService

async def test():
    db = await acreate_client(settings.supabase_url, settings.supabase_service_role_key)
    svc = ClassroomService(db)

    # Student ID from the DB data
    student_id = UUID("32aad286-ab06-4a36-b342-ba8a5a6e5915")
    classroom_id = UUID("be0f302a-9725-4659-90d7-57d10c635463")

    print("=== Testing get_enrolled_batches ===")
    try:
        batches = await svc.get_enrolled_batches(student_id)
        print(f"Enrolled batches: {batches}")
    except Exception as e:
        print(f"ERROR in get_enrolled_batches: {type(e).__name__}: {e}")

    print("\n=== Testing get_classroom_assignments_for_student ===")
    try:
        assignments = await svc.get_classroom_assignments_for_student(student_id, classroom_id)
        print(f"Assignments count: {len(assignments)}")
        for a in assignments:
            print(f"  id={a['id']} topic={a['topic'][:50]}")
    except Exception as e:
        print(f"ERROR in get_classroom_assignments_for_student: {type(e).__name__}: {e}")

asyncio.run(test())
