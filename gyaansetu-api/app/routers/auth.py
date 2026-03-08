from fastapi import APIRouter, HTTPException
import logging
from pydantic import BaseModel, EmailStr
from typing import Annotated
from fastapi import Depends
from supabase import AsyncClient
from supabase_auth.errors import AuthApiError
from app.database import get_auth_db, get_db
from app.core.deps import CurrentUserDep
from app.core.responses import ok

logger = logging.getLogger(__name__)

router = APIRouter()

# Dependency: anon-key client for user-facing auth flows
AuthDbDep = Annotated[AsyncClient, Depends(get_auth_db)]
# Dependency: service-role client for admin/DB operations
DbDep = Annotated[AsyncClient, Depends(get_db)]


class SignUpRequest(BaseModel):
    """Request body for user registration."""
    email: EmailStr
    password: str
    name: str
    role: str = "student"


class SignInRequest(BaseModel):
    """Request body for user login."""
    email: EmailStr
    password: str


class RefreshTokenRequest(BaseModel):
    """Request body for token refresh."""
    refresh_token: str


class ForgotPasswordRequest(BaseModel):
    """Request body for password reset."""
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    """Request body for password reset."""
    password: str


@router.post("/signup", response_model=dict, status_code=201)
async def sign_up(body: SignUpRequest, db: AuthDbDep):
    """Register a new user via Supabase Auth and store profile metadata."""
    try:
        # `options.data` is persisted as user_metadata and later read for RBAC.
        res = await db.auth.sign_up({
            "email": body.email,
            "password": body.password,
            "options": {"data": {"name": body.name, "role": body.role}},
        })
        return ok(data={"user_id": res.user.id}, message="Registration successful")
    except AuthApiError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/signin", response_model=dict)
async def sign_in(body: SignInRequest, db: AuthDbDep):
    """Authenticate an existing user and return session tokens."""
    logger.info("Attempting sign-in for email: %s", body.email)
    try:
        res = await db.auth.sign_in_with_password({"email": body.email, "password": body.password})
        logger.info("Sign-in successful for user_id: %s", res.user.id)
        return ok(data={
            # Access token is sent on API calls; refresh token is for renewal.
            "access_token": res.session.access_token,
            "refresh_token": res.session.refresh_token,
            # Role is sourced from auth metadata; teacher-only endpoints enforce this.
            "user": {"id": res.user.id, "email": res.user.email, "role": res.user.user_metadata.get("role")},
        })
    except AuthApiError as e:
        logger.warning("Sign-in failed for %s: %s", body.email, str(e))
        raise HTTPException(status_code=401, detail=str(e))
    except Exception as e:
        logger.error("Unexpected sign-in error for %s: %s", body.email, str(e), exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error during authentication")


@router.post("/refresh", response_model=dict)
async def refresh_token(body: RefreshTokenRequest, db: AuthDbDep):
    """Refresh the access token using a valid refresh token."""
    try:
        # Supabase returns a new access+refresh pair; caller should replace both.
        res = await db.auth.refresh_session(body.refresh_token)
        return ok(data={
            "access_token": res.session.access_token,
            "refresh_token": res.session.refresh_token,
            "user": {"id": res.user.id, "email": res.user.email, "role": res.user.user_metadata.get("role")},
        })
    except AuthApiError as e:
        raise HTTPException(status_code=401, detail=str(e))


@router.post("/forgot-password", response_model=dict)
async def forgot_password(body: ForgotPasswordRequest, db: AuthDbDep):
    """Send a password reset email to the user."""
    try:
        await db.auth.reset_password_for_email(body.email)
        return ok(message="Password reset email sent")
    except AuthApiError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/reset-password", response_model=dict)
async def reset_password(body: ResetPasswordRequest, current_user: CurrentUserDep, db: DbDep):
    """Update the password for the authenticated user."""
    await db.auth.update_user({"password": body.password})
    return ok(message="Password updated successfully")


@router.get("/me", response_model=dict)
async def get_current_user(current_user: CurrentUserDep):
    """Get the current authenticated user's information."""
    return ok(data={
        "id": current_user.id,
        "email": current_user.email,
        "name": current_user.user_metadata.get("name"),
        "role": current_user.user_metadata.get("role"),
    })


@router.post("/signout", response_model=dict)
async def sign_out(db: DbDep):
    """Invalidate the current Supabase session."""
    # This revokes current auth session in Supabase; client should also clear local tokens.
    await db.auth.sign_out()
    return ok(message="Signed out")

