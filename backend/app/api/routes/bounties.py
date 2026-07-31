"""
Bounties API Route — GET /api/v1/bounties

Provides product engineering bounties, solo hackathons, and paid founder sprint trials.
"""

from typing import Any
from fastapi import APIRouter, Query
from pydantic import BaseModel

from app.services.bounty_collector import get_curated_bounties

router = APIRouter(prefix="/bounties", tags=["bounties"])


class BountyResponse(BaseModel):
    id: str
    title: str
    company_name: str
    company_url: str
    reward_amount: str
    type: str
    tech_stack: list[str]
    est_hours: int
    platform_source: str
    source_url: str
    description: str
    senior_build_plan: str


class BountyListResponse(BaseModel):
    bounties: list[BountyResponse]


@router.get("", response_model=BountyListResponse)
async def get_bounties(
    bounty_type: str | None = Query(default=None, description="Filter by type: bounty | hackathon | trial | all"),
    tech_stack: str | None = Query(default=None, description="Filter by tech stack keyword"),
) -> dict[str, Any]:
    """Return curated paid bounties & solo hackathons for product engineers."""
    items = get_curated_bounties(bounty_type=bounty_type, tech_stack=tech_stack)
    return {"bounties": items}
