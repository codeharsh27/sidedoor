"""
Phase 5 Application Tracker & Follow-Up Reminder Endpoints — /api/v1/tracker

Provides Kanban tracking and automatic 7-day follow-up reminder nudges.
"""

import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Application, ApplicationEvent, Card, Company, UserProfile
from app.db.session import get_db_session

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/tracker", tags=["tracker"])


# --- Schemas ---

class CreateApplicationRequest(BaseModel):
    user_id: str
    company_id: str
    card_id: str | None = None
    status: str = Field("researching", description="Initial status")
    notes: str | None = None


class UpdateApplicationRequest(BaseModel):
    status: str | None = None
    demo_url: str | None = None
    notes: str | None = None


class ApplicationResponse(BaseModel):
    id: str
    user_id: str
    company_id: str
    company_name: str
    company_url: str
    card_id: str | None
    status: str
    demo_url: str | None
    outreach_sent_at: str | None
    last_reply_at: str | None
    notes: str | None
    created_at: str
    updated_at: str


class KanbanBoardResponse(BaseModel):
    researching: list[ApplicationResponse]
    building: list[ApplicationResponse]
    reached_out: list[ApplicationResponse]
    replied: list[ApplicationResponse]
    interviewing: list[ApplicationResponse]
    closed: list[ApplicationResponse]


class ReminderItemResponse(BaseModel):
    application_id: str
    company_name: str
    outreach_sent_at: str
    days_since_outreach: int
    contact_name: str
    follow_up_draft: str


class RemindersResponse(BaseModel):
    reminders: list[ReminderItemResponse]


# --- Helpers ---

async def _serialize_app(app: Application, db: AsyncSession) -> dict:
    stmt_c = select(Company).where(Company.id == app.company_id)
    comp = (await db.execute(stmt_c)).scalar_one_or_none()
    comp_name = comp.name if comp else "Unknown Company"
    comp_url = comp.url if comp else ""

    return {
        "id": str(app.id),
        "user_id": str(app.user_id),
        "company_id": str(app.company_id),
        "company_name": comp_name,
        "company_url": comp_url,
        "card_id": str(app.card_id) if app.card_id else None,
        "status": app.status,
        "demo_url": app.demo_url,
        "outreach_sent_at": app.outreach_sent_at.isoformat() if app.outreach_sent_at else None,
        "last_reply_at": app.last_reply_at.isoformat() if app.last_reply_at else None,
        "notes": app.notes,
        "created_at": app.created_at.isoformat(),
        "updated_at": app.updated_at.isoformat(),
    }


# --- Routes ---

@router.get("", response_model=KanbanBoardResponse)
async def get_user_applications(
    user_id: str = Query(..., description="User UUID"),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    """Get user's applications grouped by Kanban status columns."""
    try:
        u_uuid = uuid.UUID(user_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid user_id format",
        )

    stmt = select(Application).where(Application.user_id == u_uuid)
    res = await db.execute(stmt)
    apps = list(res.scalars().all())

    board: dict[str, list] = {
        "researching": [],
        "building": [],
        "reached_out": [],
        "replied": [],
        "interviewing": [],
        "closed": [],
    }

    for app in apps:
        serialized = await _serialize_app(app, db)
        col = app.status if app.status in board else "researching"
        board[col].append(serialized)

    return board


@router.post("", response_model=ApplicationResponse)
async def create_application(
    payload: CreateApplicationRequest,
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    """Create or return existing application for a company."""
    try:
        u_uuid = uuid.UUID(payload.user_id)
        c_uuid = uuid.UUID(payload.company_id)
        card_uuid = uuid.UUID(payload.card_id) if payload.card_id else None
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid UUID format",
        )

    # Check for existing application
    stmt_exist = select(Application).where(
        Application.user_id == u_uuid,
        Application.company_id == c_uuid,
    )
    exist = (await db.execute(stmt_exist)).scalar_one_or_none()

    now = datetime.now(timezone.utc)

    if exist:
        if payload.status:
            exist.status = payload.status
        if payload.notes:
            exist.notes = payload.notes
        if card_uuid:
            exist.card_id = card_uuid
        exist.updated_at = now
        await db.commit()
        return await _serialize_app(exist, db)

    new_app = Application(
        user_id=u_uuid,
        company_id=c_uuid,
        card_id=card_uuid,
        status=payload.status,
        notes=payload.notes,
        created_at=now,
        updated_at=now,
    )
    db.add(new_app)
    await db.flush()

    # Log event
    event = ApplicationEvent(
        application_id=new_app.id,
        event_type="status_changed",
        event_data={"new_status": payload.status},
        created_at=now,
    )
    db.add(event)
    await db.commit()

    return await _serialize_app(new_app, db)


@router.patch("/{app_id}", response_model=ApplicationResponse)
async def update_application(
    app_id: str,
    payload: UpdateApplicationRequest,
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    """Update application status, demo URL, or notes."""
    try:
        a_uuid = uuid.UUID(app_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid app_id UUID format",
        )

    stmt = select(Application).where(Application.id == a_uuid)
    app = (await db.execute(stmt)).scalar_one_or_none()
    if not app:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Application {app_id} not found",
        )

    now = datetime.now(timezone.utc)
    old_status = app.status

    if payload.status:
        app.status = payload.status
        if payload.status == "reached_out" and not app.outreach_sent_at:
            app.outreach_sent_at = now
        elif payload.status == "replied" and not app.last_reply_at:
            app.last_reply_at = now

        # Log event
        event = ApplicationEvent(
            application_id=app.id,
            event_type="status_changed",
            event_data={"old_status": old_status, "new_status": payload.status},
            created_at=now,
        )
        db.add(event)

    if payload.demo_url is not None:
        app.demo_url = payload.demo_url
        event = ApplicationEvent(
            application_id=app.id,
            event_type="demo_deployed",
            event_data={"demo_url": payload.demo_url},
            created_at=now,
        )
        db.add(event)

    if payload.notes is not None:
        app.notes = payload.notes

    app.updated_at = now
    await db.commit()

    return await _serialize_app(app, db)


@router.get("/reminders", response_model=RemindersResponse)
async def get_followup_reminders(
    user_id: str = Query(..., description="User UUID"),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    """Get applications that are due for a 7-day follow-up nudge."""
    try:
        u_uuid = uuid.UUID(user_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid user_id format",
        )

    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(days=7)

    # Reached out >= 7 days ago and no reply received
    stmt = select(Application).where(
        Application.user_id == u_uuid,
        Application.status == "reached_out",
        Application.outreach_sent_at <= cutoff,
        Application.last_reply_at == None,
    )
    res = await db.execute(stmt)
    apps = list(res.scalars().all())

    reminders = []

    for app in apps:
        stmt_comp = select(Company).where(Company.id == app.company_id)
        comp = (await db.execute(stmt_comp)).scalar_one_or_none()
        comp_name = comp.name if comp else "Company"

        days_ago = (now - app.outreach_sent_at.replace(tzinfo=timezone.utc)).days if app.outreach_sent_at else 7

        demo_str = f" Live demo still up: {app.demo_url}" if app.demo_url else ""
        follow_up_text = (
            f"Hi team,\n\nFollowing up on my message from {days_ago} days ago.{demo_str}\n"
            f"Still very interested in engineering opportunities at {comp_name}. Would love 10 minutes to talk!"
        )

        reminders.append({
            "application_id": str(app.id),
            "company_name": comp_name,
            "outreach_sent_at": app.outreach_sent_at.isoformat() if app.outreach_sent_at else now.isoformat(),
            "days_since_outreach": days_ago,
            "contact_name": "Hiring Manager / Founder",
            "follow_up_draft": follow_up_text,
        })

    return {"reminders": reminders}
