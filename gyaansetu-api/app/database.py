from supabase import AsyncClient, acreate_client
from app.config import settings

_client: AsyncClient | None = None


async def init_supabase() -> None:
    """Create the global Supabase AsyncClient on application startup."""
    global _client
    _client = await acreate_client(
        settings.supabase_url,
        settings.supabase_service_role_key,
    )


def get_db() -> AsyncClient:
    """Return the initialized Supabase client; raises if not yet ready."""
    if _client is None:
        raise RuntimeError("Supabase client not initialized. Call init_supabase() first.")
    return _client
