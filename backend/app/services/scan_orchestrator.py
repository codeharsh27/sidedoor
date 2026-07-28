"""Orchestrates Stage 2 scan pipeline for target companies."""

import logging
from datetime import datetime, timezone
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.dialects.postgresql import insert

from app.db.models import Company, EvidenceItem, JobPosting
from app.services.collectors.base import EvidenceItemCreate
from app.services.collectors.hacker_news import HackerNewsCollector
from app.services.collectors.reddit import RedditCollector
from app.services.collectors.github import GitHubCollector
from app.services.collectors.x_twitter import XTwitterCollector
from app.services.collectors.job_postings import JobPostingsCollector
from app.config import settings

logger = logging.getLogger(__name__)


async def scan_company(company_id: str, db: AsyncSession) -> dict:
    """Run all active collectors for a company, respecting caching limits."""
    # 1. Fetch company
    stmt = select(Company).where(Company.id == company_id)
    result = await db.execute(stmt)
    company = result.scalar_one_or_none()
    if not company:
        raise ValueError(f"Company with ID {company_id} not found")

    # 2. Cache check: If scanned in the last 6 hours, return existing count
    now = datetime.now(timezone.utc)
    if company.last_scanned_at and (now - company.last_scanned_at.replace(tzinfo=timezone.utc)).total_seconds() < 21600:
        logger.info("Serving company scan from cache for: %s", company.name)
        stmt_count = select(EvidenceItem).where(EvidenceItem.company_id == company.id)
        result_count = await db.execute(stmt_count)
        existing_count = len(result_count.scalars().all())
        return {
            "status": "cached",
            "evidence_count": existing_count,
            "scan_status": company.scan_status,
            "last_scanned_at": company.last_scanned_at,
        }

    # Update status to scanning
    company.scan_status = "scanning"
    await db.commit()

    evidence_items: list[EvidenceItemCreate] = []

    # 3. Instantiate collectors
    hn_collector = HackerNewsCollector()
    reddit_collector = RedditCollector()
    github_collector = GitHubCollector()
    twitter_collector = XTwitterCollector()
    jobs_collector = JobPostingsCollector()

    # 4. Collect Job Postings (independent of evidence signal checks)
    try:
        jobs = await jobs_collector.collect(
            company_name=company.name,
            careers_page_url=company.careers_page_url,
            ats_slug=company.ats_slug,
        )
        if jobs:
            # Delete old job postings
            await db.execute(delete(JobPosting).where(JobPosting.company_id == company.id))
            # Insert new job postings
            for job in jobs:
                db_job = JobPosting(
                    company_id=company.id,
                    title=job.title,
                    raw_text=job.raw_text,
                    posted_at=job.posted_at,
                )
                db.add(db_job)
    except Exception as e:
        logger.error("Job collection failed for %s: %s", company.name, e)

    # 5. Collect evidence items (HN, Reddit, GitHub)
    try:
        hn_items = await hn_collector.collect(company.name, company.url)
        evidence_items.extend(hn_items)
    except Exception as e:
        logger.error("HN collection failed for %s: %s", company.name, e)

    try:
        reddit_items = await reddit_collector.collect(company.name, company.url)
        evidence_items.extend(reddit_items)
    except Exception as e:
        logger.error("Reddit collection failed for %s: %s", company.name, e)

    if company.github_repo_url:
        try:
            gh_items = await github_collector.collect(
                company.name, company.url, github_repo_url=company.github_repo_url
            )
            evidence_items.extend(gh_items)
        except Exception as e:
            logger.error("GitHub collection failed for %s: %s", company.name, e)

    # 6. Fallback to Twitter/X if signal is weak (< 5 items)
    if len(evidence_items) < 5 and settings.twitter_bearer_token:
        try:
            x_items = await twitter_collector.collect(company.name, company.url)
            evidence_items.extend(x_items)
        except Exception as e:
            logger.error("Twitter collection failed for %s: %s", company.name, e)

    # 7. Insufficient signal check (PRD §6 assumption)
    if len(evidence_items) < 3:
        logger.info("Insufficient signal for company %s (found %d items)", company.name, len(evidence_items))
        company.scan_status = "insufficient_signal"
        company.last_scanned_at = now
        await db.commit()
        return {
            "status": "insufficient_signal",
            "evidence_count": len(evidence_items),
            "scan_status": company.scan_status,
            "last_scanned_at": company.last_scanned_at,
        }

    # 8. Save evidence items with ON CONFLICT DO NOTHING for idempotency
    saved_count = 0
    for item in evidence_items:
        try:
            stmt_insert = insert(EvidenceItem).values(
                company_id=company.id,
                source_type=item.source_type,
                source_url=item.source_url,
                raw_text=item.raw_text,
                author_handle=item.author_handle,
                posted_at=item.posted_at,
            )
            # Avoid database unique constraint collisions
            stmt_upsert = stmt_insert.on_conflict_do_nothing(index_elements=["source_url"])
            res = await db.execute(stmt_upsert)
            # res.rowcount is 1 if inserted, 0 if skipped
            if res.rowcount > 0:
                saved_count += 1
        except Exception as e:
            logger.error("Failed to insert evidence item %s: %s", item.source_url, e)

    # Update company scan metadata
    company.scan_status = "done"
    company.last_scanned_at = now
    await db.commit()

    # Re-fetch total items to give an accurate count
    stmt_final_count = select(EvidenceItem).where(EvidenceItem.company_id == company.id)
    res_final = await db.execute(stmt_final_count)
    total_count = len(res_final.scalars().all())

    return {
        "status": "done",
        "evidence_count": total_count,
        "newly_saved_count": saved_count,
        "scan_status": company.scan_status,
        "last_scanned_at": company.last_scanned_at,
    }
