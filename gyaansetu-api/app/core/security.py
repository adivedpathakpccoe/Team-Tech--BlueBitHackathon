import time
import logging
from collections import OrderedDict
from supabase import AsyncClient

logger = logging.getLogger(__name__)

# ── In-memory token cache ─────────────────────────────────────────────────────
# Caches (token → user) for up to 5 minutes.  This eliminates a Supabase
# round-trip on every single authenticated request — the #1 source of latency
# when the backend is port-forwarded.
_MAX_CACHE_SIZE = 512
_TTL_SECONDS = 300  # 5 minutes

_cache: OrderedDict[str, tuple[float, object]] = OrderedDict()


def _cache_get(token: str):
    """Return a cached user if the token is still valid, else None."""
    entry = _cache.get(token)
    if entry is None:
        return None
    ts, user = entry
    if time.time() - ts > _TTL_SECONDS:
        _cache.pop(token, None)
        return None
    # Move to end (most recently used)
    _cache.move_to_end(token)
    return user


def _cache_set(token: str, user):
    """Store a user in the cache, evicting the oldest entry if necessary."""
    _cache[token] = (time.time(), user)
    _cache.move_to_end(token)
    while len(_cache) > _MAX_CACHE_SIZE:
        _cache.popitem(last=False)


async def get_user_from_token(token: str, db: AsyncClient):
    """Verify a Supabase JWT and return the user record, or None if invalid.

    Uses an in-memory LRU cache with a 5-minute TTL so repeated requests
    with the same token don't each incur a Supabase network round-trip.
    """
    cached = _cache_get(token)
    if cached is not None:
        return cached

    try:
        res = await db.auth.get_user(token)
        user = res.user
        if user is not None:
            _cache_set(token, user)
        return user
    except Exception:
        return None
