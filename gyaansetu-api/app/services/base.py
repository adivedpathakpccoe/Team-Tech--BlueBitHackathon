from typing import Any, Generic, TypeVar
from uuid import UUID
from supabase import AsyncClient
from app.core.exceptions import NotFoundError

ModelT = TypeVar("ModelT")


class BaseService(Generic[ModelT]):
    """Generic CRUD service backed by a Supabase table."""

    table: str  # Subclasses must declare this

    def __init__(self, db: AsyncClient):
        """Bind the service to the provided Supabase client."""
        self.db = db

    async def get_by_id(self, id: UUID | str) -> dict:
        """Fetch a single row by primary key; raises NotFoundError if absent."""
        res = await self.db.table(self.table).select("*").eq("id", str(id)).execute()
        if not res.data:
            raise NotFoundError(self.table, id)
        return res.data[0]

    async def list_paginated(self, page: int = 1, page_size: int = 20, filters: dict | None = None) -> tuple[list, int]:
        """Return a page of rows and the total count, optionally filtered."""
        query = self.db.table(self.table).select("*", count="exact")
        if filters:
            for key, value in filters.items():
                query = query.eq(key, value)
        offset = (page - 1) * page_size
        res = await query.range(offset, offset + page_size - 1).execute()
        return res.data, res.count or 0

    async def create(self, payload: dict) -> dict:
        """Insert a new row and return the created record."""
        res = await self.db.table(self.table).insert(payload).execute()
        return res.data[0]

    async def update(self, id: UUID | str, payload: dict) -> dict:
        """Partially update a row by primary key and return the updated record."""
        res = await self.db.table(self.table).update(payload).eq("id", str(id)).execute()
        if not res.data:
            raise NotFoundError(self.table, id)
        return res.data[0]

    async def delete(self, id: UUID | str) -> None:
        """Hard-delete a row by primary key."""
        await self.db.table(self.table).delete().eq("id", str(id)).execute()

    async def exists(self, **kwargs: Any) -> bool:
        """Return True if at least one row matches all provided column filters."""
        query = self.db.table(self.table).select("id", count="exact", head=True)
        for key, value in kwargs.items():
            query = query.eq(key, value)
        res = await query.execute()
        return (res.count or 0) > 0

    async def get_by_field(self, field: str, value: Any) -> dict | None:
        """Fetch the first row where a single column equals the given value."""
        res = await self.db.table(self.table).select("*").eq(field, value).execute()
        return res.data[0] if res.data else None

    def build_filters(self, **kwargs: Any) -> dict:
        """Return a dict of non-None keyword arguments for use as query filters."""
        return {k: v for k, v in kwargs.items() if v is not None}
