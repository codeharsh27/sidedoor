"""API routes for company management and scanning."""

import logging
import uuid
from datetime import datetime, timezone
from typing import Any
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, HttpUrl, field_validator, ConfigDict
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Company, Contact, EvidenceItem, JobPosting, Card, GapCluster, FixabilityFlag, OutreachDraft, RoleMatch, User, UserProfile
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


class CompanyHealthResponse(BaseModel):
    company_id: str
    verdict: str
    red_flag_count: int
    green_flag_count: int
    green_flags: list[str]
    red_flags: list[str]
    summary: str
    health_computed_at: str


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


# ---------------------------------------------------------------------------
# Stage 6: Outreach Assembly
# ---------------------------------------------------------------------------

class ContactResponse(BaseModel):
    """Schema for a discovered contact at a target company."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str | None
    title: str
    source_url: str
    contact_type: str
    scraped_at: Any


class OutreachDraftResponse(BaseModel):
    """Schema for the outreach scaffold generated for a card."""

    draft_id: uuid.UUID
    card_id: uuid.UUID
    draft_text: str
    created_at: Any


@router.get("/{company_id}/contacts", response_model=list[ContactResponse])
async def get_contacts(
    company_id: str, db: AsyncSession = Depends(get_db_session)
) -> list[Contact]:
    """Discover and return contacts for a company (GitHub contributors, LinkedIn search URLs, team page)."""
    try:
        company_uuid = uuid.UUID(company_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid company_id format",
        )

    stmt = select(Company).where(Company.id == company_uuid)
    company = (await db.execute(stmt)).scalar_one_or_none()
    if not company:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Company with ID {company_id} not found",
        )

    from app.services.contact_finder import find_contacts

    try:
        contacts = await find_contacts(company_uuid, db)
    except Exception as exc:
        logger.error("Contact discovery failed for %s: %s", company_id, exc)
        contacts = []

    return contacts


@router.post(
    "/{company_id}/cards/{card_id}/outreach-draft",
    response_model=OutreachDraftResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_outreach_draft(
    company_id: str,
    card_id: str,
    user_id: str,
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    """Generate and persist the outreach scaffold for a card. Upserts on repeat calls."""
    try:
        company_uuid = uuid.UUID(company_id)
        card_uuid = uuid.UUID(card_id)
        user_uuid = uuid.UUID(user_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid UUID format",
        )

    # Verify card belongs to this company and user
    stmt_card = select(Card).where(
        Card.id == card_uuid,
        Card.company_id == company_uuid,
        Card.user_id == user_uuid,
    )
    card = (await db.execute(stmt_card)).scalar_one_or_none()
    if not card:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Card {card_id} not found for this user and company",
        )

    from app.services.outreach_drafter import generate_outreach_draft

    try:
        draft = await generate_outreach_draft(card_uuid, user_uuid, db)
        await db.commit()
    except ValueError as val_err:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(val_err),
        )

    return {
        "draft_id": draft.id,
        "card_id": draft.card_id,
        "draft_text": draft.draft_text,
        "created_at": draft.created_at,
    }


@router.get(
    "/{company_id}/cards/{card_id}/outreach-draft",
    response_model=OutreachDraftResponse,
)
async def get_outreach_draft(
    company_id: str,
    card_id: str,
    user_id: str,
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    """Retrieve the outreach draft for a card. Generates one on first call (idempotent)."""
    try:
        company_uuid = uuid.UUID(company_id)
        card_uuid = uuid.UUID(card_id)
        user_uuid = uuid.UUID(user_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid UUID format",
        )

    # Verify card belongs to this company and user
    stmt_card = select(Card).where(
        Card.id == card_uuid,
        Card.company_id == company_uuid,
        Card.user_id == user_uuid,
    )
    card = (await db.execute(stmt_card)).scalar_one_or_none()
    if not card:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Card {card_id} not found for this user and company",
        )

    # Return existing draft if present
    stmt_draft = select(OutreachDraft).where(
        OutreachDraft.card_id == card_uuid,
        OutreachDraft.user_id == user_uuid,
    )
    draft = (await db.execute(stmt_draft)).scalar_one_or_none()

    if not draft:
        # Generate on demand (idempotent with POST endpoint)
        from app.services.outreach_drafter import generate_outreach_draft

        try:
            draft = await generate_outreach_draft(card_uuid, user_uuid, db)
            await db.commit()
        except ValueError as val_err:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(val_err),
            )

    return {
        "draft_id": draft.id,
        "card_id": draft.card_id,
        "draft_text": draft.draft_text,
        "created_at": draft.created_at,
    }


@router.get("/{company_id}/health", response_model=CompanyHealthResponse)
async def get_company_health_endpoint(
    company_id: str,
    db: AsyncSession = Depends(get_db_session)
) -> dict:
    """Evaluate and return health/scam signals for a company."""
    try:
        c_uuid = uuid.UUID(company_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid company_id UUID format",
        )

    from app.services.company_vetter import evaluate_company_health

    try:
        signal = await evaluate_company_health(c_uuid, db)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )

    return {
        "company_id": str(signal.company_id),
        "verdict": signal.verdict,
        "red_flag_count": signal.red_flag_count,
        "green_flag_count": signal.green_flag_count,
        "green_flags": signal.green_flags or [],
        "red_flags": signal.red_flags or [],
        "summary": signal.summary or "",
        "health_computed_at": signal.health_computed_at.isoformat(),
    }


class OutreachPlaybookResponse(BaseModel):
    card_id: str
    email_draft: str
    twitter_post: str
    discord_message: str
    blog_post_title: str
    follow_up_email: str


@router.get("/{company_id}/cards/{card_id}/outreach-playbook", response_model=OutreachPlaybookResponse)
async def get_outreach_playbook_endpoint(
    company_id: str,
    card_id: str,
    user_id: str,
    db: AsyncSession = Depends(get_db_session)
) -> dict:
    """Generate 4-channel outreach playbook for a selected opportunity card."""
    try:
        card_uuid = uuid.UUID(card_id)
        user_uuid = uuid.UUID(user_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid UUID format",
        )

    from app.services.outreach_drafter import generate_outreach_playbook

    try:
        pb = await generate_outreach_playbook(card_uuid, user_uuid, db)
        await db.commit()
    except ValueError as val_err:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(val_err),
        )

    return {
        "card_id": card_id,
        "email_draft": pb["email_draft"],
        "twitter_post": pb["twitter_post"],
        "discord_message": pb["discord_message"],
        "blog_post_title": pb["blog_post_title"],
        "follow_up_email": pb["follow_up_email"],
    }


class CompanyFeedItemResponse(BaseModel):
    company: str
    website: str
    funding: str
    stage: str
    role: str
    role_classification: str
    fit_score: float
    fit_explanation: str
    jd_url: str


@router.get("/feed", response_model=list[CompanyFeedItemResponse])
async def get_personalized_company_feed(
    user_id: str | None = None,
    db: AsyncSession = Depends(get_db_session)
) -> list[dict]:
    """
    Personalized Company Scouting & Feed Endpoint.
    Orchestrates: User context -> Query gen -> Search & fetch -> Enrich -> Score/rank -> Grounded 'Why Fit' -> Serve.
    """
    if user_id:
        try:
            u_uuid = uuid.UUID(user_id)
        except ValueError:
            u_uuid = uuid.UUID("00000000-0000-0000-0000-000000000000")
    else:
        u_uuid = uuid.UUID("00000000-0000-0000-0000-000000000000")

    from app.services.context_builder import build_user_context
    from app.services.query_generator import generate_search_queries
    from app.services.company_searcher import search_companies
    from app.services.company_enricher import enrich_company
    from app.services.company_ranker import score_company
    from app.services.fit_explainer import generate_fit_explanation

    # 1. Build compact user context
    context = await build_user_context(u_uuid, db)

    # 2. Generate search queries
    queries = await generate_search_queries(context)

    # 3. Search and fetch candidate companies
    candidates = await search_companies(queries)

    feed_items = []
    for cand in candidates:
        # 4. Enrich company details
        enriched = enrich_company(
            company_name=cand["name"],
            website_url=cand["website"],
            jd_text=cand["jd_text"],
            jd_url=cand["jd_url"]
        )

        # 5. Score & rank against candidate context
        fit_score, breakdown = await score_company(
            company=enriched,
            user_context=context,
            jd_title=cand["jd_title"],
            jd_text=cand["jd_text"]
        )

        # 6. Generate grounded 'why fit' explanation
        explanation = await generate_fit_explanation(
            company=enriched,
            user_context=context,
            scores=breakdown
        )

        feed_items.append({
            "company": enriched["name"],
            "website": enriched["website"],
            "funding": enriched["funding"],
            "stage": enriched["stage"],
            "role": cand["jd_title"],
            "role_classification": breakdown.get("role_classification", "hybrid_builder"),
            "fit_score": fit_score,
            "fit_explanation": explanation,
            "jd_url": cand["jd_url"]
        })

    # Sort by fit_score descending
    feed_items.sort(key=lambda x: x["fit_score"], reverse=True)
    return feed_items


