import logging
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import User, UserProfile
from app.db.session import get_db_session

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["auth"])


class AuthRequest(BaseModel):
    name: str | None = None
    email: str = Field(..., description="User's email address")
    password: str = Field(..., description="User's password")


class UserProfileContract(BaseModel):
    id: str
    user_id: str
    raw_resume_text: str
    parsed_skills: list[str]
    parsed_domains: list[str]
    parsed_project_summary: str
    updated_at: str


class AuthResponse(BaseModel):
    user_id: str
    email: str
    name: str | None
    has_profile: bool
    profile: UserProfileContract | None = None


@router.post("/login", response_model=AuthResponse)
async def login(
    payload: AuthRequest,
    session: AsyncSession = Depends(get_db_session),
) -> AuthResponse:
    """
    Authenticate or auto-register a user.
    """
    email_clean = payload.email.strip().lower()
    if not email_clean:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email cannot be empty",
        )

    # 1. Lookup user by email
    stmt = select(User).where(User.email == email_clean)
    result = await session.execute(stmt)
    user = result.scalar_one_or_none()

    if user:
        # User exists, check password
        if user.password_hash != payload.password:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect password",
            )
    else:
        # Register new user
        user = User(
            email=email_clean,
            name=payload.name.strip() if payload.name else None,
            password_hash=payload.password,
        )
        session.add(user)
        await session.flush()  # populate ID
        logger.info("Auto-registered new user: %s", email_clean)

    # 2. Lookup profile if exists
    profile_stmt = select(UserProfile).where(UserProfile.user_id == user.id)
    profile_result = await session.execute(profile_stmt)
    profile = profile_result.scalar_one_or_none()

    profile_contract = None
    if profile:
        profile_contract = UserProfileContract(
            id=str(profile.id),
            user_id=str(profile.user_id),
            raw_resume_text=profile.raw_resume_text,
            parsed_skills=profile.parsed_skills,
            parsed_domains=profile.parsed_domains,
            parsed_project_summary=profile.parsed_project_summary,
            updated_at=profile.updated_at.isoformat() if profile.updated_at else datetime.now(timezone.utc).isoformat(),
        )

    await session.commit()

    return AuthResponse(
        user_id=str(user.id),
        email=user.email,
        name=user.name,
        has_profile=profile is not None,
        profile=profile_contract,
    )
