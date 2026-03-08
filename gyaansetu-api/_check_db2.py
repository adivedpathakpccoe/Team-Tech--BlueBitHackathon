import asyncio
from supabase import AsyncClient, acreate_client
from app.config import settings

async def check():
    db = await acreate_client(settings.supabase_url, settings.supabase_service_role_key)

    # Get all batch_members with their batch->classroom info
    res = await (
        db.table("batch_members")
        .select("student_id, batch_id, batches(id, name, classroom_id, classrooms(id, name))")
        .execute()
    )
    print("=== Batch Members with nested joins ===")
    for m in (res.data or []):
        print(f"  student_id={m.get('student_id')}")
        print(f"    batch_id={m.get('batch_id')}")
        batch = m.get('batches')
        print(f"    batches={batch}")
        if batch:
            classroom = batch.get('classrooms')
            print(f"    classroom={classroom}")
        print()

    # Get all classroom_assignments 
    res2 = await db.table("classroom_assignments").select("id, classroom_id, topic").execute()
    print("=== Classroom Assignments ===")
    for a in (res2.data or []):
        print(f"  id={a['id']} classroom_id={a['classroom_id']} topic={a['topic'][:50]}")

    # Get classrooms
    res3 = await db.table("classrooms").select("id, name, teacher_id").execute()
    print("\n=== Classrooms ===")
    for c in (res3.data or []):
        print(f"  id={c['id']} name={c['name']} teacher_id={c['teacher_id']}")

    # Get batches
    res4 = await db.table("batches").select("id, name, classroom_id").execute()
    print("\n=== Batches ===")
    for b in (res4.data or []):
        print(f"  id={b['id']} name={b['name']} classroom_id={b['classroom_id']}")

asyncio.run(check())
