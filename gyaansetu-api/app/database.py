from supabase import AsyncClient, acreate_client
from app.config import settings

_client: AsyncClient | None = None
_anon_client: AsyncClient | None = None


async def init_supabase() -> None:
    """Create the global Supabase AsyncClients on application startup."""
    global _client, _anon_client
    # Service-role client: bypasses RLS, used for DB operations
    _client = await acreate_client(
        settings.supabase_url,
        settings.supabase_service_role_key,
    )
    # Anon client: used for user-facing auth (sign-in, sign-up, etc.)
    _anon_client = await acreate_client(
        settings.supabase_url,
        settings.supabase_anon_key,
    )


def get_db() -> AsyncClient:
    """Return the service-role Supabase client; raises if not yet ready."""
    if _client is None:
        raise RuntimeError("Supabase client not initialized. Call init_supabase() first.")
    return _client


def get_auth_db() -> AsyncClient:
    """Return the anon-key Supabase client for auth operations."""
    if _anon_client is None:
        raise RuntimeError("Supabase client not initialized. Call init_supabase() first.")
    return _anon_client
