"""Root API routes for scanning and card interactions."""

import logging
import uuid
import re
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, field_validator, ConfigDict
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Company, Card, GapCluster, FixabilityFlag, RoleMatch, User, UserProfile, EvidenceItem, JobPosting
from app.db.session import get_db_session
from app.services.security import validate_url
from app.services.scan_orchestrator import scan_company

logger = logging.getLogger(__name__)

router = APIRouter(tags=["root"])


# ---------- Request / Response Schemas ----------

class ScanRequest(BaseModel):
    user_id: str
    company_url: str


class CompanyResponse(BaseModel):
    id: str
    name: str
    url: str
    github_repo_url: str | None
    careers_page_url: str | None
    last_scanned_at: str | None


class GapClusterResponse(BaseModel):
    id: str
    company_id: str
    label: str
    evidence_item_ids: list[str]
    evidence_count: int
    recency_score: float
    rank_score: float

    model_config = ConfigDict(populate_by_name=True)


class EvidenceItemResponse(BaseModel):
    id: str
    company_id: str
    source_type: str
    source_url: str
    raw_text: str
    author_handle: str | None
    posted_at: str | None
    fetched_at: str


class FixabilityFlagsResponse(BaseModel):
    id: str
    gap_cluster_id: str
    has_public_repo: bool
    has_public_api: bool
    has_ui_surface: bool
    is_buildable: bool


class JobPostingResponse(BaseModel):
    id: str
    company_id: str
    title: str
    raw_text: str
    posted_at: str | None
    is_open: bool


class RoleMatchResponse(BaseModel):
    job_posting: JobPostingResponse
    match_score: float


class OpportunityCardView(BaseModel):
    card: dict
    gap_cluster: dict
    company: dict
    evidence_items: list[dict]
    fixability_flags: dict
    role_match: dict | None = None
    why_matches_you: str


class ScanDebugInfo(BaseModel):
    scan_status: str
    evidence_count: int
    searched_as: list[str]
    sources_tried: list[str]
    github_discovered: bool
    suggestion: str | None = None


class ScanResponse(BaseModel):
    company: CompanyResponse
    cards: list[OpportunityCardView]
    debug_info: ScanDebugInfo | None = None


class CardStatusUpdateRequest(BaseModel):
    status: str

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str) -> str:
        valid = {"new", "selected", "dismissed"}
        if v not in valid:
            raise ValueError("status must be 'new', 'selected', or 'dismissed'")
        return v


class CardStatusUpdateResponse(BaseModel):
    card_id: str
    status: str


class CardsResponse(BaseModel):
    cards: list[OpportunityCardView]


# ---------- Helpers ----------

# Common vanity landing-page prefixes that are NOT part of the brand name.
# e.g. getunkey.com → Unkey, tryreplit.com → Replit
_VANITY_PREFIXES = frozenset({
    "get", "try", "use", "go", "my", "the",
    "join", "with", "by", "hey", "hi", "meet",
})


def extract_company_name_from_url(url: str) -> str:
    """Extract and capitalize a company name from a website or GitHub URL.

    Strips common vanity prefixes so that:
      getunkey.com  → Unkey
      tryreplit.com → Replit
      linear.app    → Linear  (unchanged)
      github.com/langfuse/langfuse → Langfuse
    """
    clean = re.sub(r'^https?://(www\.)?', '', url.lower())
    if clean.startswith("github.com/"):
        parts = clean.split('/')
        if len(parts) >= 3:
            label = parts[2].split('?')[0].split('#')[0]
        elif len(parts) == 2:
            label = parts[1].split('?')[0].split('#')[0]
        else:
            label = "unknown"
        return label.capitalize()

    domain = clean.split('/')[0]
    parts = domain.split('.')
    label = parts[-2] if len(parts) >= 2 else parts[0]

    # Strip vanity prefix only if the remaining string is >= 4 chars.
    # This prevents: appsmith → smith (4-char guard stops it)
    # But allows: getunkey → unkey (5 chars remaining, fine)
    for prefix in _VANITY_PREFIXES:
        if label.startswith(prefix) and len(label) > len(prefix) + 2:
            stripped = label[len(prefix):]
            if len(stripped) >= 3:  # require meaningful remainder (3+ chars covers 'dbt', 'box', etc.)
                label = stripped
            break

    return label.capitalize()


async def enrich_cards_for_user(
    user_uuid: uuid.UUID,
    db: AsyncSession,
    company_uuid: uuid.UUID | None = None
) -> list[dict]:
    """Retrieve and fully enrich opportunity cards for a user."""
    if company_uuid:
        stmt_cards = select(Card).where(
            Card.user_id == user_uuid, Card.company_id == company_uuid
        )
    else:
        stmt_cards = select(Card).where(Card.user_id == user_uuid)

    res_cards = await db.execute(stmt_cards)
    cards = list(res_cards.scalars().all())

    enriched = []
    for card in cards:
        # Load associated gap cluster
        stmt_cluster = select(GapCluster).where(GapCluster.id == card.gap_cluster_id)
        cluster = (await db.execute(stmt_cluster)).scalar_one_or_none()
        if not cluster:
            continue

        # Load fixability flags
        stmt_flag = select(FixabilityFlag).where(
            FixabilityFlag.id == card.fixability_flag_id
        )
        flag = (await db.execute(stmt_flag)).scalar_one_or_none()

        # Load role match and job posting
        role_match_detail = None
        if card.role_match_id:
            stmt_role = select(RoleMatch).where(RoleMatch.id == card.role_match_id)
            role_match = (await db.execute(stmt_role)).scalar_one_or_none()
            if role_match:
                stmt_job = select(JobPosting).where(
                    JobPosting.id == role_match.job_posting_id
                )
                job = (await db.execute(stmt_job)).scalar_one_or_none()
                if job:
                    role_match_detail = {
                        "job_posting": {
                            "id": str(job.id),
                            "company_id": str(job.company_id),
                            "title": job.title,
                            "raw_text": job.raw_text,
                            "posted_at": job.posted_at.isoformat() if job.posted_at else None,
                            "is_open": job.is_open,
                        },
                        "match_score": role_match.match_score,
                    }

        # Load evidence items
        evidence_details = []
        if cluster.evidence_item_ids:
            stmt_ev = select(EvidenceItem).where(
                EvidenceItem.id.in_(cluster.evidence_item_ids)
            )
            evidence_items = (await db.execute(stmt_ev)).scalars().all()
            for ev in evidence_items:
                if ev.source_url and ev.source_url.strip():
                    evidence_details.append(
                        {
                            "id": str(ev.id),
                            "company_id": str(ev.company_id),
                            "source_type": ev.source_type,
                            "source_url": ev.source_url,
                            "raw_text": ev.raw_text,
                            "author_handle": ev.author_handle,
                            "posted_at": ev.posted_at.isoformat() if ev.posted_at else None,
                            "fetched_at": ev.fetched_at.isoformat() if ev.fetched_at else datetime.now(timezone.utc).isoformat(),
                        }
                    )

        # CRITICAL constraint: No real clickable source_url = skip card
        if not evidence_details:
            continue

        # Load company
        stmt_company = select(Company).where(Company.id == card.company_id)
        company_obj = (await db.execute(stmt_company)).scalar_one_or_none()
        if not company_obj:
            continue

        # Load user profile to generate explanation
        user_skills = []
        user_domains = []
        stmt_profile = select(UserProfile).where(UserProfile.user_id == user_uuid)
        profile = (await db.execute(stmt_profile)).scalar_one_or_none()
        if profile:
            user_skills = profile.parsed_skills
            user_domains = profile.parsed_domains

        from app.services.prompt_generator import get_matching_skill_and_domain
        evidence_text_combined = " ".join(ev["raw_text"] for ev in evidence_details)
        matching_skill, gap_domain = get_matching_skill_and_domain(
            user_skills,
            user_domains,
            evidence_text_combined or cluster.label,
            cluster.label,
        )
        why_matches_you = f"You listed {matching_skill} — this gap involves {gap_domain}."

        # Auto-update shown_at on retrieve
        if card.shown_at is None:
            card.shown_at = datetime.now(timezone.utc)
            db.add(card)

        enriched_card = {
            "card": {
                "id": str(card.id),
                "user_id": str(card.user_id),
                "gap_cluster_id": str(card.gap_cluster_id),
                "profile_match_score": max(0.0, min(100.0, card.profile_match_score * 100.0)),
                "shown_at": card.shown_at.isoformat(),
                "status": card.status,
            },
            "gap_cluster": {
                "id": str(cluster.id),
                "company_id": str(cluster.company_id),
                "label": cluster.label,
                "evidence_item_ids": [str(eid) for eid in cluster.evidence_item_ids],
                "evidence_count": cluster.evidence_count,
                "recency_score": cluster.recency_score,
                "rank_score": max(0.0, min(100.0, cluster.rank_score * 100.0)),
            },
            "company": {
                "id": str(company_obj.id),
                "name": company_obj.name,
                "url": company_obj.url,
                "github_repo_url": company_obj.github_repo_url,
                "careers_page_url": company_obj.careers_page_url,
                "last_scanned_at": company_obj.last_scanned_at.isoformat() if company_obj.last_scanned_at else None,
            },
            "evidence_items": evidence_details,
            "fixability_flags": {
                "id": str(flag.id) if flag else str(uuid.uuid4()),
                "gap_cluster_id": str(cluster.id),
                "has_public_repo": flag.has_public_repo if flag else False,
                "has_public_api": flag.has_public_api if flag else False,
                "has_ui_surface": flag.has_ui_surface if flag else True,
                "is_buildable": sum([
                    flag.has_public_repo if flag else False,
                    flag.has_public_api if flag else False,
                    flag.has_ui_surface if flag else True
                ]) >= 2,
            },
            "why_matches_you": why_matches_you,
        }
        if role_match_detail:
            enriched_card["role_match"] = role_match_detail

        enriched.append(enriched_card)

    await db.commit()
    # Sort by profile_match_score descending
    enriched.sort(key=lambda x: x["card"]["profile_match_score"], reverse=True)
    return enriched


# ---------- Endpoints ----------

@router.post("/scan", response_model=ScanResponse)
async def scan_company_root(
    payload: ScanRequest,
    force: bool = False,
    db: AsyncSession = Depends(get_db_session)
) -> dict:
    """Scan a company URL or name, run the pipeline, and return user card matches.

    Args:
        force: If True, bypass the 6-hour cache even for 'done' scans.
               Always bypassed for 'insufficient_signal' companies.
    """
    try:
        user_uuid = uuid.UUID(payload.user_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid user_id format",
        )

    # 1. Resolve / Clean URL and Name
    company_input = payload.company_url.strip()
    is_url = (
        company_input.startswith("http://")
        or company_input.startswith("https://")
        or "." in company_input
    )

    company_url = company_input
    if not is_url:
        company_name = company_input
        company_url = f"https://{company_name.lower().replace(' ', '')}.com"
    else:
        company_name = extract_company_name_from_url(company_input)

    try:
        company_url = validate_url(company_url)
    except Exception as e:
        pass

    # 2. Get or create Company
    stmt = select(Company).where(
        (Company.url == company_url) |
        (Company.github_repo_url == company_url) |
        (Company.name.ilike(company_name))
    )
    res = await db.execute(stmt)
    company = res.scalar_one_or_none()

    if not company:
        github_repo = None
        url = company_url
        if "github.com/" in company_url:
            github_repo = company_url
            url = f"https://{company_name.lower()}.com"

        company = Company(
            name=company_name,
            url=url,
            github_repo_url=github_repo,
            scan_status="pending",
        )
        db.add(company)
        await db.flush()

    # 3. Run the scan orchestrator pipeline (non-blocking Stage 6 included)
    scan_result: dict = {}
    try:
        scan_result = await scan_company(
            str(company.id), db, user_id=str(user_uuid), force=force
        )
    except Exception as e:
        logger.error("Pipeline scan failed: %s", e)
        scan_result = {"status": "failed", "evidence_count": 0, "sources_tried": [], "searched_as": [], "github_discovered": False}

    # 4. Enrich and return matched cards
    cards = await enrich_cards_for_user(user_uuid, db, company.id)

    # 5. Build debug_info to help user understand empty results
    debug_info = None
    scan_status = scan_result.get("status", company.scan_status or "unknown")
    evidence_count = scan_result.get("evidence_count", 0)
    searched_as = scan_result.get("searched_as", [company_name])
    sources_tried = scan_result.get("sources_tried", [])
    github_discovered = scan_result.get("github_discovered", False)

    suggestion = None
    if not cards:
        if scan_status == "insufficient_signal":
            if "github.com" not in company_input:
                suggestion = (
                    f"We searched for '{company_name}' on Reddit and Hacker News but found fewer than 3 results. "
                    f"Try pasting the company's GitHub repo URL (e.g. https://github.com/org/repo) "
                    f"or add ?force=true to retry immediately."
                )
            else:
                suggestion = (
                    f"We searched GitHub Issues, Reddit, and HN but found very little signal for '{company_name}'. "
                    f"This company may be too new or too niche. Try again in a few weeks as they grow."
                )
        elif scan_status == "done" and evidence_count > 0:
            suggestion = (
                f"We found {evidence_count} evidence items but none matched your profile well enough to generate a card. "
                f"Update your profile with more skills, or try a different company."
            )
        elif scan_status == "cached":
            suggestion = (
                f"Serving a cached scan from within the last 6 hours. "
                f"Add ?force=true to force a fresh scan now."
            )

    debug_info = {
        "scan_status": scan_status,
        "evidence_count": evidence_count,
        "searched_as": searched_as,
        "sources_tried": sources_tried,
        "github_discovered": github_discovered,
        "suggestion": suggestion,
    }

    return {
        "company": {
            "id": str(company.id),
            "name": company.name,
            "url": company.url,
            "github_repo_url": company.github_repo_url,
            "careers_page_url": company.careers_page_url,
            "last_scanned_at": company.last_scanned_at.isoformat() if company.last_scanned_at else None,
        },
        "cards": cards,
        "debug_info": debug_info,
    }


@router.get("/cards", response_model=CardsResponse)
async def get_cards_root(
    user_id: str,
    db: AsyncSession = Depends(get_db_session)
) -> dict:
    """Retrieve and fully enrich all opportunity cards for a user."""
    try:
        user_uuid = uuid.UUID(user_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid user_id format",
        )

    cards = await enrich_cards_for_user(user_uuid, db)
    return {"cards": cards}


@router.patch("/cards/{card_id}/status", response_model=CardStatusUpdateResponse)
async def update_card_status_root(
    card_id: str,
    payload: CardStatusUpdateRequest,
    db: AsyncSession = Depends(get_db_session)
) -> dict:
    """Update status of a card (e.g. dismissed or selected)."""
    try:
        card_uuid = uuid.UUID(card_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid card_id format",
        )

    stmt = select(Card).where(Card.id == card_uuid)
    res = await db.execute(stmt)
    card = res.scalar_one_or_none()
    if not card:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Card not found",
        )

    card.status = payload.status
    card.updated_at = datetime.now(timezone.utc)
    db.add(card)
    await db.commit()

    return {
        "card_id": str(card.id),
        "status": card.status,
    }
