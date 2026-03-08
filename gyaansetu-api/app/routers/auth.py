from fastapi import APIRouter
from pydantic import BaseModel, EmailStr
from app.core.deps import DbDep, CurrentUserDep
from app.core.responses import ok

router = APIRouter()


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
async def sign_up(body: SignUpRequest, db: DbDep):
    """Register a new user via Supabase Auth and store profile metadata."""
    res = await db.auth.sign_up({
        "email": body.email,
        "password": body.password,
        "options": {"data": {"name": body.name, "role": body.role}},
    })
    return ok(data={"user_id": res.user.id}, message="Registration successful")


@router.post("/signin", response_model=dict)
async def sign_in(body: SignInRequest, db: DbDep):
    """Authenticate an existing user and return the Supabase session tokens."""
    res = await db.auth.sign_in_with_password({"email": body.email, "password": body.password})
    return ok(data={
        "access_token": res.session.access_token,
        "refresh_token": res.session.refresh_token,
        "user": {"id": res.user.id, "email": res.user.email, "role": res.user.user_metadata.get("role")},
    })


@router.post("/refresh", response_model=dict)
async def refresh_token(body: RefreshTokenRequest, db: DbDep):
    """Refresh the access token using a valid refresh token."""
    res = await db.auth.refresh_session(body.refresh_token)
    return ok(data={
        "access_token": res.session.access_token,
        "refresh_token": res.session.refresh_token,
        "user": {"id": res.user.id, "email": res.user.email, "role": res.user.user_metadata.get("role")},
    })


@router.post("/forgot-password", response_model=dict)
async def forgot_password(body: ForgotPasswordRequest, db: DbDep):
    """Send a password reset email to the user."""
    await db.auth.reset_password_for_email(body.email)
    return ok(message="Password reset email sent")


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
    await db.auth.sign_out()
    return ok(message="Signed out")
