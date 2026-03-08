from typing import Annotated
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from supabase import AsyncClient
from app.database import get_db
from app.core.security import get_user_from_token

bearer_scheme = HTTPBearer()

DbDep    = Annotated[AsyncClient, Depends(get_db)]
TokenDep = Annotated[HTTPAuthorizationCredentials, Depends(bearer_scheme)]


async def get_current_user(token: TokenDep, db: DbDep) -> dict:
    """Validate Supabase JWT and return the authenticated user."""
    user = await get_user_from_token(token.credentials, db)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")
    return user


async def require_teacher(current_user: Annotated[dict, Depends(get_current_user)]) -> dict:
    """Enforce teacher role; raises 403 if user metadata role is not teacher."""
    role = (current_user.user_metadata or {}).get("role")
    if role != "teacher":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Teacher access required")
    return current_user


CurrentUserDep = Annotated[dict, Depends(get_current_user)]
TeacherDep     = Annotated[dict, Depends(require_teacher)]
