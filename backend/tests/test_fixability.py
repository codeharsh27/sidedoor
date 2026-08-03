"""
Tests for Stage 4 Fixability filter.
"""

import uuid
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Company, GapCluster, FixabilityFlag
from app.services.fixability import compute_fixability


def _make_company(has_repo: bool = True):
    comp = MagicMock(spec=Company)
    comp.id = uuid.uuid4()
    comp.name = "Test Company"
    comp.github_repo_url = "https://github.com/test/repo" if has_repo else None
    return comp


def _make_cluster(company_id: uuid.UUID):
    cluster = MagicMock(spec=GapCluster)
    cluster.id = uuid.uuid4()
    cluster.company_id = company_id
    cluster.label = "auth login failure"
    return cluster


def _make_db(company, clusters, existing_flag=None):
    session = MagicMock(spec=AsyncSession)

    # Mock execute results
    # 1st call: select Company
    res_company = MagicMock()
    res_company.scalar_one_or_none.return_value = company

    # 2nd call: select GapClusters
    res_clusters = MagicMock()
    res_clusters.scalars.return_value.all.return_value = clusters

    # Subsequent calls in loop:
    # 1. select EvidenceItem per cluster
    # 2. select FixabilityFlag per cluster
    loop_results = []
    for _ in clusters:
        res_ev = MagicMock()
        res_ev.scalars.return_value.all.return_value = []
        res_flag = MagicMock()
        res_flag.scalar_one_or_none.return_value = existing_flag
        loop_results.extend([res_ev, res_flag])

    session.execute = AsyncMock(side_effect=[res_company, res_clusters] + loop_results)

    # nested savepoint context
    nested_ctx = AsyncMock()
    nested_ctx.__aenter__ = AsyncMock(return_value=nested_ctx)
    nested_ctx.__aexit__ = AsyncMock(return_value=False)
    session.begin_nested = MagicMock(return_value=nested_ctx)

    session.add = MagicMock()
    session.flush = AsyncMock()

    return session


@pytest.mark.asyncio
async def test_compute_fixability_happy_path_with_repo():
    """If company has repo, _classify_cluster_llm is called and sets fixability_type."""
    company = _make_company(has_repo=True)
    cluster = _make_cluster(company.id)
    db = _make_db(company, [cluster])

    added_flags = []
    db.add.side_effect = lambda x: added_flags.append(x) if isinstance(x, FixabilityFlag) else None

    with patch("app.services.fixability._classify_cluster_llm", AsyncMock(return_value=("direct_surface", "Has public GitHub repo"))):
        ids = await compute_fixability(company.id, db)
        assert len(ids) == 1
        assert len(added_flags) == 1
        assert added_flags[0].has_public_repo is True
        assert added_flags[0].fixability_type == "direct_surface"
        assert added_flags[0].is_buildable is True


@pytest.mark.asyncio
async def test_compute_fixability_no_repo():
    """If company has no repo, LLM classification determines fixability_type."""
    company = _make_company(has_repo=False)
    cluster = _make_cluster(company.id)
    db = _make_db(company, [cluster])

    added_flags = []
    db.add.side_effect = lambda x: added_flags.append(x) if isinstance(x, FixabilityFlag) else None

    with patch("app.services.fixability._classify_cluster_llm", AsyncMock(return_value=("stated_pain_point", "Specific pain point documented"))):
        ids = await compute_fixability(company.id, db)
        assert len(ids) == 1
        assert added_flags[0].has_public_repo is False
        assert added_flags[0].fixability_type == "stated_pain_point"
        assert added_flags[0].is_buildable is True


@pytest.mark.asyncio
async def test_compute_fixability_updates_existing_flag():
    """Existing flag is updated with new fixability_type."""
    company = _make_company(has_repo=True)
    cluster = _make_cluster(company.id)
    existing_flag = FixabilityFlag(
        gap_cluster_id=cluster.id,
        company_id=company.id,
        has_public_repo=False,
        has_public_api=False,
        has_ui_surface=True,
        is_buildable=False,
        fixability_type="too_vague",
        fixability_reason="Old reason",
    )
    db = _make_db(company, [cluster], existing_flag=existing_flag)

    with patch("app.services.fixability._classify_cluster_llm", AsyncMock(return_value=("direct_surface", "Updated to direct_surface"))):
        ids = await compute_fixability(company.id, db)
        assert len(ids) == 1
        assert existing_flag.fixability_type == "direct_surface"
        assert existing_flag.is_buildable is True


@pytest.mark.asyncio
async def test_compute_fixability_no_clusters():
    """If company has no gap clusters, returns empty list gracefully."""
    company = _make_company(has_repo=True)
    db = _make_db(company, [])

    ids = await compute_fixability(company.id, db)
    assert len(ids) == 0


@pytest.mark.asyncio
async def test_compute_fixability_company_not_found():
    """If company is not found, returns empty list gracefully."""
    db = _make_db(None, [])
    ids = await compute_fixability(uuid.uuid4(), db)
    assert len(ids) == 0
