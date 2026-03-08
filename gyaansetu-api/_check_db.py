import asyncio
from supabase import AsyncClient, acreate_client
from app.config import settings

async def check():
    db = await acreate_client(settings.supabase_url, settings.supabase_service_role_key)
    # Check classroom_assignments
    try:
        res = await db.table('classroom_assignments').select('*').limit(3).execute()
        print('classroom_assignments query OK, count:', len(res.data or []))
        if res.data:
            print('Columns:', list(res.data[0].keys()))
            for r in res.data:
                print('  Row:', {k: v for k, v in r.items() if k in ['id','topic','classroom_id','batch_ids']})
        else:
            print('No rows found in classroom_assignments')
    except Exception as e:
        print('Error querying classroom_assignments:', e)

    # Check batch_members
    try:
        res2 = await db.table('batch_members').select('*').limit(3).execute()
        print('\nbatch_members count:', len(res2.data or []))
        if res2.data:
            print('  Columns:', list(res2.data[0].keys()))
    except Exception as e:
        print('batch_members Error:', e)

    # Check classrooms
    try:
        res3 = await db.table('classrooms').select('*').limit(3).execute()
        print('\nclassrooms count:', len(res3.data or []))
        if res3.data:
            print('  Columns:', list(res3.data[0].keys()))
    except Exception as e:
        print('classrooms Error:', e)

    # Check batches
    try:
        res4 = await db.table('batches').select('*').limit(3).execute()
        print('\nbatches count:', len(res4.data or []))
        if res4.data:
            print('  Columns:', list(res4.data[0].keys()))
    except Exception as e:
        print('batches Error:', e)

asyncio.run(check())
