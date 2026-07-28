"""API routes for company management and scanning."""

import logging
import uuid
from typing import Any
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, HttpUrl, field_validator, ConfigDict
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Company, EvidenceItem, JobPosting
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
    scan_status: str
    last_scanned_at: Any | None


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
    company_id: str, db: AsyncSession = Depends(get_db_session)
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
        scan_results = await scan_company(str(company.id), db)
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
