"""API routes for company management and scanning."""

import logging
import uuid
from datetime import datetime, timezone
from typing import Any
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, HttpUrl, field_validator, ConfigDict
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Company, EvidenceItem, JobPosting, Card, GapCluster, FixabilityFlag, RoleMatch, User, UserProfile
from app.db.session import get_db_session
from app.services.security import validate_url, InvalidURLError, SSRFBlockedError
from app.services.scan_orchestrator import scan_company

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/company", tags=["company"])


class CompanyCreate(BaseModel):
    """Schema for creating a company."""

    name: str = Field(..., min_length=1, max_length=255, description="Name of the company")
    url: str = Field(..., description="Company homepage URL")
    github_repo_url: str | None = Field(None, description="Optional link to public GitHub repository")
    careers_page_url: str | None = Field(None, description="Optional link to careers page")
    ats_slug: str | None = Field(None, max_length=100, description="Optional ATS slug override")

    @field_validator("url")
    @classmethod
    def validate_company_url(cls, v: str) -> str:
        """Apply security and format validation to company URL."""
        try:
            return validate_url(v)
        except SSRFBlockedError as e:
            raise ValueError(f"URL blocked for security: {e}")
        except InvalidURLError as e:
            raise ValueError(f"Invalid URL: {e}")

    @field_validator("github_repo_url")
    @classmethod
    def validate_github_url(cls, v: str | None) -> str | None:
        """Apply security and format validation to GitHub URL."""
        if not v:
            return None
        try:
            return validate_url(v)
        except SSRFBlockedError as e:
            raise ValueError(f"GitHub URL blocked for security: {e}")
        except InvalidURLError as e:
            raise ValueError(f"Invalid GitHub URL: {e}")

    @field_validator("careers_page_url")
    @classmethod
    def validate_careers_url(cls, v: str | None) -> str | None:
        """Apply security and format validation to careers page URL."""
        if not v:
            return None
        try:
            return validate_url(v)
        except SSRFBlockedError as e:
            raise ValueError(f"Careers URL blocked for security: {e}")
        except InvalidURLError as e:
            raise ValueError(f"Invalid Careers URL: {e}")


class CompanyResponse(BaseModel):
    """Schema for returning company details."""

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
    """Schema for returning evidence items."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    source_type: str
    source_url: str
    raw_text: str
    author_handle: str | None
    posted_at: Any | None
    fetched_at: Any


class JobPostingResponse(BaseModel):
    """Schema for returning job postings."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    raw_text: str
    posted_at: Any | None
    is_open: bool


class ScanResponse(BaseModel):
    """Schema for scan response metrics."""

    status: str
    evidence_count: int
    newly_saved_count: int | None = None
    card_count: int | None = None
    scan_status: str
    last_scanned_at: Any | None


class ClusterCardDetail(BaseModel):
    id: uuid.UUID
    label: str
    evidence_count: int
    rank_score: float
    recency_score: float


class FixabilityCardDetail(BaseModel):
    has_public_repo: bool
    has_public_api: bool
    has_ui_surface: bool
    is_buildable: bool


class RoleMatchCardDetail(BaseModel):
    job_title: str
    match_score: float
    match_reason: str


class EvidenceCardDetail(BaseModel):
    source_type: str
    source_url: str
    raw_text: str
    posted_at: Any | None


class CardResponse(BaseModel):
    card_id: uuid.UUID
    status: str
    profile_match_score: float
    cluster: ClusterCardDetail
    fixability: FixabilityCardDetail
    role_match: RoleMatchCardDetail | None
    evidence: list[EvidenceCardDetail]
    explanation_string: str
    top_matching_skill: str
    gap_domain: str


class CardStatusUpdate(BaseModel):
    status: str

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str) -> str:
        valid = {"new", "selected", "dismissed"}
        if v not in valid:
            raise ValueError("status must be 'new', 'selected', or 'dismissed'")
        return v


@router.post("/", response_model=CompanyResponse, status_code=status.HTTP_201_CREATED)
async def create_company(
    payload: CompanyCreate, db: AsyncSession = Depends(get_db_session)
) -> Company:
    """Create a new target company record."""
    # Check if company with same homepage URL already exists
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
    company_id: str, user_id: str | None = None, db: AsyncSession = Depends(get_db_session)
) -> dict:
    """Trigger a scanning pass across all collectors for a company."""
    # Lookup company first
    stmt = select(Company).where(Company.id == company_id)
    res = await db.execute(stmt)
    company = res.scalar_one_or_none()
    if not company:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Company with ID {company_id} not found",
        )

    try:
        scan_results = await scan_company(str(company.id), db, user_id=user_id)
        return scan_results
    except Exception as e:
        logger.error("Scan error for company %s: %s", company.name, e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to scan company: {str(e)}",
        )


@router.get("/{company_id}/evidence", response_model=list[EvidenceItemResponse])
async def get_evidence(
    company_id: str, db: AsyncSession = Depends(get_db_session)
) -> list[EvidenceItem]:
    """Retrieve all collected evidence items for a company."""
    stmt = select(Company).where(Company.id == company_id)
    res = await db.execute(stmt)
    company = res.scalar_one_or_none()
    if not company:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Company with ID {company_id} not found",
        )

    stmt_ev = select(EvidenceItem).where(EvidenceItem.company_id == company.id).order_by(EvidenceItem.fetched_at.desc())
    res_ev = await db.execute(stmt_ev)
    return list(res_ev.scalars().all())


@router.get("/{company_id}/jobs", response_model=list[JobPostingResponse])
async def get_jobs(
    company_id: str, db: AsyncSession = Depends(get_db_session)
) -> list[JobPosting]:
    """Retrieve all open job postings collected for a company."""
    stmt = select(Company).where(Company.id == company_id)
    res = await db.execute(stmt)
    company = res.scalar_one_or_none()
    if not company:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Company with ID {company_id} not found",
        )

    stmt_jobs = select(JobPosting).where(JobPosting.company_id == company.id).order_by(JobPosting.posted_at.desc())
    res_jobs = await db.execute(stmt_jobs)
    return list(res_jobs.scalars().all())


@router.get("/{company_id}/scan-status")
async def get_scan_status(
    company_id: str, db: AsyncSession = Depends(get_db_session)
) -> dict:
    """Retrieve the current scan status and last scan timestamp."""
    stmt = select(Company).where(Company.id == company_id)
    res = await db.execute(stmt)
    company = res.scalar_one_or_none()
    if not company:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Company with ID {company_id} not found",
        )

    return {
        "scan_status": company.scan_status,
        "last_scanned_at": company.last_scanned_at,
    }


@router.get("/{company_id}/cards", response_model=list[CardResponse])
async def get_cards(
    company_id: str, user_id: str, db: AsyncSession = Depends(get_db_session)
) -> list[dict]:
    """Retrieve matched and fixable cards for a user + company."""
    # Validate user UUID
    try:
        user_uuid = uuid.UUID(user_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid user_id format",
        )

    # Validate company UUID
    try:
        company_uuid = uuid.UUID(company_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid company_id format",
        )

    # Check user exists
    stmt_user = select(User).where(User.id == user_uuid)
    res_user = await db.execute(stmt_user)
    if not res_user.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with ID {user_id} not found",
        )

    # Check company exists
    stmt_comp = select(Company).where(Company.id == company_uuid)
    res_comp = await db.execute(stmt_comp)
    company = res_comp.scalar_one_or_none()
    if not company:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Company with ID {company_id} not found",
        )

    # Fetch existing cards
    stmt_cards = select(Card).where(
        Card.user_id == user_uuid, Card.company_id == company_uuid
    )
    res_cards = await db.execute(stmt_cards)
    cards = list(res_cards.scalars().all())

    # Fallback: compute cards on the fly if clusters exist but no cards have been computed yet
    if not cards:
        stmt_clusters = select(GapCluster).where(GapCluster.company_id == company_uuid)
        res_clusters = await db.execute(stmt_clusters)
        clusters = res_clusters.scalars().all()

        if clusters:
            from app.services.fixability import compute_fixability
            from app.services.role_matcher import match_roles
            from app.services.profile_matcher import match_profile_and_write_cards

            try:
                await compute_fixability(company_uuid, db)
                await match_roles(company_uuid, db)
                await match_profile_and_write_cards(user_uuid, company_uuid, db)
                await db.commit()

                # Re-fetch
                res_cards = await db.execute(stmt_cards)
                cards = list(res_cards.scalars().all())
            except Exception as match_err:
                logger.error("On-the-fly card computation failed: %s", match_err)

    response_cards = []
    for card in cards:
        # Load associated details directly via separate select statements for safety
        stmt_cluster = select(GapCluster).where(GapCluster.id == card.gap_cluster_id)
        cluster = (await db.execute(stmt_cluster)).scalar_one()

        stmt_flag = select(FixabilityFlag).where(
            FixabilityFlag.id == card.fixability_flag_id
        )
        flag = (await db.execute(stmt_flag)).scalar_one_or_none()

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
                        "job_title": job.title,
                        "match_score": role_match.match_score,
                        "match_reason": role_match.match_reason,
                    }

        # Load top 3 evidence items
        evidence_details = []
        if cluster.evidence_item_ids:
            stmt_ev = select(EvidenceItem).where(
                EvidenceItem.id.in_(cluster.evidence_item_ids)
            ).limit(3)
            evidence_items = (await db.execute(stmt_ev)).scalars().all()
            for ev in evidence_items:
                evidence_details.append(
                    {
                        "source_type": ev.source_type,
                        "source_url": ev.source_url,
                        "raw_text": ev.raw_text,
                        "posted_at": ev.posted_at,
                    }
                )

        # Load user skills/domains to compute matching template string
        user_skills = []
        user_domains = []
        stmt_profile = select(UserProfile).where(UserProfile.user_id == user_uuid)
        profile = (await db.execute(stmt_profile)).scalar_one_or_none()
        if profile:
            user_skills = profile.parsed_skills
            user_domains = profile.parsed_domains

        from app.services.prompt_generator import get_matching_skill_and_domain, render_explanation

        evidence_text_combined = " ".join(ev["raw_text"] for ev in evidence_details)
        matching_skill, gap_domain = get_matching_skill_and_domain(
            user_skills,
            user_domains,
            evidence_text_combined or cluster.label,
            cluster.label,
        )
        explanation_string = render_explanation(matching_skill, gap_domain)

        # Update shown_at timestamp on display
        if card.shown_at is None:
            card.shown_at = datetime.now(timezone.utc)
            db.add(card)

        response_cards.append(
            {
                "card_id": card.id,
                "status": card.status,
                "profile_match_score": card.profile_match_score,
                "cluster": {
                    "id": cluster.id,
                    "label": cluster.label,
                    "evidence_count": cluster.evidence_count,
                    "rank_score": cluster.rank_score,
                    "recency_score": cluster.recency_score,
                },
                "fixability": {
                    "has_public_repo": flag.has_public_repo if flag else False,
                    "has_public_api": flag.has_public_api if flag else False,
                    "has_ui_surface": flag.has_ui_surface if flag else True,
                    "is_buildable": flag.is_buildable if flag else True,
                },
                "role_match": role_match_detail,
                "evidence": evidence_details,
                "explanation_string": explanation_string,
                "top_matching_skill": matching_skill,
                "gap_domain": gap_domain,
            }
        )

    await db.commit()
    # Sort the returned list by profile_match_score descending
    response_cards.sort(key=lambda x: x["profile_match_score"], reverse=True)
    return response_cards


@router.patch("/{company_id}/cards/{card_id}")
async def update_card_status(
    company_id: str,
    card_id: str,
    payload: CardStatusUpdate,
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    """Update status of a card (e.g. from 'new' to 'selected' or 'dismissed')."""
    try:
        company_uuid = uuid.UUID(company_id)
        card_uuid = uuid.UUID(card_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid UUID format",
        )

    stmt = select(Card).where(Card.id == card_uuid, Card.company_id == company_uuid)
    res = await db.execute(stmt)
    card = res.scalar_one_or_none()

    if not card:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Card with ID {card_id} not found for this company",
        )

    card.status = payload.status
    card.updated_at = datetime.now(timezone.utc)
    db.add(card)
    await db.commit()

    return {
        "status": "success",
        "card_id": str(card.id),
        "new_status": card.status,
    }


class CardPromptResponse(BaseModel):
    card_id: uuid.UUID
    company_name: str
    prompt_text: str


@router.get("/{company_id}/cards/{card_id}/prompt", response_model=CardPromptResponse)
async def get_card_prompt(
    company_id: str,
    card_id: str,
    user_id: str,
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    """Generate and retrieve the tailored build prompt for a card."""
    try:
        company_uuid = uuid.UUID(company_id)
        card_uuid = uuid.UUID(card_id)
        user_uuid = uuid.UUID(user_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid UUID format",
        )

    # Verify card belongs to company and user
    stmt_card = select(Card).where(
        Card.id == card_uuid,
        Card.company_id == company_uuid,
        Card.user_id == user_uuid,
    )
    res_card = await db.execute(stmt_card)
    card = res_card.scalar_one_or_none()
    if not card:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Card with ID {card_id} not found for this user and company",
        )

    # Fetch company name
    stmt_company = select(Company.name).where(Company.id == company_uuid)
    company_name = (await db.execute(stmt_company)).scalar_one_or_none()
    if not company_name:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Company not found",
        )

    from app.services.prompt_generator import generate_handoff_prompt

    try:
        prompt_text = await generate_handoff_prompt(
            company_uuid, card_uuid, user_uuid, db
        )
    except ValueError as val_err:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(val_err),
        )

    return {
        "card_id": card_uuid,
        "company_name": company_name,
        "prompt_text": prompt_text,
    }
