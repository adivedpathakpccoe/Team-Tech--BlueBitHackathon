from app.config import settings
from supabase import AsyncClient


async def get_user_from_token(token: str, db: AsyncClient) -> dict | None:
    """Verify a Supabase JWT and return the user record, or None if invalid."""
    try:
        res = await db.auth.get_user(token)
        return res.user
    except Exception:
        return None
