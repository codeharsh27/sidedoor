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
    scan_status: str

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


class ScanResponse(BaseModel):
    company: CompanyResponse
    cards: list[OpportunityCardView]


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

def extract_company_name_from_url(url: str) -> str:
    """Extract and capitalize a company name from a website or GitHub URL."""
    clean = re.sub(r'^https?://(www\.)?', '', url.lower())
    if clean.startswith("github.com/"):
        parts = clean.split('/')
        if len(parts) >= 3:
            return parts[2].split('?')[0].split('#')[0].capitalize()
        elif len(parts) == 2:
            return parts[1].split('?')[0].split('#')[0].capitalize()
    domain = clean.split('/')[0]
    parts = domain.split('.')
    if len(parts) >= 2:
        return parts[-2].capitalize()
    return parts[0].capitalize()


async def enrich_cards_for_user(
    user_uuid: uuid.UUID,
    db: AsyncSession,
    company_uuid: uuid.UUID | None = None
) -> list[dict]:
    """Retrieve and fully enrich opportunity cards for a user."""
    from sqlalchemy.orm import selectinload

    # Fetch user profile once
    stmt_profile = select(UserProfile).where(UserProfile.user_id == user_uuid)
    profile = (await db.execute(stmt_profile)).scalar_one_or_none()
    user_skills = profile.parsed_skills if profile else []
    user_domains = profile.parsed_domains if profile else []

    stmt_cards = select(Card).where(Card.user_id == user_uuid)
    if company_uuid:
        stmt_cards = stmt_cards.where(Card.company_id == company_uuid)
        
    stmt_cards = stmt_cards.options(
        selectinload(Card.gap_cluster),
        selectinload(Card.company),
        selectinload(Card.fixability_flag),
        selectinload(Card.role_match).selectinload(RoleMatch.job_posting)
    )

    res_cards = await db.execute(stmt_cards)
    cards = list(res_cards.scalars().all())

    if not cards:
        return []

    # Batch fetch all evidence items needed across all gap clusters
    all_evidence_ids = set()
    for card in cards:
        if card.gap_cluster and card.gap_cluster.evidence_item_ids:
            all_evidence_ids.update(card.gap_cluster.evidence_item_ids)
            
    evidence_items_by_id = {}
    if all_evidence_ids:
        stmt_ev = select(EvidenceItem).where(EvidenceItem.id.in_(all_evidence_ids))
        all_evidence_items = (await db.execute(stmt_ev)).scalars().all()
        evidence_items_by_id = {ev.id: ev for ev in all_evidence_items}

    from app.services.prompt_generator import get_matching_skill_and_domain
    
    enriched = []
    for card in cards:
        cluster = card.gap_cluster
        if not cluster:
            continue
            
        company_obj = card.company
        if not company_obj:
            continue

        flag = card.fixability_flag

        role_match_detail = None
        if card.role_match and card.role_match.job_posting:
            job = card.role_match.job_posting
            role_match_detail = {
                "job_posting": {
                    "id": str(job.id),
                    "company_id": str(job.company_id),
                    "title": job.title,
                    "raw_text": job.raw_text,
                    "posted_at": job.posted_at.isoformat() if job.posted_at else None,
                    "is_open": job.is_open,
                },
                "match_score": card.role_match.match_score,
            }

        evidence_details = []
        if cluster.evidence_item_ids:
            for eid in cluster.evidence_item_ids:
                ev = evidence_items_by_id.get(eid)
                if ev and ev.source_url and ev.source_url.strip():
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

        if not evidence_details:
            continue

        evidence_text_combined = " ".join(ev["raw_text"] for ev in evidence_details)
        matching_skill, gap_domain = get_matching_skill_and_domain(
            user_skills,
            user_domains,
            evidence_text_combined or cluster.label,
            cluster.label,
        )
        why_matches_you = f"You listed {matching_skill} — this gap involves {gap_domain}."

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
                "fixability_type": flag.fixability_type if flag else "too_vague",
                "fixability_reason": flag.fixability_reason if flag else None,
                "is_buildable": flag.fixability_type in ("direct_surface", "stated_pain_point") if flag else False,
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
    db: AsyncSession = Depends(get_db_session)
) -> dict:
    """Scan a company URL or name, run the pipeline, and return user card matches."""
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
        company_url = await validate_url(company_url)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

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
    try:
        await scan_company(str(company.id), db, user_id=str(user_uuid))
    except Exception as e:
        logger.error("Pipeline scan failed: %s", e)
        raise HTTPException(status_code=500, detail="Pipeline scan failed")

    # 4. Enrich and return matched cards
    cards = await enrich_cards_for_user(user_uuid, db, company.id)

    return {
        "company": {
            "id": str(company.id),
            "name": company.name,
            "url": company.url,
            "github_repo_url": company.github_repo_url,
            "careers_page_url": company.careers_page_url,
            "last_scanned_at": company.last_scanned_at.isoformat() if company.last_scanned_at else None,
            "scan_status": company.scan_status,
        },
        "cards": cards,
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


@router.get("/pipeline-log/{company_name}")
async def get_pipeline_log(
    company_name: str,
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    """
    Debug endpoint: returns a full pipeline summary for a company scan.
    Satisfies the PRD requirement that every stage logs why a gap was surfaced or dropped,
    without requiring a manual DB query.

    Returns:
      - company metadata (name, scan_status, last_scanned_at)
      - evidence_count: how many items survived collection
      - cluster summary: count + per-cluster label, rank_score, fixability_type, fixability_reason, is_buildable
      - card_count: how many cards were ultimately generated
    """
    stmt = select(Company).where(Company.name.ilike(company_name))
    company = (await db.execute(stmt)).scalar_one_or_none()
    if not company:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Company '{company_name}' not found",
        )

    # Evidence count
    from app.db.models import EvidenceItem, GapCluster, FixabilityFlag, Card
    ev_count_res = await db.execute(
        select(EvidenceItem).where(EvidenceItem.company_id == company.id)
    )
    evidence_items = ev_count_res.scalars().all()

    # Clusters + fixability
    clusters_res = await db.execute(
        select(GapCluster).where(GapCluster.company_id == company.id)
    )
    clusters = clusters_res.scalars().all()

    cluster_details = []
    for c in clusters:
        flag_res = await db.execute(
            select(FixabilityFlag).where(FixabilityFlag.gap_cluster_id == c.id)
        )
        flag = flag_res.scalar_one_or_none()
        cluster_details.append({
            "label": c.label,
            "evidence_count": c.evidence_count,
            "rank_score": round(c.rank_score, 3),
            "recency_score": round(c.recency_score, 3),
            "fixability_type": flag.fixability_type if flag else "not_computed",
            "fixability_reason": flag.fixability_reason if flag else None,
            "is_buildable": flag.fixability_type in ("direct_surface", "stated_pain_point") if flag else None,
        })

    # Card count
    cards_res = await db.execute(
        select(Card).where(Card.company_id == company.id)
    )
    cards = cards_res.scalars().all()

    return {
        "company": {
            "name": company.name,
            "url": company.url,
            "scan_status": company.scan_status,
            "last_scanned_at": company.last_scanned_at.isoformat() if company.last_scanned_at else None,
        },
        "pipeline_summary": {
            "evidence_collected": len(evidence_items),
            "clusters_formed": len(clusters),
            "cards_generated": len(cards),
        },
        "clusters": cluster_details,
        "interpretation": (
            "scan_status='insufficient_signal' means fewer than 3 evidence items survived collection."
            if company.scan_status == "insufficient_signal"
            else f"scan_status='{company.scan_status}'"
        ),
    }

