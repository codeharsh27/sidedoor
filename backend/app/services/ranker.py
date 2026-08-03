"""
Stage 3 Ranker — computes a deterministic rank_score for every gap_cluster.

Formula (ARCHITECTURE.md §3.4):
    rank_score = (evidence_count_norm × w1)
               + (recency_score       × w2)
               + (source_credibility  × w3)

Where:
  w1 = settings.ranker_weight_evidence_count    (default 0.40)
  w2 = settings.ranker_weight_recency           (default 0.35)
  w3 = settings.ranker_weight_source_credibility (default 0.25)

evidence_count_norm:
  Normalised count using log-scaling: log(1 + count) / log(1 + max_count_in_company).
  This prevents a single cluster with 100 items from completely dominating.

recency_score (per cluster):
  For each member evidence item:
    item_score = max(0.0, 1.0 - days_since_posted / DECAY_DAYS)
  Cluster recency_score = mean of member scores.
  Items with no posted_at get a neutral score of 0.5 (not penalised).

source_credibility (static lookup, tunable in code — not stored opinion):
  "github_issue" → 1.00   (direct product feedback with eng visibility)
  "hacker_news"  → 0.85   (technical audience, high quality signal)
  "reddit"       → 0.65   (good signal, noisier)
  "x_post"       → 0.50   (harder to verify context)
  "job_posting"  → 0.40   (weakest signal on its own)
  unknown        → 0.30   (safe fallback — never crashes)

Auditability guarantee: every rank_score component is logged at INFO level.
The answer to "why did this gap rank #1?" is always a one-sentence formula answer.

No external API calls. No LLM calls.
"""

import logging
import math
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db.models import EvidenceItem, GapCluster

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Source credibility weights
# Static lookup — tune weights here, not with an LLM.
# ---------------------------------------------------------------------------
_SOURCE_CREDIBILITY: dict[str, float] = {
    "github_issue": 1.00,
    "hacker_news": 0.85,
    "reddit": 0.65,
    "x_post": 0.50,
    "job_posting": 0.40,
}
_UNKNOWN_SOURCE_CREDIBILITY: float = 0.30


def _source_credibility(source_type: str) -> float:
    """
    Return the static credibility weight for a given source type.

    Unknown types return the fallback weight — this never raises.
    """
    score = _SOURCE_CREDIBILITY.get(source_type, _UNKNOWN_SOURCE_CREDIBILITY)
    if source_type not in _SOURCE_CREDIBILITY:
        logger.warning(
            "Unknown source_type '%s' — using fallback credibility %.2f",
            source_type,
            score,
        )
    return score


def _item_recency_score(posted_at: datetime | None, decay_days: int) -> float:
    """
    Compute a [0.0, 1.0] recency score for a single evidence item.

    Linear decay from 1.0 (posted today) to 0.0 (posted >= decay_days ago).
    Items with no posted_at timestamp receive a neutral 0.5 score.

    Args:
        posted_at: Item posting timestamp (UTC-aware or None).
        decay_days: Days until score reaches 0.0 (from settings).

    Returns:
        Float in [0.0, 1.0].
    """
    if posted_at is None:
        return 0.5  # Neutral — don't penalise missing timestamps

    now = datetime.now(timezone.utc)
    # Make posted_at timezone-aware if it isn't already
    if posted_at.tzinfo is None:
        posted_at = posted_at.replace(tzinfo=timezone.utc)

    age_days = (now - posted_at).total_seconds() / 86400.0
    return min(1.0, max(0.0, 1.0 - age_days / decay_days))


# ---------------------------------------------------------------------------
# Main ranking function
# ---------------------------------------------------------------------------


async def rank_clusters(company_id: object, db: AsyncSession) -> int:
    """
    Compute and persist rank_score for every GapCluster belonging to a company.

    For each cluster:
      1. Load its member EvidenceItems from the DB.
      2. Compute recency_score = mean of per-item recency scores.
      3. Compute source_credibility = mean of per-item credibility weights.
      4. Compute evidence_count_norm = log(1+count) / log(1+max_count).
      5. Compute final rank_score from formula.
      6. Persist recency_score + rank_score back to the GapCluster row.

    All writes use begin_nested() savepoints so one cluster failure does not
    roll back the others.

    Args:
        company_id: UUID of the company whose clusters to rank.
        db: Active async DB session with an open transaction.

    Returns:
        Number of clusters successfully ranked and persisted.

    Raises:
        Nothing — errors are logged per-cluster and the function always
        returns the count of successful updates.
    """
    # ------------------------------------------------------------------
    # Load all clusters for this company
    # ------------------------------------------------------------------
    stmt_clusters = select(GapCluster).where(GapCluster.company_id == company_id)
    result = await db.execute(stmt_clusters)
    clusters: list[GapCluster] = list(result.scalars().all())

    if not clusters:
        logger.info(
            "No gap_clusters found for company %s — skipping ranker.", company_id
        )
        return 0

    # ------------------------------------------------------------------
    # Determine max evidence_count for log-normalisation across this company.
    # ------------------------------------------------------------------
    max_count = max(c.evidence_count for c in clusters)

    decay_days = settings.ranker_recency_decay_days
    w1 = settings.ranker_weight_evidence_count
    w2 = settings.ranker_weight_recency
    w3 = settings.ranker_weight_source_credibility

    logger.info(
        "Ranking %d clusters for company %s "
        "(w1=%.2f w2=%.2f w3=%.2f decay=%dd)",
        len(clusters),
        company_id,
        w1,
        w2,
        w3,
        decay_days,
    )

    # ------------------------------------------------------------------
    # Rank each cluster
    # ------------------------------------------------------------------
    ranked_count = 0

    for cluster in clusters:
        try:
            # Load member evidence items
            if cluster.evidence_item_ids:
                stmt_items = select(EvidenceItem).where(
                    EvidenceItem.id.in_(cluster.evidence_item_ids)
                )
                items_result = await db.execute(stmt_items)
                items: list[EvidenceItem] = list(items_result.scalars().all())
            else:
                items = []

            # ----------------------------------------------------------
            # Component 1: evidence count (log-normalised)
            # ----------------------------------------------------------
            count_norm = (
                math.log1p(cluster.evidence_count) / math.log1p(max_count)
                if max_count > 0
                else 0.0
            )

            # ----------------------------------------------------------
            # Component 2: recency_score (mean across members)
            # ----------------------------------------------------------
            if items:
                recency_scores = [
                    _item_recency_score(item.posted_at, decay_days) for item in items
                ]
                recency = sum(recency_scores) / len(recency_scores)
            else:
                recency = 0.5  # Neutral fallback — should not normally happen

            # ----------------------------------------------------------
            # Component 3: source credibility (mean across members)
            # ----------------------------------------------------------
            if items:
                cred_scores = [_source_credibility(item.source_type) for item in items]
                credibility = sum(cred_scores) / len(cred_scores)
            else:
                credibility = _UNKNOWN_SOURCE_CREDIBILITY

            # ----------------------------------------------------------
            # Final rank_score
            # ----------------------------------------------------------
            rank = (count_norm * w1) + (recency * w2) + (credibility * w3)

            logger.info(
                "Cluster %s | label='%s' | count=%d count_norm=%.3f "
                "recency=%.3f credibility=%.3f → rank=%.4f",
                cluster.id,
                cluster.label,
                cluster.evidence_count,
                count_norm,
                recency,
                credibility,
                rank,
            )

            # ----------------------------------------------------------
            # Persist back to the cluster row (savepoint-guarded)
            # ----------------------------------------------------------
            async with db.begin_nested():
                cluster.recency_score = recency
                cluster.rank_score = rank
                db.add(cluster)

            ranked_count += 1

        except Exception as exc:
            logger.error(
                "Failed to rank cluster %s for company %s (skipped): %s",
                cluster.id,
                company_id,
                exc,
            )

    logger.info(
        "Ranked %d / %d clusters for company %s",
        ranked_count,
        len(clusters),
        company_id,
    )
    return ranked_count
