import asyncio
from supabase import AsyncClient, acreate_client
from app.config import settings

async def test():
    db = await acreate_client(settings.supabase_url, settings.supabase_service_role_key)

    # Test inserting with batch_ids to see if column exists
    print("=== Test inserting batch_ids into classroom_assignments ===")
    try:
        res = await (
            db.table("classroom_assignments")
            .insert({
                "classroom_id": "be0f302a-9725-4659-90d7-57d10c635463",
                "topic": "TEST DELETE ME",
                "difficulty": "easy",
                "mode": "proactive",
                "batch_ids": None,
            })
            .execute()
        )
        print(f"Insert with batch_ids=None SUCCEEDED: {res.data[0]['id'] if res.data else 'no data'}")
        if res.data:
            # Clean up
            await db.table("classroom_assignments").delete().eq("id", res.data[0]["id"]).execute()
            print("Cleaned up test row")
    except Exception as e:
        print(f"Insert with batch_ids=None FAILED: {type(e).__name__}: {e}")

asyncio.run(test())
