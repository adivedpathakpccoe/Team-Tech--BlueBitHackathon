# GYAANSETU — Backend Design System & Architecture Instructions

## Overview

GYAANSETU backend is built on a **FastAPI + Supabase** stack following a
**service-layer architecture** — thin routers, fat services, zero logic in route
handlers. Every module is written to be reused, composed, and iterated on with
minimal surface area. Before committing any function, restructure the module so
that no two functions share duplicated logic.

---

## Stack

| Layer | Technology |
|---|---|
| API Framework | FastAPI 0.111+ |
| Database / Auth / Storage | Supabase (via MCP `supabase-py`) |
| Validation | Pydantic v2 |
| Async runtime | `asyncio` — all I/O is `async/await` |
| Auth | Supabase Auth + JWT via `python-jose` |
| Env config | `pydantic-settings` (`BaseSettings`) |
| Testing | `pytest` + `httpx.AsyncClient` |
| Migrations | Supabase SQL migrations (CLI) |

---

## Project Structure

```
gyaansetu-api/
├── app/
│   ├── main.py                  # App factory, lifespan, middleware
│   ├── config.py                # BaseSettings — single source of env vars
│   ├── database.py              # Supabase client singleton
│   │
│   ├── core/
│   │   ├── deps.py              # Reusable FastAPI dependencies
│   │   ├── security.py          # JWT decode, password hashing helpers
│   │   ├── exceptions.py        # AppException hierarchy + handlers
│   │   └── responses.py         # Unified response envelope helpers
│   │
│   ├── models/                  # Pydantic schemas (request / response / DB)
│   │   ├── base.py              # TimestampedModel, PaginatedResponse
│   │   ├── user.py
│   │   ├── submission.py
│   │   ├── report.py
│   │   └── institution.py
│   │
│   ├── services/                # All business logic lives here
│   │   ├── base.py              # BaseService with shared CRUD helpers
│   │   ├── user_service.py
│   │   ├── submission_service.py
│   │   ├── report_service.py
│   │   ├── detection_service.py
│   │   └── institution_service.py
│   │
│   └── routers/                 # Thin route handlers — no logic
│       ├── auth.py
│       ├── users.py
│       ├── submissions.py
│       ├── reports.py
│       └── institutions.py
│
├── tests/
│   ├── conftest.py
│   └── test_submissions.py
├── supabase/
│   └── migrations/
├── .env
└── pyproject.toml
```

---

## App Factory — `app/main.py`

Use a `lifespan` context manager for startup/shutdown. Never use deprecated
`on_event`. Register all routers and exception handlers here.

```python
from contextlib import asynccontextmanager
from fastapi import FastAPI
from app.database import init_supabase
from app.core.exceptions import register_exception_handlers
from app.routers import auth, users, submissions, reports, institutions


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize shared resources on startup; release on shutdown."""
    await init_supabase()
    yield


def create_app() -> FastAPI:
    """Construct and configure the FastAPI application instance."""
    app = FastAPI(
        title="GYAANSETU API",
        version="1.0.0",
        lifespan=lifespan,
        docs_url="/api/docs",
        redoc_url=None,
    )
    register_exception_handlers(app)
    app.include_router(auth.router,         prefix="/api/auth",         tags=["Auth"])
    app.include_router(users.router,        prefix="/api/users",        tags=["Users"])
    app.include_router(submissions.router,  prefix="/api/submissions",  tags=["Submissions"])
    app.include_router(reports.router,      prefix="/api/reports",      tags=["Reports"])
    app.include_router(institutions.router, prefix="/api/institutions", tags=["Institutions"])
    return app


app = create_app()
```

---

## Configuration — `app/config.py`

Single `Settings` instance loaded once at import time. All env vars flow through
here — never call `os.getenv` anywhere else.

```python
from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application-wide configuration loaded from environment variables."""

    # Supabase
    supabase_url: str
    supabase_anon_key: str
    supabase_service_role_key: str

    # JWT
    jwt_secret: str
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60

    # App
    environment: str = "development"
    debug: bool = False
    allowed_origins: list[str] = ["http://localhost:3000"]

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")


@lru_cache
def get_settings() -> Settings:
    """Return the cached Settings singleton."""
    return Settings()


settings = get_settings()
```

---

## Supabase Client — `app/database.py`

One client per process. The `service_role` client is used only in server-side
service calls; the `anon` client is never used server-side.

```python
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
```

---

## Reusable Dependencies — `app/core/deps.py`

All route-level dependencies are defined here and reused via `Depends()`.
Never duplicate auth logic inside route handlers.

```python
from typing import Annotated
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from supabase import AsyncClient
from app.database import get_db
from app.core.security import decode_access_token
from app.models.user import UserInDB

bearer_scheme = HTTPBearer()

DbDep    = Annotated[AsyncClient, Depends(get_db)]
TokenDep = Annotated[HTTPAuthorizationCredentials, Depends(bearer_scheme)]


async def get_current_user(token: TokenDep, db: DbDep) -> UserInDB:
    """Validate JWT and return the authenticated user record."""
    payload = decode_access_token(token.credentials)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    user = await db.table("users").select("*").eq("id", payload["sub"]).maybe_single().execute()
    if not user.data:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return UserInDB(**user.data)


async def require_admin(current_user: Annotated[UserInDB, Depends(get_current_user)]) -> UserInDB:
    """Enforce admin role on a route; raises 403 if the user is not an admin."""
    if current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return current_user


# Convenient type aliases for injection
CurrentUserDep = Annotated[UserInDB, Depends(get_current_user)]
AdminDep       = Annotated[UserInDB, Depends(require_admin)]
```

---

## Exception Hierarchy — `app/core/exceptions.py`

Define a single `AppException` base and subclass per domain. Register one
generic handler — not one per exception type.

```python
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse


class AppException(Exception):
    """Base exception for all application-level errors."""
    def __init__(self, status_code: int, detail: str, code: str = "ERROR"):
        self.status_code = status_code
        self.detail = detail
        self.code = code


class NotFoundError(AppException):
    """Raised when a requested resource does not exist."""
    def __init__(self, resource: str, id: str | int):
        super().__init__(404, f"{resource} '{id}' not found", "NOT_FOUND")


class ConflictError(AppException):
    """Raised when a create/update operation violates a uniqueness constraint."""
    def __init__(self, detail: str):
        super().__init__(409, detail, "CONFLICT")


class ForbiddenError(AppException):
    """Raised when the authenticated user lacks permission for an action."""
    def __init__(self, detail: str = "Forbidden"):
        super().__init__(403, detail, "FORBIDDEN")


class ValidationError(AppException):
    """Raised when business-logic validation fails outside Pydantic."""
    def __init__(self, detail: str):
        super().__init__(422, detail, "VALIDATION_ERROR")


def register_exception_handlers(app: FastAPI) -> None:
    """Attach the global AppException handler to the FastAPI instance."""
    @app.exception_handler(AppException)
    async def app_exception_handler(request: Request, exc: AppException) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content={"ok": False, "code": exc.code, "detail": exc.detail},
        )
```

---

## Response Envelope — `app/core/responses.py`

Every endpoint returns the same wrapper shape. Use these helpers in route
handlers — never construct raw dicts.

```python
from typing import Any, TypeVar
from pydantic import BaseModel

T = TypeVar("T")


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
```

---

## Base Pydantic Models — `app/models/base.py`

All domain models inherit from these. Never duplicate `id`, `created_at`,
`updated_at` fields across schemas.

```python
from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, ConfigDict


class CamelModel(BaseModel):
    """Pydantic base that serializes to camelCase for API responses."""
    model_config = ConfigDict(populate_by_name=True, from_attributes=True)

    @classmethod
    def _to_camel(cls, string: str) -> str:
        """Convert a snake_case string to camelCase."""
        parts = string.split("_")
        return parts[0] + "".join(p.capitalize() for p in parts[1:])


class TimestampedModel(CamelModel):
    """Base for DB-mapped models that include audit timestamp fields."""
    id: UUID
    created_at: datetime
    updated_at: datetime


class PaginationParams(BaseModel):
    """Reusable query parameters for paginated list endpoints."""
    page: int = 1
    page_size: int = 20

    @property
    def offset(self) -> int:
        """Calculate the SQL OFFSET from page and page_size."""
        return (self.page - 1) * self.page_size
```

---

## Base Service — `app/services/base.py`

All service classes extend `BaseService`. Shared CRUD operations are
implemented once here and never re-implemented in subclasses.

```python
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

    # ── Read ────────────────────────────────────────────────────────────────

    async def get_by_id(self, id: UUID | str) -> dict:
        """Fetch a single row by primary key; raises NotFoundError if absent."""
        res = await self.db.table(self.table).select("*").eq("id", str(id)).maybe_single().execute()
        if not res.data:
            raise NotFoundError(self.table, id)
        return res.data

    async def list_paginated(self, page: int = 1, page_size: int = 20, filters: dict | None = None) -> tuple[list, int]:
        """Return a page of rows and the total count, optionally filtered."""
        query = self.db.table(self.table).select("*", count="exact")
        if filters:
            for key, value in filters.items():
                query = query.eq(key, value)
        offset = (page - 1) * page_size
        res = await query.range(offset, offset + page_size - 1).execute()
        return res.data, res.count or 0

    # ── Write ───────────────────────────────────────────────────────────────

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

    # ── Helpers ─────────────────────────────────────────────────────────────

    async def exists(self, **kwargs: Any) -> bool:
        """Return True if at least one row matches all provided column filters."""
        query = self.db.table(self.table).select("id", count="exact", head=True)
        for key, value in kwargs.items():
            query = query.eq(key, value)
        res = await query.execute()
        return (res.count or 0) > 0

    async def get_by_field(self, field: str, value: Any) -> dict | None:
        """Fetch the first row where a single column equals the given value."""
        res = await self.db.table(self.table).select("*").eq(field, value).maybe_single().execute()
        return res.data
```

---

## Domain Service Example — `app/services/submission_service.py`

Subclass `BaseService`, add domain methods, reuse inherited helpers.

```python
from uuid import UUID
from supabase import AsyncClient
from app.services.base import BaseService
from app.core.exceptions import ValidationError, ConflictError
from app.models.submission import SubmissionCreate


class SubmissionService(BaseService):
    """Service layer for academic submission lifecycle management."""

    table = "submissions"

    def __init__(self, db: AsyncClient):
        """Bind to the Supabase client and declare the target table."""
        super().__init__(db)

    async def create_submission(self, data: SubmissionCreate, student_id: UUID) -> dict:
        """Validate and persist a new student submission; raises ConflictError on duplicate."""
        duplicate = await self.exists(student_id=str(student_id), assignment_id=str(data.assignment_id))
        if duplicate:
            raise ConflictError("Submission already exists for this assignment")
        return await self.create({**data.model_dump(), "student_id": str(student_id), "status": "pending"})

    async def get_student_submissions(self, student_id: UUID, page: int, page_size: int) -> tuple[list, int]:
        """Return paginated submissions scoped to a single student."""
        return await self.list_paginated(page, page_size, filters={"student_id": str(student_id)})

    async def update_status(self, submission_id: UUID, status: str) -> dict:
        """Transition a submission to a new processing status."""
        allowed = {"pending", "processing", "complete", "flagged"}
        if status not in allowed:
            raise ValidationError(f"Invalid status '{status}'. Must be one of: {allowed}")
        return await self.update(submission_id, {"status": status})

    async def get_flagged(self, institution_id: UUID) -> list[dict]:
        """Retrieve all flagged submissions for a given institution."""
        res = await (
            self.db.table(self.table)
            .select("*, users(name, email)")
            .eq("institution_id", str(institution_id))
            .eq("status", "flagged")
            .execute()
        )
        return res.data
```

---

## Router Pattern — `app/routers/submissions.py`

Routers are **thin**. No business logic. Each handler: validate input → call
service → return envelope. Services are injected via `Depends`.

```python
from typing import Annotated
from uuid import UUID
from fastapi import APIRouter, Depends, Query
from app.core.deps import CurrentUserDep, DbDep
from app.core.responses import ok, paginated
from app.models.submission import SubmissionCreate, SubmissionResponse
from app.services.submission_service import SubmissionService

router = APIRouter()


def get_submission_service(db: DbDep) -> SubmissionService:
    """Instantiate the SubmissionService with the current DB connection."""
    return SubmissionService(db)


SubmissionServiceDep = Annotated[SubmissionService, Depends(get_submission_service)]


@router.post("/", response_model=dict, status_code=201)
async def create_submission(
    body: SubmissionCreate,
    current_user: CurrentUserDep,
    svc: SubmissionServiceDep,
):
    """Accept a new academic submission from the authenticated student."""
    result = await svc.create_submission(body, current_user.id)
    return ok(data=result, message="Submission created")


@router.get("/", response_model=dict)
async def list_my_submissions(
    current_user: CurrentUserDep,
    svc: SubmissionServiceDep,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    """Return a paginated list of the authenticated student's submissions."""
    items, total = await svc.get_student_submissions(current_user.id, page, page_size)
    return paginated(items, total, page, page_size)


@router.get("/{submission_id}", response_model=dict)
async def get_submission(
    submission_id: UUID,
    current_user: CurrentUserDep,
    svc: SubmissionServiceDep,
):
    """Fetch a single submission by ID; enforces ownership."""
    result = await svc.get_by_id(submission_id)
    return ok(data=result)


@router.patch("/{submission_id}/status", response_model=dict)
async def update_submission_status(
    submission_id: UUID,
    status: str,
    current_user: CurrentUserDep,
    svc: SubmissionServiceDep,
):
    """Update the processing status of a submission."""
    result = await svc.update_status(submission_id, status)
    return ok(data=result, message="Status updated")
```

---

## Security Helpers — `app/core/security.py`

All cryptographic operations are isolated here. Import these — never
inline JWT or hashing logic in services or routers.

```python
from datetime import datetime, timedelta, timezone
from jose import JWTError, jwt
from passlib.context import CryptContext
from app.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(plain: str) -> str:
    """Return a bcrypt hash of the provided plaintext password."""
    return pwd_context.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    """Return True if the plaintext password matches the stored hash."""
    return pwd_context.verify(plain, hashed)


def create_access_token(subject: str, extra: dict | None = None) -> str:
    """Encode a signed JWT with the given subject and optional extra claims."""
    payload = {
        "sub": subject,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=settings.access_token_expire_minutes),
        **(extra or {}),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> dict | None:
    """Decode and verify a JWT; returns the payload dict or None on failure."""
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except JWTError:
        return None
```

---

## Pydantic Schema Conventions

### Naming per schema kind

| Suffix | Purpose | Example |
|---|---|---|
| `Create` | Request body for POST | `SubmissionCreate` |
| `Update` | Request body for PATCH (all fields optional) | `SubmissionUpdate` |
| `Response` | Outbound shape serialized to client | `SubmissionResponse` |
| `InDB` | Internal shape including DB-only fields | `UserInDB` |
| `Filter` | Query-param schema for list endpoints | `SubmissionFilter` |

### Update schemas — always use `Optional`

```python
from pydantic import BaseModel
from typing import Optional


class SubmissionUpdate(BaseModel):
    """Partial update schema — all fields are optional."""
    title: Optional[str] = None
    content: Optional[str] = None
    assignment_id: Optional[str] = None

    def to_patch(self) -> dict:
        """Return only the fields that were explicitly set (non-None)."""
        return self.model_dump(exclude_none=True)
```

---

## Docstring Standard

Every function gets **one line only** — what it does. No parameter descriptions,
no return descriptions, no blank lines inside. If a function needs more than one
sentence to describe, it is doing too much — split it.

```python
# ✅ Correct
async def get_by_id(self, id: UUID) -> dict:
    """Fetch a single row by primary key; raises NotFoundError if absent."""
    ...

# ✅ Correct
def create_access_token(subject: str) -> str:
    """Encode a signed JWT with the given subject and expiry."""
    ...

# ❌ Wrong — too verbose
async def create_submission(self, data: SubmissionCreate) -> dict:
    """
    Creates a new submission.

    Args:
        data: The submission payload.
    Returns:
        The created record dict.
    """
    ...
```

---

## Iteration & Refactoring Rules

Apply these on **every change** to an existing module before committing:

### 1 — Extract repeated query patterns
If the same `.select().eq().execute()` chain appears more than once in a service,
extract it into a private `_query_*` helper method.

### 2 — No logic in routers
If a router handler contains more than `validate → call service → return envelope`,
the logic belongs in the service layer. Move it.

### 3 — No raw strings for table names
Each service declares `table: str` as a class attribute. Never hardcode
a table name as a string literal inside a method body.

### 4 — Flatten conditional chains
Replace nested `if/else` chains with early returns or guard clauses.
Maximum nesting depth: **2 levels**.

### 5 — Reuse `BaseService` before adding new methods
Before writing a new service method, check if `get_by_id`, `get_by_field`,
`exists`, `list_paginated`, or `update` already covers the use case.

### 6 — Centralize filter building
If multiple endpoints accept similar filter params, define one `build_filters()`
function in the service (or `base.py`) rather than building dicts in each handler.

```python
def build_filters(self, **kwargs) -> dict:
    """Return a dict of non-None keyword arguments for use as query filters."""
    return {k: v for k, v in kwargs.items() if v is not None}
```

---

## Supabase Query Patterns

### Always use `maybe_single()` for single-row selects
```python
# ✅ Returns None if not found — never raises
res = await db.table("users").select("*").eq("email", email).maybe_single().execute()

# ❌ Returns a list — forces [0] indexing and breaks on empty result
res = await db.table("users").select("*").eq("email", email).execute()
```

### Use `count="exact"` for pagination — one round-trip
```python
res = await db.table("submissions").select("*", count="exact").range(0, 19).execute()
items, total = res.data, res.count
```

### Upsert over manual check-then-insert
```python
# ✅ Atomic — no race condition
await db.table("tokens").upsert({"user_id": uid, "token": t}, on_conflict="user_id").execute()
```

### Use `.select()` on insert/update to avoid a second round-trip
```python
res = await db.table("reports").insert(payload).select().execute()
return res.data[0]  # Returns the created row immediately
```

---

## Error Handling Flow

```
Router Handler
    │
    └─► Service Method
            │
            ├─► raises AppException subclass (NotFoundError, ConflictError, …)
            │
            └─► global exception_handler in main.py
                    │
                    └─► JSONResponse { ok: false, code: "…", detail: "…" }
```

Never `try/except` inside route handlers. Let exceptions propagate to the
registered handler. Only catch exceptions at the **service level** when you
need to translate a Supabase/DB error into a domain exception.

```python
async def create_user(self, payload: dict) -> dict:
    """Insert a new user record; translates Supabase unique violations to ConflictError."""
    try:
        return await self.create(payload)
    except Exception as e:
        if "unique" in str(e).lower():
            raise ConflictError("Email already registered")
        raise
```

---

## Testing Conventions — `tests/`

```python
# tests/conftest.py
import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app


@pytest.fixture
async def client():
    """Yield an async test client bound to the FastAPI app."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c


@pytest.fixture
def auth_headers():
    """Return Authorization headers for a seeded test user."""
    from app.core.security import create_access_token
    token = create_access_token(subject="test-user-uuid")
    return {"Authorization": f"Bearer {token}"}
```

```python
# tests/test_submissions.py
import pytest


@pytest.mark.asyncio
async def test_create_submission_success(client, auth_headers):
    """Verify a valid submission returns 201 with the created record."""
    res = await client.post("/api/submissions/", json={...}, headers=auth_headers)
    assert res.status_code == 201
    assert res.json()["ok"] is True


@pytest.mark.asyncio
async def test_create_submission_duplicate(client, auth_headers):
    """Verify a duplicate submission returns 409 Conflict."""
    await client.post("/api/submissions/", json={...}, headers=auth_headers)
    res = await client.post("/api/submissions/", json={...}, headers=auth_headers)
    assert res.status_code == 409
    assert res.json()["code"] == "CONFLICT"
```

---

## What to Avoid

- **No logic in route handlers** — routers are dispatch only.
- **No `os.getenv` calls** outside `config.py` — all config flows through `Settings`.
- **No synchronous database calls** — every Supabase call must be `await`ed.
- **No duplicated table-name strings** — always use `self.table`.
- **No multi-line docstrings** — one sentence per function maximum.
- **No raw `dict` returns from services** — return typed data or let Pydantic validate at the router boundary.
- **No nested try/except in routers** — raise domain exceptions from services.
- **No `SELECT *` in production joins** — specify columns when joining to avoid payload bloat.
- **No hardcoded UUIDs or secrets** — always from `settings` or test fixtures.