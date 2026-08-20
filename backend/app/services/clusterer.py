"""
Stage 3 Clusterer — groups evidence items into semantic gap clusters.

Algorithm: single-pass agglomerative threshold clustering.
  - For each evidence item, compute its embedding.
  - Compare to existing cluster centroids via cosine similarity.
  - If max sim >= threshold → assign to that cluster, recompute centroid.
  - Else → open a new cluster.
  - Label each cluster with top-N TF-IDF content words from member texts.

Design choices:
  - Single-pass O(n × k) where k = number of clusters: fast enough for
    the expected evidence volumes (5–200 items per company), no library needed.
  - Threshold is config-driven (CLUSTERING_SIMILARITY_THRESHOLD) so it can
    be tuned without a code deploy.
  - Label extraction is deterministic TF-IDF — no LLM call.
  - Every evidence item embed failure is caught and logged per-item; one
    bad item does not abort the whole cluster run.
  - All DB writes use begin_nested() savepoints so a cluster write failure
    does not poison the surrounding transaction.

No external API calls. No LLM calls.
"""

import logging
import math
import re
import uuid
from collections import Counter
from datetime import datetime, timezone
from typing import NamedTuple

import numpy as np
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db.models import EvidenceItem, GapCluster
from app.services.embedder import get_embedder

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Stopwords — common English words that carry no cluster-label signal.
# This is the minimal NLTK English stopword list hardcoded to avoid a
# runtime NLTK download requirement.
# ---------------------------------------------------------------------------
_STOPWORDS: frozenset[str] = frozenset(
    {
        "a", "an", "the", "and", "or", "but", "if", "in", "on", "at", "to",
        "for", "of", "with", "by", "from", "is", "are", "was", "were", "be",
        "been", "being", "have", "has", "had", "do", "does", "did", "will",
        "would", "could", "should", "may", "might", "shall", "can", "need",
        "it", "its", "this", "that", "these", "those", "i", "we", "you",
        "he", "she", "they", "not", "no", "nor", "so", "yet", "both",
        "either", "neither", "such", "than", "too", "very", "just", "as",
        "also", "any", "all", "each", "more", "most", "other", "some",
        "when", "which", "who", "whom", "how", "what", "there", "their",
        "they", "our", "your", "my", "his", "her", "about", "after",
        "before", "between", "into", "through", "during", "https", "http",
        "www", "com", "org", "net", "com", "get", "use", "used", "using",
        "new", "one", "two", "like", "time", "make", "made",
        "issue", "problem", "slow", "bug", "help",
    }
)

# ---------------------------------------------------------------------------
# Public exception
# ---------------------------------------------------------------------------


class InsufficientEvidenceError(Exception):
    """
    Raised when a company has fewer than MIN_EVIDENCE_ITEMS evidence items,
    making clustering meaningless.
    """


# ---------------------------------------------------------------------------
# Internal data structures
# ---------------------------------------------------------------------------


class _ClusterState(NamedTuple):
    """Mutable cluster state kept in memory during a single cluster run."""

    item_ids: list[uuid.UUID]      # EvidenceItem UUIDs in this cluster
    item_texts: list[str]          # raw_text for each member (for label extraction)
    centroid: np.ndarray           # 384-dim mean of all member embeddings


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    """
    Cosine similarity between two numpy vectors.

    Returns 0.0 for zero-norm vectors instead of raising ZeroDivisionError.
    """
    norm_a = np.linalg.norm(a)
    norm_b = np.linalg.norm(b)
    if norm_a == 0.0 or norm_b == 0.0:
        return 0.0
    return float(np.dot(a, b) / (norm_a * norm_b))


def _extract_label(texts: list[str], top_n: int = 5) -> str:
    """
    Extract a short cluster label using TF-IDF-style term frequency counting.

    Tokenises all member texts, filters stopwords and short tokens,
    and returns the top_n most-frequent content words joined as a phrase.

    This is deterministic and produces the same output for the same input
    every time — no LLM, no randomness.

    Args:
        texts: List of raw_text strings from member evidence items.
        top_n: Number of top terms to include in the label.

    Returns:
        A short label string, e.g. "authentication slow login timeout".
        Falls back to "general feedback" if no content words are found.
    """
    token_counts: Counter = Counter()
    for text in texts:
        # Lowercase, strip URLs and punctuation, split on whitespace
        clean = re.sub(r"https?://\S+", " ", text.lower())
        clean = re.sub(r"[^a-z0-9\s]", " ", clean)
        tokens = clean.split()
        for tok in tokens:
            if len(tok) >= 4 and tok not in _STOPWORDS:
                token_counts[tok] += 1

    if not token_counts:
        return "general feedback"

    top_terms = [term for term, _ in token_counts.most_common(top_n)]
    return " ".join(top_terms)


# ---------------------------------------------------------------------------
# Main clustering function
# ---------------------------------------------------------------------------

# Minimum evidence items required before clustering is attempted.
# PRD §6: "graceful 'not enough signal for this company' state"
_MIN_EVIDENCE_ITEMS = 3


async def cluster_evidence(
    company_id: uuid.UUID,
    db: AsyncSession,
    *,
    threshold: float | None = None,
    max_clusters: int | None = None,
) -> list[uuid.UUID]:
    """
    Cluster all evidence items for a company into gap_cluster rows.

    Steps:
      1. Load all evidence items for the company.
      2. Embed each item's raw_text with the local model (no API cost).
      3. Single-pass agglomerative clustering by cosine similarity.
      4. Extract a label for each cluster using TF-IDF.
      5. Delete any existing gap_clusters for this company (idempotent rescan).
      6. Persist each new cluster, wrapped in a savepoint.

    Args:
        company_id: UUID of the company to cluster.
        db: Active async DB session (must have a transaction open).
        threshold: Override the config clustering_similarity_threshold.
        max_clusters: Override the config clustering_max_clusters.

    Returns:
        List of new GapCluster UUIDs that were persisted.

    Raises:
        InsufficientEvidenceError: If fewer than 3 evidence items exist.
        ValueError: If company_id is not a valid UUID.
    """
    threshold = threshold if threshold is not None else settings.clustering_similarity_threshold
    max_clusters = max_clusters if max_clusters is not None else settings.clustering_max_clusters

    # ------------------------------------------------------------------
    # Step 1: Load evidence items
    # ------------------------------------------------------------------
    stmt = select(EvidenceItem).where(EvidenceItem.company_id == company_id)
    result = await db.execute(stmt)
    items: list[EvidenceItem] = list(result.scalars().all())

    if len(items) < _MIN_EVIDENCE_ITEMS:
        raise InsufficientEvidenceError(
            f"Company {company_id} has only {len(items)} evidence items "
            f"(minimum {_MIN_EVIDENCE_ITEMS} required for clustering)."
        )

    logger.info(
        "Clustering %d evidence items for company %s (threshold=%.2f)",
        len(items),
        company_id,
        threshold,
    )

    # ------------------------------------------------------------------
    # Step 1.5: Fetch company name for embedding prefix
    # ------------------------------------------------------------------
    from app.db.models import Company
    company_res = await db.execute(select(Company).where(Company.id == company_id))
    company = company_res.scalar_one_or_none()
    company_name = company.name if company else "Company"

    # ------------------------------------------------------------------
    # Step 2: Embed each item
    # ------------------------------------------------------------------
    embedder = get_embedder(settings.embedding_model)
    embedded: list[tuple[EvidenceItem, np.ndarray]] = []

    for item in items:
        try:
            text_to_embed = f"{company_name}: {item.raw_text}"
            vec = np.array(await embedder.embed_text(text_to_embed), dtype=np.float64)
            embedded.append((item, vec))
        except Exception as exc:
            # One bad item must never abort the whole run.
            logger.error(
                "Failed to embed evidence item %s (skipped): %s",
                item.id,
                exc,
            )

    if len(embedded) < _MIN_EVIDENCE_ITEMS:
        raise InsufficientEvidenceError(
            f"Company {company_id}: only {len(embedded)} of {len(items)} items "
            f"embedded successfully — not enough to cluster."
        )

    # ------------------------------------------------------------------
    # Step 3: Single-pass agglomerative threshold clustering
    # ------------------------------------------------------------------
    clusters: list[_ClusterState] = []

    for item, vec in embedded:
        best_idx = -1
        best_sim = -1.0

        for idx, cluster in enumerate(clusters):
            sim = _cosine_similarity(vec, cluster.centroid)
            if sim > best_sim:
                best_sim = sim
                best_idx = idx

        if best_sim >= threshold and best_idx >= 0 and len(clusters) < max_clusters:
            # Assign to existing cluster and update centroid (incremental mean)
            existing = clusters[best_idx]
            n = len(existing.item_ids)
            new_centroid = (existing.centroid * n + vec) / (n + 1)
            clusters[best_idx] = _ClusterState(
                item_ids=existing.item_ids + [item.id],
                item_texts=existing.item_texts + [item.raw_text],
                centroid=new_centroid,
            )
        elif len(clusters) < max_clusters:
            # Open a new cluster only if we haven't hit the cap
            clusters.append(
                _ClusterState(
                    item_ids=[item.id],
                    item_texts=[item.raw_text],
                    centroid=vec.copy(),
                )
            )
        else:
            # max_clusters cap reached — assign to the closest existing cluster
            # (guaranteed to exist since len(clusters) >= 1 == max_clusters)
            existing = clusters[best_idx]
            n = len(existing.item_ids)
            new_centroid = (existing.centroid * n + vec) / (n + 1)
            clusters[best_idx] = _ClusterState(
                item_ids=existing.item_ids + [item.id],
                item_texts=existing.item_texts + [item.raw_text],
                centroid=new_centroid,
            )

    logger.info(
        "Formed %d clusters from %d embedded items for company %s",
        len(clusters),
        len(embedded),
        company_id,
    )

    # ------------------------------------------------------------------
    # Step 4: Extract labels
    # ------------------------------------------------------------------
    labels = [_extract_label(c.item_texts) for c in clusters]

    # ------------------------------------------------------------------
    # Step 5: Delete stale clusters for this company (idempotent rescan)
    # ------------------------------------------------------------------
    try:
        async with db.begin_nested():
            await db.execute(
                delete(GapCluster).where(GapCluster.company_id == company_id)
            )
    except Exception as exc:
        logger.error(
            "Failed to delete stale gap_clusters for company %s: %s",
            company_id,
            exc,
        )
        raise

    # ------------------------------------------------------------------
    # Step 6: Persist each cluster with per-cluster savepoints
    # ------------------------------------------------------------------
    persisted_ids: list[uuid.UUID] = []

    for cluster, label in zip(clusters, labels):
        try:
            async with db.begin_nested():
                # Normalise centroid before storage
                norm = np.linalg.norm(cluster.centroid)
                centroid_normalised = (
                    cluster.centroid / norm if norm > 0.0 else cluster.centroid
                )

                gap = GapCluster(
                    company_id=company_id,
                    label=label,
                    embedding_vector=centroid_normalised.tolist(),
                    evidence_item_ids=cluster.item_ids,
                    evidence_count=len(cluster.item_ids),
                    # recency_score and rank_score are computed by the Ranker
                    # and written back in a subsequent step.
                    recency_score=0.0,
                    rank_score=0.0,
                )
                db.add(gap)
                await db.flush()  # Get the generated UUID back
                persisted_ids.append(gap.id)

        except Exception as exc:
            logger.error(
                "Failed to persist cluster '%s' for company %s (skipped): %s",
                label,
                company_id,
                exc,
            )

    logger.info(
        "Persisted %d / %d clusters for company %s",
        len(persisted_ids),
        len(clusters),
        company_id,
    )
    return persisted_ids
