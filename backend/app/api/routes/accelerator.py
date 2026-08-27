import uuid
import logging
from datetime import datetime, timezone
from typing import Optional, Any
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db_session
from app.db.models import (
    User,
    AcceleratorProgress,
    AcceleratorBlockLog,
    AcceleratorNetworkLog,
    AcceleratorApplyLog,
    PMCompanyFeed
)
from app.services.accelerator_service import (
    CURRICULUM,
    BLOCK_ORDER,
    BLOCK_TIME_LIMITS,
    get_or_create_today_progress,
    compute_streak,
    generate_rubric_feedback,
    get_company_feed_for_today,
    get_next_allowed_block,
    validate_block_order,
    get_ist_now,
    get_ist_today
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/accelerator", tags=["accelerator"])

# ---------- Helper for User ID Validation ----------

def _validate_user_uuid(user_id_str: str) -> uuid.UUID:
    try:
        return uuid.UUID(user_id_str)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid user_id format (expected UUID)."
        )

# ---------- Pydantic Schemas ----------

class QuizQuestionResponse(BaseModel):
    question: str
    rubric_hint: str
    rubric_keywords: list[str]

class LearnContentResponse(BaseModel):
    concept: str
    body: str
    resource_url: str
    resource_label: str
    quiz: list[QuizQuestionResponse]

class VoiceContentResponse(BaseModel):
    prompt: str
    tool_url: str
    duration_min: int

class PracticeQuestionResponse(BaseModel):
    type: str
    question: str
    time_limit_min: int
    rubric_must_have: list[str]
    rubric_good_to_have: list[str]

class BuildTaskResponse(BaseModel):
    task: str
    output_type: str
    min_chars: int
    duration_min: int

class NetworkActionResponse(BaseModel):
    index: int
    type: str
    instruction: str

class NetworkContentResponse(BaseModel):
    actions: list[NetworkActionResponse]

class DailyBriefResponse(BaseModel):
    day_number: int
    phase: str
    phase_label: str
    title: str
    mentor_message: str
    is_boss_day: bool
    blocks_required: list[str]
    blocks_done: list[str]
    blocks_unlocked: list[str]
    started_today: bool
    eod_submitted: bool
    progress_row_id: str
    learn: LearnContentResponse
    voice: VoiceContentResponse
    practice: list[PracticeQuestionResponse]
    build: BuildTaskResponse
    network: NetworkContentResponse

class BlockStartRequest(BaseModel):
    user_id: str
    day_number: int
    block_type: str

class BlockStartResponse(BaseModel):
    block_log_id: str
    started_at: str
    time_limit_sec: int

class BlockCompleteRequest(BaseModel):
    user_id: str
    block_log_id: str
    day_number: int
    block_type: str
    answer_text: Optional[str] = None
    self_score: Optional[int] = None
    network_actions_completed: Optional[list[int]] = None
    companies_logged: Optional[list[str]] = None
    voice_completed: Optional[bool] = None

class BlockCompleteResponse(BaseModel):
    success: bool
    rubric_feedback: str
    next_block_unlocked: Optional[str] = None
    all_blocks_done: bool

class StreakResponse(BaseModel):
    current_streak: int
    longest_streak: int
    total_days_completed: int
    last_completed_date: Optional[str]
    milestones_unlocked: list[int]
    recovery_required: bool

class PMCompanyFeedItem(BaseModel):
    id: str
    company_name: str
    company_url: str
    role_title: str
    apply_url: Optional[str]
    feed_type: str
    source: str
    vc_backed: bool
    vc_name: Optional[str]
    india_remote: str

class CompanyFeedResponse(BaseModel):
    date: str
    companies: list[PMCompanyFeedItem]

class EODSubmitRequest(BaseModel):
    user_id: str
    day_number: int
    hardest_block: Optional[str] = None
    skipped_blocks: list[str]
    reflection: str

class TomorrowPreview(BaseModel):
    day_number: int
    title: str
    mentor_message_teaser: str

class EODSubmitResponse(BaseModel):
    streak_updated: int
    streak_broke: bool
    recovery_required: bool
    tomorrow_preview: Optional[TomorrowPreview]

class ProgressDay(BaseModel):
    day_number: int
    phase: str
    phase_label: str
    title: str
    status: str
    blocks_done_count: int
    completed_at: Optional[str]

class ProgressMapResponse(BaseModel):
    total_days: int
    days: list[ProgressDay]

# ---------- API Endpoints ----------

@router.get("/today", response_model=DailyBriefResponse)
async def get_today_brief(
    user_id: str,
    session: AsyncSession = Depends(get_db_session)
):
    user_uuid = _validate_user_uuid(user_id)
    
    # Verify user exists
    user_res = await session.execute(select(User).where(User.id == user_uuid))
    user = user_res.scalar_one_or_none()
    if not user:
        user = User(
            id=user_uuid,
            email=f"auto_created_{user_id}@example.com",
            name="Accelerator User",
            password_hash=""
        )
        session.add(user)
        await session.flush()
        logger.info(f"Auto-created missing user row for ID: {user_id}")
        
    progress = await get_or_create_today_progress(user_uuid, session)
    day_curriculum = CURRICULUM[progress.day_number]
    
    # Calculate blocks_unlocked
    allowed = get_next_allowed_block(progress.blocks_done)
    blocks_unlocked = list(progress.blocks_done)
    if allowed:
        blocks_unlocked.append(allowed)
        
    return DailyBriefResponse(
        day_number=progress.day_number,
        phase=progress.phase,
        phase_label=day_curriculum.phase_label,
        title=day_curriculum.title,
        mentor_message=day_curriculum.mentor_message,
        is_boss_day=day_curriculum.is_boss_day,
        blocks_required=progress.blocks_required,
        blocks_done=progress.blocks_done,
        blocks_unlocked=blocks_unlocked,
        started_today=progress.started_at is not None,
        eod_submitted=progress.eod_submitted,
        progress_row_id=str(progress.id),
        learn=LearnContentResponse(**day_curriculum.learn.model_dump()),
        voice=VoiceContentResponse(**day_curriculum.voice.model_dump()),
        practice=[PracticeQuestionResponse(**q.model_dump()) for q in day_curriculum.practice],
        build=BuildTaskResponse(**day_curriculum.build.model_dump()),
        network=NetworkContentResponse(**day_curriculum.network.model_dump())
    )

@router.post("/block/start", response_model=BlockStartResponse)
async def start_block(
    req: BlockStartRequest,
    session: AsyncSession = Depends(get_db_session)
):
    user_uuid = _validate_user_uuid(req.user_id)
    
    # Get user progress for the day
    progress_res = await session.execute(
        select(AcceleratorProgress)
        .where(
            and_(
                AcceleratorProgress.user_id == user_uuid,
                AcceleratorProgress.day_number == req.day_number
            )
        )
    )
    progress = progress_res.scalar_one_or_none()
    if not progress:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Progress row not found. Please call /today first."
        )
        
    # Verify order
    try:
        validate_block_order(req.block_type, progress.blocks_done)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e)
        )
        
    # Check if already started or completed
    existing_res = await session.execute(
        select(AcceleratorBlockLog)
        .where(
            and_(
                AcceleratorBlockLog.user_id == user_uuid,
                AcceleratorBlockLog.day_number == req.day_number,
                AcceleratorBlockLog.block_type == req.block_type
            )
        )
    )
    existing_log = existing_res.scalar_one_or_none()
    
    if existing_log:
        if existing_log.submitted_at is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Block already completed."
            )
        return BlockStartResponse(
            block_log_id=str(existing_log.id),
            started_at=existing_log.started_at.isoformat(),
            time_limit_sec=BLOCK_TIME_LIMITS[req.block_type]
        )
        
    # Create new block log
    now = datetime.now(timezone.utc)
    new_log = AcceleratorBlockLog(
        user_id=user_uuid,
        day_number=req.day_number,
        block_type=req.block_type,
        started_at=now
    )
    session.add(new_log)
    
    # Update progress start time if first block
    if progress.started_at is None:
        progress.started_at = now
        
    await session.flush()
    return BlockStartResponse(
        block_log_id=str(new_log.id),
        started_at=now.isoformat(),
        time_limit_sec=BLOCK_TIME_LIMITS[req.block_type]
    )

@router.post("/block/complete", response_model=BlockCompleteResponse)
async def complete_block(
    req: BlockCompleteRequest,
    session: AsyncSession = Depends(get_db_session)
):
    user_uuid = _validate_user_uuid(req.user_id)
    block_log_uuid = uuid.UUID(req.block_log_id)
    
    log_res = await session.execute(
        select(AcceleratorBlockLog).where(AcceleratorBlockLog.id == block_log_uuid)
    )
    block_log = log_res.scalar_one_or_none()
    
    if not block_log:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Block log not found."
        )
        
    if block_log.user_id != user_uuid:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden."
        )
        
    if block_log.submitted_at is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Block already completed."
        )
        
    progress_res = await session.execute(
        select(AcceleratorProgress)
        .where(
            and_(
                AcceleratorProgress.user_id == user_uuid,
                AcceleratorProgress.day_number == req.day_number
            )
        )
    )
    progress = progress_res.scalar_one_or_none()
    if not progress:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Progress row not found."
        )
        
    try:
        validate_block_order(req.block_type, progress.blocks_done)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e)
        )
        
    now = datetime.now(timezone.utc)
    time_spent_sec = int((now - block_log.started_at).total_seconds())
    was_late = time_spent_sec > BLOCK_TIME_LIMITS[req.block_type]
    
    rubric_feedback = ""
    day_curriculum = CURRICULUM[req.day_number]
    
    # Validate payload per block type
    if req.block_type == "learn":
        if not req.answer_text or len(req.answer_text.strip()) < 30:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Learn answers must be at least 30 characters."
            )
        must_have = [kw for q in day_curriculum.learn.quiz for kw in q.rubric_keywords]
        rubric_feedback = generate_rubric_feedback(req.answer_text, must_have, [])
        block_log.answer_text = req.answer_text
        
    elif req.block_type == "practice":
        if not req.answer_text or len(req.answer_text.strip()) < 30:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Practice answers must be at least 30 characters."
            )
        must_have = [kw for q in day_curriculum.practice for kw in q.rubric_must_have]
        good_have = [kw for q in day_curriculum.practice for kw in q.rubric_good_to_have]
        rubric_feedback = generate_rubric_feedback(req.answer_text, must_have, good_have)
        block_log.answer_text = req.answer_text
        
    elif req.block_type == "build":
        if not req.answer_text or len(req.answer_text.strip()) < day_curriculum.build.min_chars:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Build answers must be at least {day_curriculum.build.min_chars} characters."
            )
        block_log.answer_text = req.answer_text
        
    elif req.block_type == "apply":
        if not req.companies_logged or len(req.companies_logged) < 3:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Apply block requires logging actions for at least 3 companies."
            )
        # Log to AcceleratorApplyLog
        for company_id in req.companies_logged:
            try:
                comp_uuid = uuid.UUID(company_id)
            except ValueError:
                # Manual entry or external link without database company ID
                comp_uuid = None
            
            company_name = "Target Startup"
            if comp_uuid:
                comp_q = await session.execute(
                    select(PMCompanyFeed.company_name).where(PMCompanyFeed.id == comp_uuid)
                )
                comp_name = comp_q.scalar_one_or_none()
                if comp_name:
                    company_name = comp_name
                    
            apply_log = AcceleratorApplyLog(
                user_id=user_uuid,
                day_number=req.day_number,
                company_feed_id=comp_uuid,
                company_name=company_name,
                apply_type="direct_apply" if comp_uuid else "cold_outreach",
                applied=True,
                applied_at=now
            )
            session.add(apply_log)
            
    elif req.block_type == "network":
        if not req.network_actions_completed or len(req.network_actions_completed) < 4:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Network block requires at least 4 completed actions."
            )
        # Log to AcceleratorNetworkLog
        for idx in req.network_actions_completed:
            net_log = AcceleratorNetworkLog(
                user_id=user_uuid,
                day_number=req.day_number,
                action_index=idx,
                action_type="engage",
                completed=True,
                completed_at=now
            )
            session.add(net_log)
            
    # Update block log
    block_log.submitted_at = now
    block_log.time_spent_sec = time_spent_sec
    block_log.self_score = req.self_score
    block_log.rubric_feedback = rubric_feedback
    block_log.was_late = was_late
    
    # Update progress blocks_done (forcing SQLAlchemy to notice list mutation)
    new_blocks_done = list(progress.blocks_done)
    new_blocks_done.append(req.block_type)
    progress.blocks_done = new_blocks_done
    
    if len(progress.blocks_done) == 6:
        progress.completed_at = now
        
    await session.flush()
    
    next_unlocked = get_next_allowed_block(progress.blocks_done)
    return BlockCompleteResponse(
        success=True,
        rubric_feedback=rubric_feedback,
        next_block_unlocked=next_unlocked,
        all_blocks_done=len(progress.blocks_done) == 6
    )

@router.get("/streak", response_model=StreakResponse)
async def get_streak_info(
    user_id: str,
    session: AsyncSession = Depends(get_db_session)
):
    user_uuid = _validate_user_uuid(user_id)
    streak_data = await compute_streak(user_uuid, session)
    return StreakResponse(**streak_data)

@router.get("/companies/today", response_model=CompanyFeedResponse)
async def get_daily_companies(
    user_id: str,
    session: AsyncSession = Depends(get_db_session)
):
    user_uuid = _validate_user_uuid(user_id)
    companies = await get_company_feed_for_today(user_uuid, session)
    
    items = []
    for c in companies:
        items.append(
            PMCompanyFeedItem(
                id=str(c.id),
                company_name=c.company_name,
                company_url=c.company_url,
                role_title=c.role_title,
                apply_url=c.apply_url,
                feed_type=c.feed_type,
                source=c.source,
                vc_backed=c.vc_backed,
                vc_name=c.vc_name,
                india_remote=c.india_remote
            )
        )
        
    return CompanyFeedResponse(
        date=get_ist_today().isoformat(),
        companies=items
    )

@router.post("/eod/submit", response_model=EODSubmitResponse)
async def submit_eod(
    req: EODSubmitRequest,
    session: AsyncSession = Depends(get_db_session)
):
    user_uuid = _validate_user_uuid(req.user_id)
    
    progress_res = await session.execute(
        select(AcceleratorProgress)
        .where(
            and_(
                AcceleratorProgress.user_id == user_uuid,
                AcceleratorProgress.day_number == req.day_number
            )
        )
    )
    progress = progress_res.scalar_one_or_none()
    if not progress:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Progress row not found."
        )
        
    if progress.eod_submitted:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="EOD already submitted."
        )
        
    # Streak evaluation
    all_done = len(progress.blocks_done) == 6
    streak_broke = False
    
    if len(req.skipped_blocks) >= 2 or (not all_done and len(req.skipped_blocks) >= 2):
        progress.streak_broken = True
        progress.streak_count = 0
        streak_broke = True
    elif len(req.skipped_blocks) == 1:
        # Pause streak (keep existing value)
        pass
    else:
        # All required blocks done (no skips logged in skipped_blocks)
        # Fetch current streak count to increment it
        streak_info = await compute_streak(user_uuid, session)
        new_streak = streak_info["current_streak"] + 1
        progress.streak_count = new_streak
        
    progress.eod_submitted = True
    progress.eod_reflection = req.reflection
    
    await session.flush()
    
    # Build tomorrow's preview if day_number < 45
    tomorrow_preview = None
    if req.day_number < 45:
        tomorrow_day = req.day_number + 1
        tomorrow_curriculum = CURRICULUM[tomorrow_day]
        tomorrow_preview = TomorrowPreview(
            day_number=tomorrow_day,
            title=tomorrow_curriculum.title,
            mentor_message_teaser=tomorrow_curriculum.mentor_message[:100]
        )
        
    streak_info_updated = await compute_streak(user_uuid, session)
    
    return EODSubmitResponse(
        streak_updated=streak_info_updated["current_streak"],
        streak_broke=streak_broke,
        recovery_required=streak_info_updated["recovery_required"],
        tomorrow_preview=tomorrow_preview
    )

@router.get("/progress", response_model=ProgressMapResponse)
async def get_progress_map(
    user_id: str,
    session: AsyncSession = Depends(get_db_session)
):
    user_uuid = _validate_user_uuid(user_id)
    
    # Query progress history
    q = await session.execute(
        select(AcceleratorProgress)
        .where(AcceleratorProgress.user_id == user_uuid)
        .order_by(AcceleratorProgress.day_number.asc())
    )
    progress_rows = {p.day_number: p for p in q.scalars().all()}
    
    days = []
    today_progress = await get_or_create_today_progress(user_uuid, session)
    
    for d_num in range(1, 46):
        curriculum_day = CURRICULUM[d_num]
        
        status_val = "locked"
        blocks_done_count = 0
        completed_at = None
        
        if d_num in progress_rows:
            p_row = progress_rows[d_num]
            blocks_done_count = len(p_row.blocks_done)
            completed_at = p_row.completed_at.isoformat() if p_row.completed_at else None
            
            if p_row.date == get_ist_today():
                status_val = "today"
            elif blocks_done_count == 6 and p_row.eod_submitted:
                status_val = "done"
            else:
                status_val = "missed"
        else:
            if d_num < today_progress.day_number:
                status_val = "missed"
            elif d_num == today_progress.day_number:
                status_val = "today"
                blocks_done_count = len(today_progress.blocks_done)
                completed_at = today_progress.completed_at.isoformat() if today_progress.completed_at else None
                
        days.append(
            ProgressDay(
                day_number=d_num,
                phase=curriculum_day.phase,
                phase_label=curriculum_day.phase_label,
                title=curriculum_day.title,
                status=status_val,
                blocks_done_count=blocks_done_count,
                completed_at=completed_at
            )
        )
        
    return ProgressMapResponse(
        total_days=45,
        days=days
    )
