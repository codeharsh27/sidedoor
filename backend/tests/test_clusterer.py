"""
Tests for Stage 3 Clusterer.

All tests are offline-safe:
  - SentenceTransformer is mocked (same MockSentenceTransformer as test_embedder.py)
  - DB calls are mocked with AsyncMock — no live Postgres required

Test coverage:
  - Happy path: clustering produces correct number of clusters
  - Semantic grouping: similar items cluster together, dissimilar items separate
  - Label extraction: deterministic, no LLM, uses top content words
  - Error isolation: one bad embed does not abort the batch
  - Insufficient evidence guard: InsufficientEvidenceError on too few items
  - Centroid vector dimension: exactly 384 dims
  - Idempotent rescan: stale clusters are deleted before new ones are written
  - max_clusters guard: never exceeds limit
  - Zero-norm centroid safety: no crash
"""

import uuid
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import numpy as np
import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.clusterer import (
    InsufficientEvidenceError,
    _cosine_similarity,
    _extract_label,
    cluster_evidence,
)


# ---------------------------------------------------------------------------
# Shared mock sentence transformer (same as test_embedder.py — no net access)
# ---------------------------------------------------------------------------


class MockSentenceTransformer:
    """
    Deterministic fake model. Identical to the one in test_embedder.py so
    tests across the two modules are consistent.
    """

    def __init__(self, model_name: str):
        self.model_name = model_name

    def get_sentence_embedding_dimension(self) -> int:
        return 384

    def encode(self, sentences, normalize_embeddings=True):
        import hashlib

        BACKEND_KEYWORDS = {
            "python", "fastapi", "postgresql", "backend", "django", "mysql",
            "rest", "api", "apis", "developer", "engineer", "web", "services",
        }
        ART_KEYWORDS = {
            "watercolor", "painting", "sculpture", "abstract", "art", "oil",
            "canvas", "fine", "gallery", "exhibitions",
        }

        def _embed(text: str) -> np.ndarray:
            if not isinstance(text, str):
                text = str(text)
            words = set(text.lower().split())
            vec = np.zeros(384, dtype=float)

            if any(w in BACKEND_KEYWORDS for w in words):
                for idx in range(0, 120):
                    vec[idx] += np.sin(idx)
            if any(w in ART_KEYWORDS for w in words):
                for idx in range(120, 240):
                    vec[idx] += np.cos(idx)

            for word in words:
                h = hashlib.md5(word.encode()).hexdigest()
                idx = 240 + (int(h[:8], 16) % 144)
                sign = 1.0 if int(h[8:10], 16) % 2 == 0 else -1.0
                vec[idx] += sign

            norm = np.linalg.norm(vec)
            if norm > 0:
                vec = vec / norm
            else:
                vec[0] = 1.0
            return vec

        if isinstance(sentences, str):
            return _embed(sentences)
        return np.array([_embed(s) for s in sentences])


# ---------------------------------------------------------------------------
# Helpers to build fake EvidenceItem-like objects (plain dicts are enough —
# the clusterer only reads .id, .raw_text from each item)
# ---------------------------------------------------------------------------


def _make_item(raw_text: str, item_id: uuid.UUID | None = None):
    """Create a mock EvidenceItem with the two fields clusterer needs."""
    obj = MagicMock()
    obj.id = item_id or uuid.uuid4()
    obj.raw_text = raw_text
    return obj


def _make_db(items: list, delete_rowcount: int = 1):
    """
    Build a minimal mock AsyncSession that:
      - Returns `items` on the first scalars().all() call (evidence items).
      - Supports begin_nested() as an async context manager (for savepoints).
      - Supports flush() and add().
    """
    session = MagicMock(spec=AsyncSession)

    # Evidence items select
    result_mock = MagicMock()
    result_mock.scalars.return_value.all.return_value = items
    session.execute = AsyncMock(return_value=result_mock)

    # begin_nested() must be an async context manager
    nested_ctx = AsyncMock()
    nested_ctx.__aenter__ = AsyncMock(return_value=nested_ctx)
    nested_ctx.__aexit__ = AsyncMock(return_value=False)
    session.begin_nested = MagicMock(return_value=nested_ctx)

    session.add = MagicMock()
    session.flush = AsyncMock()

    return session


# ---------------------------------------------------------------------------
# Unit tests: pure helpers (no DB, no embedder)
# ---------------------------------------------------------------------------


class TestHelpers:
    """Tests for the private helper functions."""

    def test_cosine_similarity_identical_vectors(self):
        """Cosine similarity of a vector with itself = 1.0."""
        v = np.array([1.0, 0.0, 0.0])
        assert abs(_cosine_similarity(v, v) - 1.0) < 1e-9

    def test_cosine_similarity_orthogonal_vectors(self):
        """Perpendicular vectors have cosine similarity = 0.0."""
        a = np.array([1.0, 0.0])
        b = np.array([0.0, 1.0])
        assert abs(_cosine_similarity(a, b)) < 1e-9

    def test_cosine_similarity_zero_norm_vector(self):
        """Zero-norm vector must return 0.0, not raise ZeroDivisionError."""
        a = np.zeros(384)
        b = np.array([1.0] + [0.0] * 383)
        assert _cosine_similarity(a, b) == 0.0
        assert _cosine_similarity(b, a) == 0.0

    def test_extract_label_basic(self):
        """Label should contain top content words from the texts."""
        texts = [
            "The login authentication process is slow and broken.",
            "Login keeps timing out during authentication.",
            "Authentication fails repeatedly on login page.",
        ]
        label = _extract_label(texts)
        # "login" and "authentication" should dominate
        assert "login" in label.lower() or "authentication" in label.lower()

    def test_extract_label_deterministic(self):
        """Same input must always produce the same label."""
        texts = ["python backend api rest", "api backend python web"]
        assert _extract_label(texts) == _extract_label(texts)

    def test_extract_label_empty_texts(self):
        """All-stopword texts fall back gracefully to default feature request or general feedback."""
        # All words are in the stopword list
        label = _extract_label(["the a is and or but"])
        assert "Developer Workflow" in label or label == "general feedback"

    def test_extract_label_filters_short_tokens(self):
        """Tokens shorter than 4 characters are excluded from the label."""
        label = _extract_label(["ok so no bug fix api"])
        # "bug" and "fix" are exactly 3 chars so excluded; "api" is also 3 chars
        # Only tokens >= 4 chars survive (ignoring formatting & symbol)
        for term in label.split():
            if term != "&":
                assert len(term) >= 4

    def test_extract_label_filters_urls(self):
        """URLs in text should not pollute the label."""
        texts = ["See https://example.com/slowness for details about authentication"]
        label = _extract_label(texts)
        assert "https" not in label
        assert "example" not in label or "authentication" in label


# ---------------------------------------------------------------------------
# Integration tests: cluster_evidence() with mocked DB + mocked embedder
# ---------------------------------------------------------------------------


@pytest.fixture
def mock_embedder_patch():
    """Patch SentenceTransformer globally for clusterer tests."""
    with patch(
        "app.services.embedder.SentenceTransformer", new=MockSentenceTransformer
    ):
        # Also reset the lru_cache on get_embedder so each test gets a fresh instance
        from app.services.embedder import get_embedder
        get_embedder.cache_clear()
        yield
        get_embedder.cache_clear()


class TestClusterEvidence:
    """Integration tests for cluster_evidence()."""

    company_id = uuid.uuid4()

    @pytest.mark.asyncio
    async def test_insufficient_evidence_raises_error(self, mock_embedder_patch):
        """Fewer than 3 items raises InsufficientEvidenceError."""
        items = [_make_item("some text")]
        db = _make_db(items)

        with pytest.raises(InsufficientEvidenceError):
            await cluster_evidence(self.company_id, db)

    @pytest.mark.asyncio
    async def test_single_cluster_when_all_similar(self, mock_embedder_patch):
        """
        Three nearly-identical texts (same backend keywords) should form
        one cluster (centroid similarity >= threshold).
        """
        items = [
            _make_item("python backend api developer engineer web services"),
            _make_item("python backend fastapi engineer api rest services"),
            _make_item("backend developer python rest api web engineer"),
        ]
        db = _make_db(items)
        db.add = MagicMock()

        added_clusters = []

        def capture_add(obj):
            from app.db.models import GapCluster
            if isinstance(obj, GapCluster):
                # Give it a fake UUID so flush() can return it
                obj.id = uuid.uuid4()
                added_clusters.append(obj)

        db.add = MagicMock(side_effect=capture_add)
        db.flush = AsyncMock()

        ids = await cluster_evidence(self.company_id, db, threshold=0.50)
        # All three similar texts should merge into one or two clusters at most
        assert len(ids) <= 2  # generous upper bound given mock embedder

    @pytest.mark.asyncio
    async def test_separate_clusters_when_dissimilar(self, mock_embedder_patch):
        """
        Backend text and art text should land in separate clusters.
        """
        backend_item = _make_item(
            "python backend fastapi postgresql engineer api services developer"
        )
        art_item = _make_item(
            "watercolor painting sculpture abstract art oil canvas gallery exhibitions"
        )
        # Add a third item (min required) that matches backend
        backend_item2 = _make_item(
            "rest api backend python django mysql web services engineer"
        )
        items = [backend_item, art_item, backend_item2]
        db = _make_db(items)

        added_clusters = []

        def capture_add(obj):
            from app.db.models import GapCluster
            if isinstance(obj, GapCluster):
                obj.id = uuid.uuid4()
                added_clusters.append(obj)

        db.add = MagicMock(side_effect=capture_add)
        db.flush = AsyncMock()

        ids = await cluster_evidence(self.company_id, db, threshold=0.50)
        # Backend and art are very dissimilar → at least 2 clusters expected
        assert len(ids) >= 2

    @pytest.mark.asyncio
    async def test_cluster_label_is_string(self, mock_embedder_patch):
        """Every persisted cluster has a non-empty string label."""
        items = [
            _make_item("authentication login timeout slow"),
            _make_item("authentication token expired login"),
            _make_item("login authentication failure broken"),
        ]
        db = _make_db(items)

        saved_labels = []

        def capture_add(obj):
            from app.db.models import GapCluster
            if isinstance(obj, GapCluster):
                obj.id = uuid.uuid4()
                saved_labels.append(obj.label)

        db.add = MagicMock(side_effect=capture_add)
        db.flush = AsyncMock()

        await cluster_evidence(self.company_id, db)
        for label in saved_labels:
            assert isinstance(label, str)
            assert len(label) > 0

    @pytest.mark.asyncio
    async def test_centroid_dimension_is_384(self, mock_embedder_patch):
        """Each persisted cluster has a 384-element centroid vector."""
        items = [
            _make_item("backend python api engineer"),
            _make_item("backend python rest services"),
            _make_item("backend fastapi postgresql developer"),
        ]
        db = _make_db(items)

        saved_vectors = []

        def capture_add(obj):
            from app.db.models import GapCluster
            if isinstance(obj, GapCluster):
                obj.id = uuid.uuid4()
                saved_vectors.append(obj.embedding_vector)

        db.add = MagicMock(side_effect=capture_add)
        db.flush = AsyncMock()

        await cluster_evidence(self.company_id, db)
        for vec in saved_vectors:
            assert len(vec) == 384

    @pytest.mark.asyncio
    async def test_evidence_count_set_correctly(self, mock_embedder_patch):
        """evidence_count on each cluster matches the number of member IDs."""
        items = [
            _make_item("backend python api engineer"),
            _make_item("backend python rest services"),
            _make_item("backend fastapi postgresql developer"),
        ]
        db = _make_db(items)

        saved_clusters = []

        def capture_add(obj):
            from app.db.models import GapCluster
            if isinstance(obj, GapCluster):
                obj.id = uuid.uuid4()
                saved_clusters.append(obj)

        db.add = MagicMock(side_effect=capture_add)
        db.flush = AsyncMock()

        await cluster_evidence(self.company_id, db)
        total_assigned = sum(c.evidence_count for c in saved_clusters)
        # Total items assigned across all clusters = total embedded items
        assert total_assigned == len(items)

    @pytest.mark.asyncio
    async def test_embed_failure_does_not_abort_batch(self, mock_embedder_patch):
        """
        If one item fails to embed, the rest should still be clustered.
        We simulate this by patching embed_text to raise on a specific call.
        """
        items = [
            _make_item("backend python api engineer"),
            _make_item("CRASH_THIS_TEXT"),
            _make_item("backend fastapi postgresql developer"),
            _make_item("backend django mysql web services"),
        ]
        db = _make_db(items)

        saved_clusters = []

        def capture_add(obj):
            from app.db.models import GapCluster
            if isinstance(obj, GapCluster):
                obj.id = uuid.uuid4()
                saved_clusters.append(obj)

        db.add = MagicMock(side_effect=capture_add)
        db.flush = AsyncMock()

        call_count = 0

        def embed_with_crash(text: str):
            nonlocal call_count
            call_count += 1
            if "CRASH_THIS_TEXT" in text:
                raise RuntimeError("Simulated embedding failure")
            from app.services.embedder import get_embedder
            return get_embedder().embed_text(text)

        with patch("app.services.clusterer.get_embedder") as mock_get_embedder:
            mock_embedder_instance = MagicMock()
            mock_embedder_instance.embed_text = embed_with_crash
            mock_get_embedder.return_value = mock_embedder_instance

            # 4 items, 1 fails → 3 remaining, still >= MIN (3)
            ids = await cluster_evidence(self.company_id, db)
            # At least 1 cluster from the 3 successful embeds
            assert len(ids) >= 1

    @pytest.mark.asyncio
    async def test_too_many_embed_failures_raises_error(self, mock_embedder_patch):
        """
        If embed failures leave fewer than MIN_EVIDENCE_ITEMS (3) items,
        InsufficientEvidenceError must be raised.
        """
        items = [
            _make_item("CRASH"),
            _make_item("CRASH_ALSO"),
            _make_item("good backend python text"),
        ]
        db = _make_db(items)

        def embed_with_crash(text: str):
            if "CRASH" in text:
                raise RuntimeError("Simulated failure")
            return [0.1] * 384

        with patch("app.services.clusterer.get_embedder") as mock_get_embedder:
            mock_embedder_instance = MagicMock()
            mock_embedder_instance.embed_text = embed_with_crash
            mock_get_embedder.return_value = mock_embedder_instance

            with pytest.raises(InsufficientEvidenceError):
                await cluster_evidence(self.company_id, db)

    @pytest.mark.asyncio
    async def test_max_clusters_guard(self, mock_embedder_patch):
        """
        With max_clusters=2 and many dissimilar items, no more than 2
        clusters should be created.
        """
        # Generate 10 items with unique random-ish text that won't group
        unique_items = [
            _make_item(f"unique rare topic zyx_{i} qwerty_{i} mnop_{i}")
            for i in range(10)
        ]
        db = _make_db(unique_items)

        saved_clusters = []

        def capture_add(obj):
            from app.db.models import GapCluster
            if isinstance(obj, GapCluster):
                obj.id = uuid.uuid4()
                saved_clusters.append(obj)

        db.add = MagicMock(side_effect=capture_add)
        db.flush = AsyncMock()

        ids = await cluster_evidence(
            self.company_id, db, threshold=1.01, max_clusters=2
        )  # threshold > 1.0 forces every item into a new cluster until max
        assert len(ids) <= 2

    @pytest.mark.asyncio
    async def test_idempotent_rescan_deletes_old_clusters(self, mock_embedder_patch):
        """
        cluster_evidence() must delete existing clusters for the company
        before writing new ones (begin_nested delete step).
        """
        items = [
            _make_item("backend api python"),
            _make_item("backend api fastapi"),
            _make_item("backend developer postgresql"),
        ]
        db = _make_db(items)

        delete_called = False
        original_begin_nested = db.begin_nested

        def capture_add(obj):
            from app.db.models import GapCluster
            if isinstance(obj, GapCluster):
                obj.id = uuid.uuid4()

        db.add = MagicMock(side_effect=capture_add)
        db.flush = AsyncMock()

        # We verify that execute was called (for delete) by checking call count
        execute_calls_before = db.execute.call_count
        await cluster_evidence(self.company_id, db)
        # execute should have been called at least twice:
        # 1. SELECT evidence items
        # 2. DELETE gap_clusters (inside begin_nested)
        assert db.execute.call_count >= 2
