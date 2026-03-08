from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, ConfigDict


class CamelModel(BaseModel):
    """Pydantic base that serializes to camelCase for API responses."""
    model_config = ConfigDict(populate_by_name=True, from_attributes=True)


class TimestampedModel(CamelModel):
    """Base for DB-mapped models that include audit timestamp fields."""
    id: UUID
    created_at: datetime


class PaginationParams(BaseModel):
    """Reusable query parameters for paginated list endpoints."""
    page: int = 1
    page_size: int = 20

    @property
    def offset(self) -> int:
        """Calculate the SQL OFFSET from page and page_size."""
        return (self.page - 1) * self.page_size
