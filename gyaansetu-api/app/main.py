from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.database import init_supabase
from app.core.exceptions import register_exception_handlers
from app.routers import auth


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
        allow_origins=settings.allowed_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    register_exception_handlers(app)

    app.include_router(auth.router, prefix="/api/auth", tags=["Auth"])

    return app


app = create_app()
