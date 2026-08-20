"""API routes for company management and scanning."""

import asyncio
import json
import logging
import uuid
from datetime import datetime, timezone, timedelta
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, ConfigDict
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Company, EvidenceItem, JobPosting
from app.db.session import get_db_session
from app.services.security import validate_url, InvalidURLError, SSRFBlockedError
from app.services.scan_orchestrator import scan_company

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/company", tags=["company"])

DOSSIER_CACHE_TTL_HOURS = 24


# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------

class CompanyCreate(BaseModel):
    """Schema for creating a company."""
    name: str = Field(..., min_length=1, max_length=255)
    url: str = Field(..., description="Company homepage URL")
    github_repo_url: str | None = Field(None)
    careers_page_url: str | None = Field(None)
    ats_slug: str | None = Field(None, max_length=100)


class CompanyResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    name: str
    url: str
    github_repo_url: str | None
    careers_page_url: str | None
    ats_slug: str | None
    last_scanned_at: Any | None
    scan_status: str


class EvidenceItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    source_type: str
    source_url: str
    raw_text: str
    author_handle: str | None
    posted_at: Any | None
    fetched_at: Any


class JobPostingResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    title: str
    raw_text: str
    posted_at: Any | None
    is_open: bool


class ScanResponse(BaseModel):
    status: str
    evidence_count: int
    newly_saved_count: int | None = None
    scan_status: str
    last_scanned_at: Any | None


# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------

async def _get_company_or_404(company_id: str, db: AsyncSession) -> Company:
    """Fetch a company by UUID string or name slug. Raises 404 if not found."""
    comp = None
    try:
        uid = uuid.UUID(company_id)
        stmt = select(Company).where(Company.id == uid)
        res = await db.execute(stmt)
        comp = res.scalar_one_or_none()
    except ValueError:
        stmt = select(Company).where(Company.name.ilike(f"%{company_id}%"))
        res = await db.execute(stmt)
        comp = res.scalar_one_or_none()

    if not comp:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Company '{company_id}' not found.",
        )
    return comp


async def _get_dossier_cache(
    company_id: uuid.UUID,
    module: str,
    db: AsyncSession,
    now: datetime,
) -> dict | None:
    """Return cached dossier module result if not expired, else None."""
    from app.db.models import DossierCache
    stmt = (
        select(DossierCache)
        .where(DossierCache.company_id == company_id)
        .where(DossierCache.module == module)
        .where(DossierCache.expires_at > now)
        .order_by(DossierCache.computed_at.desc())
        .limit(1)
    )
    res = await db.execute(stmt)
    row = res.scalar_one_or_none()
    if row:
        try:
            return json.loads(row.result_json)
        except Exception:
            return None
    return None


async def _set_dossier_cache(
    company_id: uuid.UUID,
    module: str,
    result: dict,
    db: AsyncSession,
    now: datetime,
) -> None:
    """Persist a dossier module result to the cache table."""
    from app.db.models import DossierCache
    try:
        entry = DossierCache(
            company_id=company_id,
            module=module,
            result_json=json.dumps(result, default=str),
            computed_at=now,
            expires_at=now + timedelta(hours=DOSSIER_CACHE_TTL_HOURS),
        )
        db.add(entry)
        await db.commit()
    except Exception as e:
        logger.warning("Failed to cache dossier module '%s' for company %s: %s", module, company_id, e)
        await db.rollback()


# ---------------------------------------------------------------------------
# Standard CRUD & scan endpoints
# ---------------------------------------------------------------------------

@router.post("/", response_model=CompanyResponse, status_code=status.HTTP_201_CREATED)
async def create_company(
    payload: CompanyCreate, db: AsyncSession = Depends(get_db_session)
) -> Company:
    """Create a new target company record."""
    try:
        payload.url = await validate_url(payload.url)
        if payload.github_repo_url:
            payload.github_repo_url = await validate_url(payload.github_repo_url)
        if payload.careers_page_url:
            payload.careers_page_url = await validate_url(payload.careers_page_url)
    except (InvalidURLError, SSRFBlockedError) as e:
        raise HTTPException(status_code=400, detail=str(e))

    stmt = select(Company).where(Company.url == payload.url)
    res = await db.execute(stmt)
    existing = res.scalar_one_or_none()
    if existing:
        return existing

    company = Company(
        name=payload.name,
        url=payload.url,
        github_repo_url=payload.github_repo_url,
        careers_page_url=payload.careers_page_url,
        ats_slug=payload.ats_slug,
    )
    db.add(company)
    await db.commit()
    await db.refresh(company)
    return company


@router.post("/{company_id}/scan", response_model=ScanResponse)
async def trigger_scan(
    company_id: str, db: AsyncSession = Depends(get_db_session)
) -> dict:
    """Trigger a scanning pass across all collectors for a company."""
    comp = await _get_company_or_404(company_id, db)
    try:
        scan_results = await scan_company(str(comp.id), db)
        return scan_results
    except Exception as e:
        logger.error("Scan error for company %s: %s", comp.name, e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to scan company due to an internal error.",
        )


@router.get("/{company_id}/evidence", response_model=list[EvidenceItemResponse])
async def get_evidence(
    company_id: str,
    limit: int = 10,
    offset: int = 0,
    db: AsyncSession = Depends(get_db_session),
) -> list[EvidenceItem]:
    """Retrieve collected evidence items for a company."""
    limit = min(limit, 100)
    comp = await _get_company_or_404(company_id, db)
    stmt = (
        select(EvidenceItem)
        .where(EvidenceItem.company_id == comp.id)
        .order_by(EvidenceItem.fetched_at.desc())
        .limit(limit)
        .offset(offset)
    )
    res = await db.execute(stmt)
    return list(res.scalars().all())


@router.get("/{company_id}/jobs", response_model=list[JobPostingResponse])
async def get_jobs(
    company_id: str,
    limit: int = 10,
    offset: int = 0,
    db: AsyncSession = Depends(get_db_session),
) -> list[JobPosting]:
    """Retrieve open job postings collected for a company."""
    limit = min(limit, 100)
    comp = await _get_company_or_404(company_id, db)
    stmt = (
        select(JobPosting)
        .where(JobPosting.company_id == comp.id)
        .order_by(JobPosting.posted_at.desc())
        .limit(limit)
        .offset(offset)
    )
    res = await db.execute(stmt)
    return list(res.scalars().all())


@router.get("/{company_id}/scan-status")
async def get_scan_status(
    company_id: str, db: AsyncSession = Depends(get_db_session)
) -> dict:
    """Retrieve the current scan status and last scan timestamp."""
    comp = await _get_company_or_404(company_id, db)
    return {
        "scan_status": comp.scan_status,
        "last_scanned_at": comp.last_scanned_at,
    }


# ---------------------------------------------------------------------------
# Deep Research — 5 Module Endpoints
# ---------------------------------------------------------------------------

@router.post("/{company_id}/deep-research/identity")
async def deep_research_identity(
    company_id: str,
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    """
    Module 1: What the company actually does — plain English product description,
    tech stack, target customer, business model.
    Data sources: GitHub README, language stats, Tavily web search.
    Cached for 24 hours.
    """
    from app.services.deep_research_engine import research_company_identity

    comp = await _get_company_or_404(company_id, db)
    now = datetime.now(timezone.utc)

    cached = await _get_dossier_cache(comp.id, "identity", db, now)
    if cached:
        return cached

    result = await research_company_identity(
        company_name=comp.name,
        company_url=comp.url,
        github_repo_url=comp.github_repo_url,
    )
    await _set_dossier_cache(comp.id, "identity", result, db, now)
    return result


@router.post("/{company_id}/deep-research/competitors")
async def deep_research_competitors(
    company_id: str,
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    """
    Module 2: Competitor battle matrix and churn signals.
    Surfaces 3-5 feature dimensions where target company lags behind competitors.
    Data sources: Reddit "vs" discussions, churn signal search, Tavily.
    Cached for 24 hours.
    """
    from app.services.deep_research_engine import (
        research_company_identity,
        research_competitor_matrix,
    )

    comp = await _get_company_or_404(company_id, db)
    now = datetime.now(timezone.utc)

    cached = await _get_dossier_cache(comp.id, "competitors", db, now)
    if cached:
        return cached

    # Ensure identity is computed for context
    identity = await _get_dossier_cache(comp.id, "identity", db, now)
    if not identity:
        identity = await research_company_identity(
            company_name=comp.name,
            company_url=comp.url,
            github_repo_url=comp.github_repo_url,
        )
        await _set_dossier_cache(comp.id, "identity", identity, db, now)

    result = await research_competitor_matrix(
        company_name=comp.name,
        product_category=identity.get("target_customer", "technology platform"),
        company_key_features=identity.get("key_features", []),
    )
    await _set_dossier_cache(comp.id, "competitors", result, db, now)
    return result


@router.post("/{company_id}/deep-research/complaints")
async def deep_research_complaints(
    company_id: str,
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    """
    Module 3: Real market complaints with verifiable receipts.
    Each complaint includes an exact user quote, source URL, date, and engagement count.
    Data sources: Existing DB evidence + Reddit + HN + G2 + GitHub Issues (sorted by reactions).
    Cached for 24 hours.
    """
    from app.services.deep_research_engine import research_market_complaints

    comp = await _get_company_or_404(company_id, db)
    now = datetime.now(timezone.utc)

    cached = await _get_dossier_cache(comp.id, "complaints", db, now)
    if cached:
        return cached

    # Pull existing evidence from scan pipeline
    ev_stmt = (
        select(EvidenceItem)
        .where(EvidenceItem.company_id == comp.id)
        .order_by(EvidenceItem.fetched_at.desc())
        .limit(15)
    )
    ev_res = await db.execute(ev_stmt)
    existing_evidence = [
        {
            "source_type": ev.source_type,
            "source_url": ev.source_url,
            "raw_text": ev.raw_text,
            "posted_at": ev.posted_at,
        }
        for ev in ev_res.scalars().all()
    ]

    result = await research_market_complaints(
        company_name=comp.name,
        company_url=comp.url,
        github_repo_url=comp.github_repo_url,
        existing_evidence=existing_evidence,
    )
    await _set_dossier_cache(comp.id, "complaints", result, db, now)
    return result


@router.post("/{company_id}/deep-research/gap-analysis")
async def deep_research_gap_analysis(
    company_id: str,
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    """
    Module 4: Stealth / competitor gap analysis.
    For early-stage companies with sparse public data, analyzes what category
    leaders have that this company likely hasn't shipped yet.
    Always labeled as "inferred from competitor data" — never presented as confirmed.
    Cached for 24 hours.
    """
    from app.services.deep_research_engine import (
        research_company_identity,
        research_stealth_gap,
    )

    comp = await _get_company_or_404(company_id, db)
    now = datetime.now(timezone.utc)

    cached = await _get_dossier_cache(comp.id, "stealth_gap", db, now)
    if cached:
        return cached

    identity = await _get_dossier_cache(comp.id, "identity", db, now)
    if not identity:
        identity = await research_company_identity(
            company_name=comp.name,
            company_url=comp.url,
            github_repo_url=comp.github_repo_url,
        )
        await _set_dossier_cache(comp.id, "identity", identity, db, now)

    competitors_data = await _get_dossier_cache(comp.id, "competitors", db, now)
    competitors_found = competitors_data.get("competitors_found", []) if competitors_data else []

    result = await research_stealth_gap(
        company_name=comp.name,
        product_category=identity.get("target_customer", "technology platform"),
        competitors_found=competitors_found,
    )
    await _set_dossier_cache(comp.id, "stealth_gap", result, db, now)
    return result


@router.post("/{company_id}/deep-research/alignment")
async def deep_research_alignment(
    company_id: str,
    user_id: str | None = None,
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    """
    Module 5: Candidate skill-to-gap alignment.
    Matches the user's actual skills (from their uploaded resume profile in DB)
    against the real gaps found in Modules 3 and 4.
    Personalized per user_id — each user gets their own alignment.
    Cached for 24 hours per user.
    """
    from app.db.models import UserProfile
    from app.services.deep_research_engine import research_candidate_alignment

    comp = await _get_company_or_404(company_id, db)
    now = datetime.now(timezone.utc)

    cache_key = f"alignment_{user_id}" if user_id else "alignment_anon"
    cached = await _get_dossier_cache(comp.id, cache_key, db, now)
    if cached:
        return cached

    candidate_skills: list[str] = []
    candidate_domains: list[str] = []
    candidate_summary: str = ""

    if user_id:
        try:
            uid = uuid.UUID(user_id)
            prof_stmt = select(UserProfile).where(UserProfile.user_id == uid)
            prof_res = await db.execute(prof_stmt)
            profile = prof_res.scalar_one_or_none()
            if profile:
                candidate_skills = profile.parsed_skills or []
                candidate_domains = profile.parsed_domains or []
                candidate_summary = profile.parsed_project_summary or ""
        except Exception as e:
            logger.warning("Could not fetch user profile for alignment: %s", e)

    complaints_data = await _get_dossier_cache(comp.id, "complaints", db, now)
    gap_data = await _get_dossier_cache(comp.id, "stealth_gap", db, now)
    complaints = complaints_data.get("complaints", []) if complaints_data else []
    gap_opportunities = gap_data.get("gap_opportunities", []) if gap_data else []

    result = await research_candidate_alignment(
        company_name=comp.name,
        complaints=complaints,
        gap_opportunities=gap_opportunities,
        candidate_skills=candidate_skills,
        candidate_domains=candidate_domains,
        candidate_project_summary=candidate_summary,
    )
    await _set_dossier_cache(comp.id, cache_key, result, db, now)
    return result


# ---------------------------------------------------------------------------
# Legacy combined endpoint — now backed by real Module 1 + 3 data.
# Kept for backwards compatibility with existing frontend code.
# ---------------------------------------------------------------------------

@router.post("/{company_id}/deep-research")
async def deep_research_company_endpoint(
    company_id: str,
    user_id: str | None = None,
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    """
    Legacy deep-research endpoint. Now powered by the real 5-module engine.
    Returns combined Module 1 (identity) + Module 3 (complaints) output.
    Existing frontend code continues to work without changes.
    """
    from app.services.deep_research_engine import (
        research_company_identity,
        research_market_complaints,
    )

    comp = await _get_company_or_404(company_id, db)
    now = datetime.now(timezone.utc)

    identity_cached = await _get_dossier_cache(comp.id, "identity", db, now)
    complaints_cached = await _get_dossier_cache(comp.id, "complaints", db, now)

    # Collect existing evidence for complaints module
    ev_stmt = (
        select(EvidenceItem)
        .where(EvidenceItem.company_id == comp.id)
        .order_by(EvidenceItem.fetched_at.desc())
        .limit(15)
    )
    ev_res = await db.execute(ev_stmt)
    existing_evidence = [
        {
            "source_type": ev.source_type,
            "source_url": ev.source_url,
            "raw_text": ev.raw_text,
            "posted_at": ev.posted_at,
        }
        for ev in ev_res.scalars().all()
    ]

    # Compute missing modules in parallel
    tasks = []
    if not identity_cached:
        tasks.append(
            research_company_identity(
                company_name=comp.name,
                company_url=comp.url,
                github_repo_url=comp.github_repo_url,
            )
        )
    if not complaints_cached:
        tasks.append(
            research_market_complaints(
                company_name=comp.name,
                company_url=comp.url,
                github_repo_url=comp.github_repo_url,
                existing_evidence=existing_evidence,
            )
        )

    if tasks:
        results = await asyncio.gather(*tasks, return_exceptions=True)
        idx = 0
        if not identity_cached:
            identity_result = results[idx] if not isinstance(results[idx], Exception) else {}
            idx += 1
            if isinstance(identity_result, dict):
                await _set_dossier_cache(comp.id, "identity", identity_result, db, now)
                identity_cached = identity_result
        if not complaints_cached:
            complaints_result = results[idx] if not isinstance(results[idx], Exception) else {}
            if isinstance(complaints_result, dict):
                await _set_dossier_cache(comp.id, "complaints", complaints_result, db, now)
                complaints_cached = complaints_result

    identity_data = identity_cached or {}
    complaints_data = complaints_cached or {}

    top_complaints = complaints_data.get("complaints", [])[:3]
    gaps_text = ""
    for i, c in enumerate(top_complaints, 1):
        quote = c.get("exact_quote", c.get("impact_description", ""))[:180]
        gaps_text += f"{i}. [{c.get('category', 'Friction')}]: {quote}\n"

    top_source_url = comp.url
    if top_complaints and top_complaints[0].get("source_url"):
        top_source_url = top_complaints[0]["source_url"]

    return {
        "company_name": comp.name,
        "original_company_url": comp.url,
        "careers_url": comp.careers_page_url or f"{comp.url}/careers",
        "company_overview": identity_data.get(
            "plain_english_description",
            f"Deep research in progress for {comp.name}. Try the full 5-module dossier.",
        ),
        "target_customer": identity_data.get("target_customer", "Unknown"),
        "tech_stack_tags": identity_data.get("tech_stack", []),
        "business_model": identity_data.get("business_model", "Unknown"),
        "key_features": identity_data.get("key_features", []),
        "detailed_gaps": gaps_text or "Run /deep-research/complaints for verified gap analysis.",
        "pain_point": complaints_data.get("top_friction_area", "Analysis in progress — see complaints module."),
        "source_url": top_source_url,
        "evidence_receipts": [
            {
                "quote": c.get("exact_quote", ""),
                "source_url": c.get("source_url", ""),
                "source_type": c.get("source_type", ""),
                "date": c.get("date", ""),
            }
            for c in top_complaints
        ],
        "data_confidence": identity_data.get("data_confidence", "computing"),
        "fit_score": 0.85,
        "why_for_you": f"Based on your profile and {comp.name}'s identified gaps — see Module 5 for full alignment.",
        "module_urls": {
            "identity": f"/company/{comp.id}/deep-research/identity",
            "competitors": f"/company/{comp.id}/deep-research/competitors",
            "complaints": f"/company/{comp.id}/deep-research/complaints",
            "gap_analysis": f"/company/{comp.id}/deep-research/gap-analysis",
            "alignment": f"/company/{comp.id}/deep-research/alignment",
        },
    }
