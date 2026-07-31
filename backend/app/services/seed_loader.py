"""
Phase 2 Seed Loader Service — loads and upserts curated VC-backed seed companies.

Reads backend/data/seed_companies.json and upserts companies into the companies table.
"""

import json
import logging
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Company

logger = logging.getLogger(__name__)

SEED_FILE_PATH = Path(__file__).parent.parent.parent / "data" / "seed_companies.json"


async def load_seed_companies(db: AsyncSession) -> int:
    """
    Read seed_companies.json and upsert each company.
    Returns count of loaded/upserted companies.
    """
    if not SEED_FILE_PATH.exists():
        logger.warning("Seed companies file not found at %s", SEED_FILE_PATH)
        return 0

    try:
        with open(SEED_FILE_PATH, "r", encoding="utf-8") as f:
            seeds = json.load(f)
    except Exception as e:
        logger.error("Failed to read seed companies JSON: %s", e)
        return 0

    loaded_count = 0

    for item in seeds:
        name = item.get("name")
        url = item.get("url")
        if not name or not url:
            continue

        try:
            # Check if company already exists by name or url
            stmt = select(Company).where(
                (Company.name == name) | (Company.url == url)
            )
            res = await db.execute(stmt)
            company = res.scalar_one_or_none()

            if company:
                # Update metadata
                company.github_repo_url = item.get("github_repo_url") or company.github_repo_url
                company.careers_page_url = item.get("careers_page_url") or company.careers_page_url
                company.funding_stage = item.get("funding_stage")
                company.investor_tags = item.get("investor_tags", [])
                company.employee_count_approx = item.get("employee_count_approx")
                company.tech_stack_tags = item.get("tech_stack_tags", [])
                company.is_seed_list = True
                company.seed_list_source = item.get("seed_list_source")
            else:
                # Insert new company
                company = Company(
                    name=name,
                    url=url,
                    github_repo_url=item.get("github_repo_url"),
                    careers_page_url=item.get("careers_page_url"),
                    funding_stage=item.get("funding_stage"),
                    investor_tags=item.get("investor_tags", []),
                    employee_count_approx=item.get("employee_count_approx"),
                    tech_stack_tags=item.get("tech_stack_tags", []),
                    is_seed_list=True,
                    seed_list_source=item.get("seed_list_source"),
                    scan_status="pending",
                )
                db.add(company)

            await db.flush()
            loaded_count += 1
        except Exception as err:
            logger.error("Failed to upsert seed company %s: %s", name, err)

    await db.commit()
    logger.info("Successfully loaded/upserted %d seed companies", loaded_count)
    return loaded_count
