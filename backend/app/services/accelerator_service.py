import json
import os
import uuid
import hashlib
import random
from datetime import datetime, date, timezone, timedelta
from zoneinfo import ZoneInfo
from typing import Optional, Any
from pydantic import BaseModel, Field
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import (
    PMCompanyFeed,
    AcceleratorProgress,
    AcceleratorBlockLog,
    AcceleratorNetworkLog,
    AcceleratorApplyLog,
    User
)

# --- Pydantic Models for Curriculum Validation ---

class QuizQuestion(BaseModel):
    question: str
    rubric_hint: str
    rubric_keywords: list[str]

class LearnContent(BaseModel):
    concept: str
    body: str
    resource_url: str
    resource_label: str
    quiz: list[QuizQuestion]

class VoiceContent(BaseModel):
    prompt: str
    tool_url: str
    duration_min: int

class PracticeQuestion(BaseModel):
    type: str
    question: str
    time_limit_min: int
    rubric_must_have: list[str]
    rubric_good_to_have: list[str]

class BuildTask(BaseModel):
    task: str
    output_type: str
    min_chars: int
    duration_min: int

class NetworkActionSpec(BaseModel):
    index: int
    type: str
    instruction: str

class NetworkContent(BaseModel):
    actions: list[NetworkActionSpec]

class CurriculumDay(BaseModel):
    day: int
    phase: str
    phase_label: str
    title: str
    mentor_message: str
    is_boss_day: bool
    learn: LearnContent
    voice: VoiceContent
    practice: list[PracticeQuestion]
    build: BuildTask
    network: NetworkContent

# --- Global Configurations ---

BLOCK_ORDER = ["learn", "voice", "practice", "build", "apply", "network"]

BLOCK_TIME_LIMITS = {
    "learn": 5400,      # 90 min
    "voice": 1200,      # 20 min
    "practice": 3300,   # 55 min
    "build": 3600,      # 60 min
    "apply": 4500,      # 75 min
    "network": 2700     # 45 min
}

# --- Load Curriculum at Startup ---

def load_curriculum() -> dict[int, CurriculumDay]:
    """Load curriculum from JSON and validate schema."""
    json_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "accelerator_curriculum.json")
    if not os.path.exists(json_path):
        raise RuntimeError(f"Curriculum JSON missing at {json_path}")
    
    with open(json_path, "r", encoding="utf-8") as f:
        raw_data = json.load(f)
        
    curriculum = {}
    for item in raw_data:
        try:
            day_data = CurriculumDay(**item)
            curriculum[day_data.day] = day_data
        except Exception as e:
            raise RuntimeError(f"Validation failed for day {item.get('day')}: {e}")
            
    if len(curriculum) != 45:
         raise RuntimeError(f"Curriculum must have exactly 45 days. Found {len(curriculum)}")
         
    return curriculum

CURRICULUM = load_curriculum()

# --- Core Service Functions ---

def get_ist_now() -> datetime:
    return datetime.now(ZoneInfo("Asia/Kolkata"))

def get_ist_today() -> date:
    return get_ist_now().date()

async def get_or_create_today_progress(
    user_id: uuid.UUID,
    session: AsyncSession,
) -> AcceleratorProgress:
    """Find or create today's AcceleratorProgress row."""
    today_ist = get_ist_today()
    
    # 1. Fetch user's start date (earliest progress date)
    start_q = await session.execute(
        select(AcceleratorProgress.date)
        .where(AcceleratorProgress.user_id == user_id)
        .order_by(AcceleratorProgress.date.asc())
    )
    all_dates = start_q.scalars().all()
    
    if not all_dates:
        # User is starting today
        day_number = 1
        start_date = today_ist
    else:
        first_date = all_dates[0]
        day_number = (today_ist - first_date).days + 1
        day_number = max(1, min(45, day_number))  # clamp to 1..45
    
    # 2. Check if today's progress row already exists
    today_q = await session.execute(
        select(AcceleratorProgress)
        .where(
            and_(
                AcceleratorProgress.user_id == user_id,
                AcceleratorProgress.date == today_ist
            )
        )
    )
    today_progress = today_q.scalar_one_or_none()
    
    if today_progress:
        return today_progress
        
    # 3. Create today's progress row if it doesn't exist
    day_curriculum = CURRICULUM[day_number]
    
    # Check if there is already a row for this day_number (in case of timezone anomalies or manually set rows)
    day_num_q = await session.execute(
        select(AcceleratorProgress)
        .where(
            and_(
                AcceleratorProgress.user_id == user_id,
                AcceleratorProgress.day_number == day_number
            )
        )
    )
    existing_day = day_num_q.scalar_one_or_none()
    if existing_day:
        return existing_day
        
    new_progress = AcceleratorProgress(
        user_id=user_id,
        day_number=day_number,
        phase=day_curriculum.phase,
        date=today_ist,
        blocks_required=BLOCK_ORDER,
        blocks_done=[],
        streak_count=0,
        streak_broken=False,
        eod_submitted=False
    )
    
    session.add(new_progress)
    await session.flush()  # populate ID
    return new_progress

async def compute_streak(
    user_id: uuid.UUID,
    session: AsyncSession,
) -> dict[str, Any]:
    """Compute current and longest streak from progress history."""
    q = await session.execute(
        select(AcceleratorProgress)
        .where(AcceleratorProgress.user_id == user_id)
        .order_by(AcceleratorProgress.day_number.asc())
    )
    rows = q.scalars().all()
    
    if not rows:
        return {
            "current_streak": 0,
            "longest_streak": 0,
            "total_days_completed": 0,
            "last_completed_date": None,
            "milestones_unlocked": [],
            "recovery_required": False
        }
        
    today_ist = get_ist_today()
    yesterday_ist = today_ist - timedelta(days=1)
    
    completed_days = []
    last_completed_date = None
    
    for row in rows:
        is_completed = len(row.blocks_done) == 6 and row.eod_submitted
        if is_completed:
            completed_days.append(row)
            last_completed_date = row.date
            
    completed_dates = sorted(list({r.date for r in completed_days}))
    
    if completed_dates:
        longest_streak = 1
        temp_streak = 1
        for i in range(1, len(completed_dates)):
            if (completed_dates[i] - completed_dates[i-1]).days == 1:
                temp_streak += 1
            else:
                temp_streak = 1
            longest_streak = max(longest_streak, temp_streak)
            
        if today_ist in completed_dates or yesterday_ist in completed_dates:
            current_streak = 1
            check_date = yesterday_ist if today_ist not in completed_dates else today_ist
            while True:
                prev_check = check_date - timedelta(days=1)
                if prev_check in completed_dates:
                    current_streak += 1
                    check_date = prev_check
                else:
                    break
        else:
            current_streak = 0
    else:
        current_streak = 0
        longest_streak = 0

    milestones_unlocked = []
    for m in [7, 15, 30, 45]:
        if longest_streak >= m:
            milestones_unlocked.append(m)
            
    recovery_required = False
    if completed_dates:
        days_since_last = (today_ist - completed_dates[-1]).days
        if days_since_last > 1:
            recovery_required = True

    return {
        "current_streak": current_streak,
        "longest_streak": longest_streak,
        "total_days_completed": len(completed_dates),
        "last_completed_date": last_completed_date.isoformat() if last_completed_date else None,
        "milestones_unlocked": milestones_unlocked,
        "recovery_required": recovery_required
    }

def generate_rubric_feedback(
    answer_text: str,
    rubric_must_have: list[str],
    rubric_good_to_have: list[str],
) -> str:
    """Generate plain-text checklist feedback based on keyword matching."""
    if not answer_text or len(answer_text.strip()) < 30:
        return "No substantive answer submitted."
        
    answer_lower = answer_text.lower()
    covered_must = []
    missing_must = []
    
    for kw in rubric_must_have:
        if kw.lower() in answer_lower:
            covered_must.append(kw)
        else:
            missing_must.append(kw)
            
    covered_good = []
    for kw in rubric_good_to_have:
        if kw.lower() in answer_lower:
            covered_good.append(kw)
            
    feedback = []
    if not missing_must:
         feedback.append("Strong answer. All core criteria met!")
    else:
         feedback.append("Criteria Checklist Assessment:")
         
    feedback.append(f"✅ Covered: {', '.join(covered_must) if covered_must else 'None'}")
    if missing_must:
        feedback.append(f"⚠️ Missing: {', '.join(missing_must)}")
        feedback.append(f"💡 Tip: Make sure to elaborate on '{missing_must[0]}' to satisfy the core evaluation requirements.")
        
    if covered_good:
        feedback.append(f"✨ Bonus items addressed: {', '.join(covered_good)}")
        
    return "\n".join(feedback)

async def get_company_feed_for_today(
    user_id: uuid.UUID,
    session: AsyncSession,
) -> list[PMCompanyFeed]:
    """Deterministic-random daily feed of 5 companies."""
    today_str = get_ist_today().isoformat()
    seed_str = f"{user_id}{today_str}"
    seed_val = int(hashlib.sha256(seed_str.encode("utf-8")).hexdigest()[:8], 16)
    rand = random.Random(seed_val)
    
    q = await session.execute(
        select(PMCompanyFeed)
        .where(
            and_(
                PMCompanyFeed.is_active == True,
                (PMCompanyFeed.expires_at == None) | (PMCompanyFeed.expires_at > func.now())
            )
        )
    )
    all_companies = q.scalars().all()
    
    groups = {
        "active_listing": [],
        "cold_target": [],
        "community_lead": [],
        "stretch": []
    }
    for c in all_companies:
        if c.feed_type in groups:
            groups[c.feed_type].append(c)
            
    selected = []
    
    mix_requirements = [
        ("active_listing", 2),
        ("cold_target", 1),
        ("community_lead", 1),
        ("stretch", 1)
    ]
    
    for feed_type, count in mix_requirements:
        options = groups[feed_type]
        if len(options) >= count:
            selected_items = rand.sample(options, count)
            selected.extend(selected_items)
        else:
            selected.extend(options)
            needed = count - len(options)
            backup_options = [c for c in groups["active_listing"] if c not in selected]
            if len(backup_options) >= needed:
                selected.extend(rand.sample(backup_options, needed))
            else:
                selected.extend(backup_options)
                
    if len(selected) < 5:
        remaining = [c for c in all_companies if c not in selected]
        needed = 5 - len(selected)
        if len(remaining) >= needed:
            selected.extend(rand.sample(remaining, needed))
        else:
            selected.extend(remaining)
            
    return selected[:5]

def get_next_allowed_block(blocks_done: list[str]) -> Optional[str]:
    for b in BLOCK_ORDER:
        if b not in blocks_done:
            return b
    return None

def validate_block_order(block_type: str, blocks_done: list[str]) -> None:
    if block_type not in BLOCK_ORDER:
         raise ValueError(f"Invalid block_type: {block_type}")
    
    allowed = get_next_allowed_block(blocks_done)
    if allowed != block_type:
        raise ValueError(f"Block out of order. Expected: {allowed}, got: {block_type}")
