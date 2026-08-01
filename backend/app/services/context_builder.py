"""
User Context Builder — constructs a compact context object for matching and search queries.

Pulls stable profile, relevant skills, active projects, and preferences
from the database. Does NOT pull entire raw DB blobs.
"""

import logging
from uuid import UUID
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import User, UserSkill, UserProject, UserPreference

logger = logging.getLogger(__name__)


async def build_user_context(user_id: UUID | str, db: AsyncSession) -> dict:
    """
    Build a compact, structured user context object for search & fit-ranking queries.

    Args:
        user_id: UUID of the target user.
        db: Active AsyncSession.

    Returns:
        Structured context dictionary:
        {
            "user_id": str,
            "name": str,
            "role_target": list[str],
            "stack": list[str],
            "key_projects": list[dict],
            "company_filters": {
                "stage": list[str],
                "industry": list[str],
                "location": str
            }
        }
    """
    if isinstance(user_id, str):
        user_id = UUID(user_id)

    # Fetch User
    user_stmt = select(User).where(User.id == user_id)
    user_res = await db.execute(user_stmt)
    user = user_res.scalar_one_or_none()

    name = user.name if user else "Candidate"

    # Fetch Skills (top 15)
    skills_stmt = (
        select(UserSkill.skill)
        .where(UserSkill.user_id == user_id)
        .order_by(UserSkill.confidence.desc())
        .limit(15)
    )
    skills_res = await db.execute(skills_stmt)
    skills = [row[0] for row in skills_res.all()]

    # Fetch Projects (built or in_progress)
    projects_stmt = (
        select(UserProject)
        .where(
            UserProject.user_id == user_id,
            UserProject.status.in_(["built", "in_progress"])
        )
    )
    projects_res = await db.execute(projects_stmt)
    projects = projects_res.scalars().all()

    # Fetch Preferences
    prefs_stmt = select(UserPreference).where(UserPreference.user_id == user_id)
    prefs_res = await db.execute(prefs_stmt)
    prefs = prefs_res.scalar_one_or_none()

    target_roles = prefs.target_roles if prefs else ["Product Engineer"]
    company_stage = prefs.company_stage if prefs else ["seed", "series-a", "yc-backed"]
    industries = prefs.industries if prefs else ["ai-native", "devtools", "fintech"]
    location_pref = prefs.location_pref if prefs else "remote"

    key_projects = [
        {
            "name": p.name,
            "description": p.description or "",
            "stack": p.stack or [],
            "status": p.status,
            "is_production": p.is_production
        }
        for p in projects
    ]

    return {
        "user_id": str(user_id),
        "name": name,
        "role_target": target_roles,
        "stack": skills,
        "key_projects": key_projects,
        "company_filters": {
            "stage": company_stage,
            "industry": industries,
            "location": location_pref
        }
    }
