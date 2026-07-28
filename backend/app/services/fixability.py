"""
Stage 4 Fixability Filter — checks if a gap has an active public build surface.

We compute:
  - has_public_repo: True if company.github_repo_url is populated.
  - has_public_api: Manually-curated v1 flag, default False (as per ARCHITECTURE.md §3.5).
  - has_ui_surface: True (most startups/companies have a web UI to extend).
  - is_buildable: has_public_repo OR has_public_api OR has_ui_surface.

All writes are savepoint-isolated.
"""

import logging
import uuid
from datetime import datetime, timezone

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Company, GapCluster, FixabilityFlag

logger = logging.getLogger(__name__)


async def compute_fixability(
    company_id: uuid.UUID,
    db: AsyncSession,
) -> list[uuid.UUID]:
    """
    Compute and persist fixability flags for all gap clusters of a company.

    For each gap cluster, computes boolean indicators of buildability and
    writes them to the fixability_flags table. This is fully idempotent:
    existing flags are deleted/re-created or updated.

    Args:
        company_id: The UUID of the company.
        db: Active async DB session.

    Returns:
        List of UUIDs of the persisted FixabilityFlag rows.
    """
    # 1. Fetch company to get github_repo_url
    stmt_company = select(Company).where(Company.id == company_id)
    res_company = await db.execute(stmt_company)
    company = res_company.scalar_one_or_none()
    if not company:
        logger.error("Company %s not found for fixability check", company_id)
        return []

    # 2. Fetch all gap clusters for this company
    stmt_clusters = select(GapCluster).where(GapCluster.company_id == company_id)
    res_clusters = await db.execute(stmt_clusters)
    clusters = res_clusters.scalars().all()

    if not clusters:
        logger.info("No gap clusters found to compute fixability for company %s", company.name)
        return []

    # 3. Compute flags (constant for all clusters since they relate to the company)
    has_repo = company.github_repo_url is not None and len(company.github_repo_url.strip()) > 0
    has_api = False  # Manually-curated in v1 (default False)
    has_ui = True    # Default true for all companies unless overridden
    is_buildable = has_repo or has_api or has_ui

    persisted_ids: list[uuid.UUID] = []

    for cluster in clusters:
        try:
            async with db.begin_nested():
                # Check if flag already exists to update or create
                stmt_flag = select(FixabilityFlag).where(
                    FixabilityFlag.gap_cluster_id == cluster.id
                )
                res_flag = await db.execute(stmt_flag)
                flag = res_flag.scalar_one_or_none()

                if flag:
                    flag.has_public_repo = has_repo
                    flag.has_public_api = has_api
                    flag.has_ui_surface = has_ui
                    flag.is_buildable = is_buildable
                    flag.computed_at = datetime.now(timezone.utc)
                else:
                    flag = FixabilityFlag(
                        gap_cluster_id=cluster.id,
                        company_id=company_id,
                        has_public_repo=has_repo,
                        has_public_api=has_api,
                        has_ui_surface=has_ui,
                        is_buildable=is_buildable,
                        computed_at=datetime.now(timezone.utc),
                    )
                    db.add(flag)

                await db.flush()
                persisted_ids.append(flag.id)

                logger.info(
                    "Fixability Flag computed for cluster %s (company %s): "
                    "has_repo=%s, has_api=%s, has_ui=%s -> is_buildable=%s",
                    cluster.id,
                    company.name,
                    has_repo,
                    has_api,
                    has_ui,
                    is_buildable,
                )
        except Exception as e:
            logger.error(
                "Failed to compute/persist fixability flag for cluster %s: %s",
                cluster.id,
                e,
            )

    return persisted_ids
