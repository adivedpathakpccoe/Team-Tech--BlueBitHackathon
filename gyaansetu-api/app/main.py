from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.database import init_supabase
from app.core.exceptions import register_exception_handlers
from app.routers import auth, assignments, classrooms


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

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],          # Allow all origins in dev mode
        allow_credentials=False,       # Must be False when allow_origins=["*"]
        allow_methods=["*"],
        allow_headers=["*"],
        max_age=0,                     # Don't cache preflight; avoids stale CORS blocks on restart
    )

    register_exception_handlers(app)

    app.include_router(auth.router, prefix="/api/auth", tags=["Auth"])
    app.include_router(assignments.router, prefix="/api/assignments", tags=["Assignments"])
    app.include_router(classrooms.router, prefix="/api/classrooms", tags=["Classrooms"])

    return app


app = create_app()
