from typing import Any
from pydantic import BaseModel


class ApiResponse(BaseModel):
    """Standard API response envelope returned by all endpoints."""
    ok: bool = True
    data: Any = None
    message: str | None = None


class PaginatedData(BaseModel):
    """Wrapper for paginated list responses."""
    items: list[Any]
    total: int
    page: int
    page_size: int
    has_next: bool


def ok(data: Any = None, message: str | None = None) -> dict:
    """Build a successful response envelope."""
    return {"ok": True, "data": data, "message": message}


def paginated(items: list, total: int, page: int, page_size: int) -> dict:
    """Build a paginated success response envelope."""
    return ok(data={
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "has_next": (page * page_size) < total,
    })
