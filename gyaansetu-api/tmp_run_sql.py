import asyncio
import httpx
from app.config import settings

async def try_run_sql():
    sql = open("supabase/migrations/05_proactive_mode_schema.sql").read()
    
    url = f"{settings.supabase_url}/rest/v1/rpc/run_sql"
    headers = {
        "apikey": settings.supabase_service_role_key,
        "Authorization": f"Bearer {settings.supabase_service_role_key}",
        "Content-Type": "application/json"
    }
    
    async with httpx.AsyncClient() as client:
        try:
            print(f"Attempting to run SQL against {url}...")
            res = await client.post(url, json={"sql": sql}, headers=headers)
            print(f"Status: {res.status_code}")
            print(f"Response: {res.text}")
        except Exception as e:
            print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(try_run_sql())
