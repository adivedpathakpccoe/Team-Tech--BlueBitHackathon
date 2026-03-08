import time
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from app.config import settings
from app.database import init_supabase
from app.core.exceptions import register_exception_handlers
from app.routers import auth, assignments, classrooms, students, submissions, socratic, behavior, snapshots

logger = logging.getLogger(__name__)


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
        description="3-pillar academic integrity detection system",
        lifespan=lifespan,
        docs_url="/api/docs",
        redoc_url=None,
    )

    # --- Performance middleware (order matters: outermost runs first) ---

    # GZip compress all responses > 500 bytes — huge win over port forwarding
    app.add_middleware(GZipMiddleware, minimum_size=500)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
        max_age=3600,                  # Cache preflight for 1h; eliminates double round-trips
    )

    # Request timing — adds Server-Timing header for diagnosing slow endpoints
    @app.middleware("http")
    async def add_timing(request: Request, call_next):
        start = time.perf_counter()
        response = await call_next(request)
        elapsed_ms = (time.perf_counter() - start) * 1000
        response.headers["Server-Timing"] = f"total;dur={elapsed_ms:.1f}"
        if elapsed_ms > 1000:
            logger.warning("Slow request: %s %s took %.0fms", request.method, request.url.path, elapsed_ms)
        return response

    register_exception_handlers(app)

    app.include_router(auth.router, prefix="/api/auth", tags=["Auth"])
    app.include_router(assignments.router, prefix="/api/assignments", tags=["Assignments"])
    app.include_router(classrooms.router, prefix="/api/classrooms", tags=["Classrooms"])
    app.include_router(students.router, prefix="/api/student", tags=["Student"])
    app.include_router(submissions.router, prefix="/api/submissions", tags=["Submissions"])
    app.include_router(socratic.router, prefix="/api/socratic", tags=["Socratic"])
    app.include_router(behavior.router, prefix="/api/behavior", tags=["Behavior"])
    app.include_router(snapshots.router, prefix="/api/snapshots", tags=["Snapshots"])

    return app


app = create_app()
