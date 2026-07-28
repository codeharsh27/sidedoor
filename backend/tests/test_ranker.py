"""
Tests for Stage 3 Ranker.

All tests are offline-safe (no DB, no network).
DB calls are mocked with AsyncMock / MagicMock.

Test coverage:
  - Happy path: all clusters in a company get a rank_score
  - Formula components: higher evidence count, more recent items, better source
    type each independently increase rank_score
  - Source credibility lookup: github_issue > hacker_news > reddit > x_post > job_posting
  - Unknown source type uses fallback without raising
  - Missing posted_at uses neutral recency (0.5)
  - Formula is deterministic: same input → same output
  - Ranker returns 0 gracefully when no clusters exist
  - Per-cluster failure is isolated: one bad cluster doesn't crash others
  - Log-normalisation: cluster with more items than max_count not broken
"""

import uuid
import math
from datetime import datetime, timezone, timedelta
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.ranker import (
    _item_recency_score,
    _source_credibility,
    rank_clusters,
)


# ---------------------------------------------------------------------------
# Helpers to build minimal fakes
# ---------------------------------------------------------------------------


def _make_evidence_item(
    source_type: str = "hacker_news",
    posted_at: datetime | None = None,
):
    obj = MagicMock()
    obj.id = uuid.uuid4()
    obj.source_type = source_type
    obj.posted_at = posted_at
    return obj


def _make_cluster(
    cluster_id: uuid.UUID | None = None,
    evidence_count: int = 1,
    item_ids: list | None = None,
    label: str = "test cluster",
):
    obj = MagicMock()
    obj.id = cluster_id or uuid.uuid4()
    obj.evidence_count = evidence_count
    obj.evidence_item_ids = item_ids or [uuid.uuid4() for _ in range(evidence_count)]
    obj.label = label
    obj.recency_score = 0.0
    obj.rank_score = 0.0
    return obj


def _make_db_for_ranker(
    clusters: list,
    items_per_cluster: dict | None = None,
):
    """
    Build a mock DB session that:
      - Returns `clusters` on the first execute (cluster SELECT).
      - Returns appropriate items on subsequent executes (items SELECT per cluster).
    """
    session = MagicMock(spec=AsyncSession)

    # Build a side_effect list for execute:
    # Call 0: SELECT gap_clusters → return clusters
    # Calls 1+: SELECT evidence_items for each cluster
    clusters_result = MagicMock()
    clusters_result.scalars.return_value.all.return_value = clusters

    side_effects = [clusters_result]
    if items_per_cluster:
        for cluster in clusters:
            cluster_items = items_per_cluster.get(cluster.id, [])
            items_result = MagicMock()
            items_result.scalars.return_value.all.return_value = cluster_items
            side_effects.append(items_result)
    else:
        # Default: each cluster's items select returns empty list
        for _ in clusters:
            items_result = MagicMock()
            items_result.scalars.return_value.all.return_value = []
            side_effects.append(items_result)

    session.execute = AsyncMock(side_effect=side_effects)

    # begin_nested() must be an async context manager
    nested_ctx = AsyncMock()
    nested_ctx.__aenter__ = AsyncMock(return_value=nested_ctx)
    nested_ctx.__aexit__ = AsyncMock(return_value=False)
    session.begin_nested = MagicMock(return_value=nested_ctx)

    session.add = MagicMock()

    return session


# ---------------------------------------------------------------------------
# Unit tests: pure helper functions
# ---------------------------------------------------------------------------


class TestSourceCredibility:
    """Tests for the _source_credibility() lookup."""

    def test_github_issue_highest(self):
        assert _source_credibility("github_issue") == 1.00

    def test_hacker_news_high(self):
        assert _source_credibility("hacker_news") == 0.85

    def test_reddit_mid(self):
        assert _source_credibility("reddit") == 0.65

    def test_x_post_lower(self):
        assert _source_credibility("x_post") == 0.50

    def test_job_posting_lowest_known(self):
        assert _source_credibility("job_posting") == 0.40

    def test_ordering_correct(self):
        """Source types are ordered as documented."""
        assert (
            _source_credibility("github_issue")
            > _source_credibility("hacker_news")
            > _source_credibility("reddit")
            > _source_credibility("x_post")
            > _source_credibility("job_posting")
        )

    def test_unknown_source_returns_fallback(self):
        """Unknown source type must return fallback 0.30, not raise."""
        score = _source_credibility("totally_unknown_source")
        assert score == 0.30

    def test_empty_string_returns_fallback(self):
        score = _source_credibility("")
        assert score == 0.30


class TestItemRecencyScore:
    """Tests for the _item_recency_score() decay formula."""

    def test_none_posted_at_returns_neutral(self):
        assert _item_recency_score(None, decay_days=180) == 0.5

    def test_today_returns_one(self):
        """Item posted today should get score very close to 1.0."""
        now = datetime.now(timezone.utc)
        score = _item_recency_score(now, decay_days=180)
        assert score > 0.99

    def test_fully_decayed_returns_zero(self):
        """Item posted >= decay_days ago should return 0.0."""
        old = datetime.now(timezone.utc) - timedelta(days=200)
        score = _item_recency_score(old, decay_days=180)
        assert score == 0.0

    def test_halfway_decayed(self):
        """Item posted exactly halfway through decay should return ~0.5."""
        halfway = datetime.now(timezone.utc) - timedelta(days=90)
        score = _item_recency_score(halfway, decay_days=180)
        assert 0.45 <= score <= 0.55

    def test_naive_datetime_handled(self):
        """Naive datetime (no tzinfo) should not crash — treated as UTC."""
        naive_now = datetime.utcnow()  # no tzinfo
        score = _item_recency_score(naive_now, decay_days=180)
        assert score > 0.99

    def test_score_bounded_zero_to_one(self):
        """Score is always in [0.0, 1.0] regardless of input."""
        far_future = datetime.now(timezone.utc) + timedelta(days=1000)
        score_future = _item_recency_score(far_future, decay_days=180)
        # Future dates should score 1.0 (max(0, 1 - negative_age) = 1.0)
        assert 0.0 <= score_future <= 1.0

        far_past = datetime.now(timezone.utc) - timedelta(days=10000)
        score_past = _item_recency_score(far_past, decay_days=180)
        assert score_past == 0.0


# ---------------------------------------------------------------------------
# Integration tests: rank_clusters() with mocked DB
# ---------------------------------------------------------------------------


class TestRankClusters:
    """Tests for the rank_clusters() orchestration function."""

    company_id = uuid.uuid4()

    @pytest.mark.asyncio
    async def test_returns_zero_when_no_clusters(self):
        """No clusters for a company → returns 0 without raising."""
        db = _make_db_for_ranker(clusters=[])
        result = await rank_clusters(self.company_id, db)
        assert result == 0

    @pytest.mark.asyncio
    async def test_all_clusters_receive_rank_score(self):
        """Every cluster in the company gets a non-zero rank_score persisted."""
        c1 = _make_cluster(evidence_count=5)
        c2 = _make_cluster(evidence_count=2)
        items_1 = [_make_evidence_item("hacker_news") for _ in range(5)]
        items_2 = [_make_evidence_item("reddit") for _ in range(2)]
        db = _make_db_for_ranker(
            [c1, c2], {c1.id: items_1, c2.id: items_2}
        )

        ranked = await rank_clusters(self.company_id, db)
        assert ranked == 2
        assert c1.rank_score > 0.0
        assert c2.rank_score > 0.0

    @pytest.mark.asyncio
    async def test_higher_evidence_count_ranks_higher(self):
        """
        Two clusters with the same recency and source type:
        the one with more items should rank higher.
        """
        now = datetime.now(timezone.utc)
        c_big = _make_cluster(evidence_count=10)
        c_small = _make_cluster(evidence_count=1)

        # Same source type and recency for both → count is the differentiator
        items_big = [_make_evidence_item("reddit", now) for _ in range(10)]
        items_small = [_make_evidence_item("reddit", now)]

        db = _make_db_for_ranker(
            [c_big, c_small],
            {c_big.id: items_big, c_small.id: items_small},
        )
        await rank_clusters(self.company_id, db)
        assert c_big.rank_score > c_small.rank_score

    @pytest.mark.asyncio
    async def test_recent_cluster_ranks_higher_than_old(self):
        """
        Two single-item clusters with the same source type:
        the one with a recent post should rank higher.
        """
        now = datetime.now(timezone.utc)
        old = now - timedelta(days=170)

        c_recent = _make_cluster(evidence_count=1)
        c_old = _make_cluster(evidence_count=1)

        items_recent = [_make_evidence_item("reddit", now)]
        items_old = [_make_evidence_item("reddit", old)]

        db = _make_db_for_ranker(
            [c_recent, c_old],
            {c_recent.id: items_recent, c_old.id: items_old},
        )
        await rank_clusters(self.company_id, db)
        assert c_recent.rank_score > c_old.rank_score

    @pytest.mark.asyncio
    async def test_github_issue_ranks_higher_than_reddit(self):
        """
        Two single-item clusters, same recency, same count:
        github_issue source should produce a higher rank_score than reddit.
        """
        now = datetime.now(timezone.utc)
        c_github = _make_cluster(evidence_count=1)
        c_reddit = _make_cluster(evidence_count=1)

        items_gh = [_make_evidence_item("github_issue", now)]
        items_rd = [_make_evidence_item("reddit", now)]

        db = _make_db_for_ranker(
            [c_github, c_reddit],
            {c_github.id: items_gh, c_reddit.id: items_rd},
        )
        await rank_clusters(self.company_id, db)
        assert c_github.rank_score > c_reddit.rank_score

    @pytest.mark.asyncio
    async def test_missing_posted_at_uses_neutral_recency(self):
        """
        Items with no posted_at must contribute neutral recency (0.5),
        not crash or zero-out the score.
        """
        c = _make_cluster(evidence_count=1)
        items = [_make_evidence_item("reddit", None)]  # None posted_at

        db = _make_db_for_ranker([c], {c.id: items})
        await rank_clusters(self.company_id, db)

        # rank_score must be > 0 (neutral recency still contributes)
        assert c.rank_score > 0.0
        assert c.recency_score == 0.5

    @pytest.mark.asyncio
    async def test_unknown_source_type_uses_fallback(self):
        """Unknown source_type must not raise; fallback credibility 0.30 is used."""
        now = datetime.now(timezone.utc)
        c = _make_cluster(evidence_count=1)
        items = [_make_evidence_item("totally_new_source", now)]

        db = _make_db_for_ranker([c], {c.id: items})
        # Should not raise
        ranked = await rank_clusters(self.company_id, db)
        assert ranked == 1
        assert c.rank_score > 0.0

    @pytest.mark.asyncio
    async def test_formula_is_deterministic(self):
        """
        Running rank_clusters twice with the same input produces the same
        rank_score — formula is purely deterministic.
        """
        now = datetime.now(timezone.utc) - timedelta(days=30)
        c1_id = uuid.uuid4()

        def make_setup():
            c = _make_cluster(cluster_id=c1_id, evidence_count=3)
            items = [_make_evidence_item("hacker_news", now) for _ in range(3)]
            db = _make_db_for_ranker([c], {c.id: items})
            return c, db

        c_run1, db1 = make_setup()
        c_run2, db2 = make_setup()

        await rank_clusters(self.company_id, db1)
        await rank_clusters(self.company_id, db2)

        # Scores must match to 6 decimal places
        assert abs(c_run1.rank_score - c_run2.rank_score) < 1e-6

    @pytest.mark.asyncio
    async def test_cluster_with_no_item_ids_uses_neutral_fallback(self):
        """
        A cluster with an empty evidence_item_ids list must not crash —
        neutral fallback values are used for recency and credibility.
        """
        c = _make_cluster(evidence_count=1, item_ids=[])
        db = _make_db_for_ranker([c], {c.id: []})

        ranked = await rank_clusters(self.company_id, db)
        assert ranked == 1
        # Rank score is still computed (with neutral values)
        assert c.rank_score >= 0.0

    @pytest.mark.asyncio
    async def test_recency_score_written_to_cluster(self):
        """recency_score field on the cluster object is updated during ranking."""
        now = datetime.now(timezone.utc)
        c = _make_cluster(evidence_count=1)
        items = [_make_evidence_item("hacker_news", now)]

        db = _make_db_for_ranker([c], {c.id: items})
        await rank_clusters(self.company_id, db)

        # recency_score should be close to 1.0 for a fresh item
        assert c.recency_score > 0.9

    @pytest.mark.asyncio
    async def test_rank_score_bounded_zero_to_one(self):
        """
        rank_score is a weighted sum of three [0,1] components with weights
        summing to 1.0 — the result must always be in [0, 1].
        """
        now = datetime.now(timezone.utc)
        c = _make_cluster(evidence_count=5)
        items = [_make_evidence_item("github_issue", now) for _ in range(5)]
        db = _make_db_for_ranker([c], {c.id: items})

        await rank_clusters(self.company_id, db)
        assert 0.0 <= c.rank_score <= 1.0

    @pytest.mark.asyncio
    async def test_single_cluster_is_max_log_normalised(self):
        """
        When there is only one cluster, log_norm(count) / log_norm(max_count)
        = 1.0, so it should get the maximum possible count contribution.
        """
        now = datetime.now(timezone.utc)
        c = _make_cluster(evidence_count=5)
        items = [_make_evidence_item("github_issue", now) for _ in range(5)]
        db = _make_db_for_ranker([c], {c.id: items})

        await rank_clusters(self.company_id, db)
        # With count_norm=1.0, recency~1.0, credibility=1.0, rank should be ~1.0
        assert c.rank_score > 0.95

    @pytest.mark.asyncio
    async def test_mixed_source_types_averaged(self):
        """
        A cluster with both github_issue and reddit items should have a
        credibility between their individual values.
        """
        now = datetime.now(timezone.utc)
        c = _make_cluster(evidence_count=2)
        items = [
            _make_evidence_item("github_issue", now),
            _make_evidence_item("reddit", now),
        ]
        # Expected credibility = (1.00 + 0.65) / 2 = 0.825
        db = _make_db_for_ranker([c], {c.id: items})
        await rank_clusters(self.company_id, db)

        # github-only cluster
        c_gh = _make_cluster(evidence_count=2)
        items_gh = [_make_evidence_item("github_issue", now) for _ in range(2)]
        db_gh = _make_db_for_ranker([c_gh], {c_gh.id: items_gh})
        await rank_clusters(self.company_id, db_gh)

        # reddit-only cluster
        c_rd = _make_cluster(evidence_count=2)
        items_rd = [_make_evidence_item("reddit", now) for _ in range(2)]
        db_rd = _make_db_for_ranker([c_rd], {c_rd.id: items_rd})
        await rank_clusters(self.company_id, db_rd)

        # Mixed should be between reddit-only and github-only
        assert c_rd.rank_score < c.rank_score < c_gh.rank_score
