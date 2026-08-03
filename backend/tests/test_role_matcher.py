"""
Tests for Stage 4 Role Matcher.
"""

import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import EvidenceItem, GapCluster, JobPosting, RoleMatch
from app.services.role_matcher import _tokenize, match_roles


def _make_job(title: str, text: str, is_open: bool = True):
    job = MagicMock(spec=JobPosting)
    job.id = uuid.uuid4()
    job.title = title
    job.raw_text = text
    job.is_open = is_open
    return job


def _make_cluster(label: str, evidence_ids: list | None = None):
    c = MagicMock(spec=GapCluster)
    c.id = uuid.uuid4()
    c.label = label
    c.evidence_item_ids = evidence_ids or [uuid.uuid4()]
    return c


def _make_db_for_roles(
    clusters: list,
    jobs: list,
    evidence_texts: dict | None = None,
    existing_match=None,
):
    session = MagicMock(spec=AsyncSession)

    # 1. select GapClusters
    res_clusters = MagicMock()
    res_clusters.scalars.return_value.all.return_value = clusters

    # 2. select open JobPostings
    res_jobs = MagicMock()
    res_jobs.scalars.return_value.all.return_value = jobs

    # 3. For each cluster, fetch evidence items raw_text
    ev_results = []
    for cluster in clusters:
        res_items = MagicMock()
        text_list = evidence_texts.get(cluster.id, ["some text"]) if evidence_texts else ["some text"]
        res_items.scalars.return_value.all.return_value = text_list
        ev_results.append(res_items)

    # 4. Subsequent queries inside loops to check existing role matches
    match_results = []
    for _ in clusters:
        for _ in jobs:
            res_match = MagicMock()
            res_match.scalar_one_or_none.return_value = existing_match
            match_results.append(res_match)

    session.execute = AsyncMock(
        side_effect=[res_clusters, res_jobs] + ev_results + match_results
    )

    nested_ctx = AsyncMock()
    nested_ctx.__aenter__ = AsyncMock(return_value=nested_ctx)
    nested_ctx.__aexit__ = MagicMock(return_value=False)
    session.begin_nested = MagicMock(return_value=nested_ctx)

    session.add = MagicMock()
    session.flush = AsyncMock()

    return session


def test_tokenize_filters_stopwords_and_punctuation():
    """_tokenize converts to lowercase, filters punctuation, and strips stopwords."""
    text = "The Python backend developer was looking for standard API design!"
    tokens = _tokenize(text)
    # Check that punctuation like '!' is gone, 'the', 'was', 'for' are filtered
    assert "python" in tokens
    assert "backend" in tokens
    assert "api" in tokens
    assert "design" in tokens
    assert "the" not in tokens
    assert "was" not in tokens


def test_tokenize_filters_short_words():
    """_tokenize filters words < 3 characters."""
    tokens = _tokenize("go to do backend on my pc")
    assert "pc" not in tokens
    assert "do" not in tokens
    assert "backend" in tokens


@pytest.mark.asyncio
async def test_match_roles_happy_path():
    """High keyword overlap returns score > threshold, logs overlap terms in reason."""
    c = _make_cluster("python api auth", [uuid.uuid4()])
    job = _make_job("Python Backend Developer", "We build python api with oauth authentication.")
    db = _make_db_for_roles([c], [job], {c.id: ["python api oauth auth login"]})

    added_matches = []
    db.add.side_effect = lambda x: added_matches.append(x) if isinstance(x, RoleMatch) else None

    # Enable lower threshold to ensure match triggers
    with patch("app.services.role_matcher.settings") as mock_settings:
        mock_settings.role_match_min_score = 0.05
        mock_settings.role_match_max_reasons = 3

        ids = await match_roles(uuid.uuid4(), db)
        assert len(ids) == 1
        assert len(added_matches) == 1
        assert added_matches[0].match_score > 0.0
        assert "overlap: python" in added_matches[0].match_reason
        assert "api" in added_matches[0].match_reason


@pytest.mark.asyncio
async def test_match_roles_below_threshold_skipped():
    """No matching keywords should yield similarity below threshold and skip write."""
    c = _make_cluster("watercolor painting artist", [uuid.uuid4()])
    job = _make_job("Python Backend Developer", "We use fastapi and postgresql.")
    db = _make_db_for_roles([c], [job], {c.id: ["watercolor canvas oil fine art"]})

    added_matches = []
    db.add.side_effect = lambda x: added_matches.append(x) if isinstance(x, RoleMatch) else None

    ids = await match_roles(uuid.uuid4(), db)
    assert len(ids) == 0
    assert len(added_matches) == 0


@pytest.mark.asyncio
async def test_match_roles_updates_existing_match():
    """RoleMatch updates existing score if a record already exists, keeping it unique."""
    c = _make_cluster("python api auth", [uuid.uuid4()])
    job = _make_job("Python Backend Developer", "We use python api auth.")

    existing_match = MagicMock(spec=RoleMatch)
    existing_match.id = uuid.uuid4()
    existing_match.match_score = 0.1

    db = _make_db_for_roles(
        [c], [job], {c.id: ["python api auth"]}, existing_match=existing_match
    )

    with patch("app.services.role_matcher.settings") as mock_settings:
        mock_settings.role_match_min_score = 0.01
        mock_settings.role_match_max_reasons = 3

        ids = await match_roles(uuid.uuid4(), db)
        assert len(ids) == 1
        assert ids[0] == existing_match.id
        assert existing_match.match_score > 0.1  # score updated to higher value
        assert "overlap:" in existing_match.match_reason
