"""
Phase 2 Company Discovery Feed Endpoint — GET /api/v1/feed

Returns curated, VC-backed companies ranked by skill match with the user's profile.
"""

import logging
import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Company, EvidenceItem, GapCluster, UserProfile
from app.db.session import get_db_session

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/feed", tags=["feed"])


class HealthSummaryResponse(BaseModel):
    verdict: str
    green_flag_count: int
    red_flag_count: int
    summary: str


class FeedCompanyResponse(BaseModel):
    id: str
    name: str
    url: str
    github_repo_url: str | None
    careers_page_url: str | None
    funding_stage: str | None
    investor_tags: list[str]
    employee_count_approx: int | None
    region_tag: str | None = "global"
    compensation_tier: str | None = "High Pay"
    tech_stack_tags: list[str]
    scan_status: str
    evidence_count: int
    is_seed_list: bool
    seed_list_source: str | None
    why_for_you: str | None
    top_clusters: list[str]
    health: HealthSummaryResponse | None = None


class FeedResponse(BaseModel):
    companies: list[FeedCompanyResponse]


@router.get("", response_model=FeedResponse)
async def get_company_feed(
    user_id: str | None = Query(default=None, description="Optional User UUID to rank by skills"),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    """Retrieve curated company feed, ranked by user skill overlap if user_id provided."""
    user_skills: list[str] = []
    if user_id:
        try:
            u_uuid = uuid.UUID(user_id)
            stmt_prof = select(UserProfile).where(UserProfile.user_id == u_uuid)
            prof = (await db.execute(stmt_prof)).scalar_one_or_none()
            if prof and prof.parsed_skills:
                user_skills = [s.lower() for s in prof.parsed_skills]
        except Exception as e:
            logger.warning("Could not fetch user profile for feed ranking: %s", e)

    # Fetch seed list companies (or all companies if seed list empty)
    stmt = select(Company).where(Company.is_seed_list == True)
    res = await db.execute(stmt)
    companies = list(res.scalars().all())

    if not companies:
        # Fall back to all companies
        stmt_all = select(Company).limit(30)
        res_all = await db.execute(stmt_all)
        companies = list(res_all.scalars().all())

    feed_items = []

    for comp in companies:
        # Fetch evidence count
        stmt_ev = select(EvidenceItem).where(EvidenceItem.company_id == comp.id)
        res_ev = await db.execute(stmt_ev)
        ev_items = list(res_ev.scalars().all())
        ev_count = len(ev_items)

        # Fetch top gap clusters
        stmt_cl = select(GapCluster.label).where(GapCluster.company_id == comp.id).limit(3)
        res_cl = await db.execute(stmt_cl)
        top_clusters = list(res_cl.scalars().all())

        # Compute skill overlap score
        comp_stack = [t.lower() for t in (comp.tech_stack_tags or [])]
        matching_skills = [s for s in user_skills if s in comp_stack or any(s in t for t in comp_stack)]

        if matching_skills:
            why_msg = f"Matches your {', '.join([s.title() for s in matching_skills[:2]])} skills"
            match_score = len(matching_skills) * 10 + ev_count
        elif comp.investor_tags:
            inv_str = ", ".join([i.upper() for i in comp.investor_tags[:2]])
            why_msg = f"Backed by {inv_str}"
            match_score = ev_count
        else:
            why_msg = "Top curated product engineering startup"
            match_score = ev_count

        from app.services.company_vetter import evaluate_company_health
        health_summary = None
        try:
            signal = await evaluate_company_health(comp.id, db)
            health_summary = {
                "verdict": signal.verdict,
                "green_flag_count": signal.green_flag_count,
                "red_flag_count": signal.red_flag_count,
                "summary": signal.summary or "",
            }
        except Exception as err:
            logger.debug("Failed to compute health for feed item %s: %s", comp.name, err)

        feed_items.append({
            "id": str(comp.id),
            "name": comp.name,
            "url": comp.url,
            "github_repo_url": comp.github_repo_url,
            "careers_page_url": comp.careers_page_url,
            "funding_stage": comp.funding_stage,
            "investor_tags": comp.investor_tags or [],
            "employee_count_approx": comp.employee_count_approx,
            "tech_stack_tags": comp.tech_stack_tags or [],
            "scan_status": comp.scan_status,
            "evidence_count": ev_count,
            "is_seed_list": comp.is_seed_list,
            "seed_list_source": comp.seed_list_source,
            "why_for_you": why_msg,
            "top_clusters": top_clusters,
            "health": health_summary,
            "_match_score": match_score,
        })

    # Sort by match score descending
    feed_items.sort(key=lambda x: x["_match_score"], reverse=True)

    # Clean temporary internal field
    for item in feed_items:
        item.pop("_match_score", None)

    return {"companies": feed_items}
