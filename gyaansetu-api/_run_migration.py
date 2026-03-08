import asyncio
from supabase import AsyncClient, acreate_client
from app.config import settings

async def migrate():
    db = await acreate_client(settings.supabase_url, settings.supabase_service_role_key)
    
    print("Running migration: Add batch_ids column to classroom_assignments...")
    try:
        await db.rpc("exec_sql", {
            "query": "ALTER TABLE public.classroom_assignments ADD COLUMN IF NOT EXISTS batch_ids UUID[] DEFAULT NULL;"
        }).execute()
        print("Migration completed via RPC!")
    except Exception as e:
        print(f"RPC method not available ({e}), trying direct REST...")
        print("Please run the following SQL in Supabase SQL Editor:")
        print("  ALTER TABLE public.classroom_assignments ADD COLUMN IF NOT EXISTS batch_ids UUID[] DEFAULT NULL;")

asyncio.run(migrate())
