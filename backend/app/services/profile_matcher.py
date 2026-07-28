"""
Stage 4 Profile Matcher & Card Writer — ranks fixable gaps against the user's profile.

Computes cosine similarity between user_profiles.embedding_vector and the gap_cluster's
embedding_vector. Persists the top_n results as cards in the cards table.
"""

import logging
import uuid
from datetime import datetime, timezone

import numpy as np
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db.models import Card, FixabilityFlag, GapCluster, RoleMatch, UserProfile

logger = logging.getLogger(__name__)


def _cosine_similarity(a: list[float] | np.ndarray, b: list[float] | np.ndarray) -> float:
    """Compute cosine similarity between two vectors."""
    arr_a = np.array(a, dtype=np.float64)
    arr_b = np.array(b, dtype=np.float64)
    norm_a = np.linalg.norm(arr_a)
    norm_b = np.linalg.norm(arr_b)
    if norm_a == 0.0 or norm_b == 0.0:
        return 0.0
    return float(np.dot(arr_a, arr_b) / (norm_a * norm_b))


async def match_profile_and_write_cards(
    user_id: uuid.UUID,
    company_id: uuid.UUID,
    db: AsyncSession,
    *,
    top_n: int | None = None,
) -> list[uuid.UUID]:
    """
    Ranks fixable clusters for a company by similarity to the user's profile.
    Upserts cards for the top_n matches.

    Args:
        user_id: UUID of the user.
        company_id: UUID of the company.
        db: Active async DB session.
        top_n: Number of top matches to write cards for (default settings.cards_top_n).

    Returns:
        List of UUIDs of upserted/updated Card rows.
    """
    top_n = top_n if top_n is not None else settings.cards_top_n

    # 1. Fetch User Profile
    stmt_profile = select(UserProfile).where(UserProfile.user_id == user_id)
    res_profile = await db.execute(stmt_profile)
    profile = res_profile.scalar_one_or_none()

    if not profile:
        raise ValueError(f"User profile not found for user_id {user_id}")

    user_vector = profile.embedding_vector
    if not user_vector or len(user_vector) != 384:
        raise ValueError(
            f"User profile {user_id} has invalid or missing embedding vector (expected 384 dimensions)."
        )

    # 2. Fetch all gap clusters for this company
    stmt_clusters = select(GapCluster).where(GapCluster.company_id == company_id)
    res_clusters = await db.execute(stmt_clusters)
    clusters = res_clusters.scalars().all()

    if not clusters:
        logger.info("No gap clusters found for company %s to match against user %s", company_id, user_id)
        return []

    # 3. Match each cluster and filter by fixability
    scored_clusters = []

    for cluster in clusters:
        # Check fixability flag
        stmt_flag = select(FixabilityFlag).where(FixabilityFlag.gap_cluster_id == cluster.id)
        res_flag = await db.execute(stmt_flag)
        flag = res_flag.scalar_one_or_none()

        if not flag:
            logger.warning(
                "Cluster %s has no fixability flag computed — skipping profile match.",
                cluster.id,
            )
            continue

        if not flag.is_buildable:
            logger.info("Cluster %s is not buildable — skipped from profile matching.", cluster.id)
            continue

        # Compute cosine similarity
        sim = _cosine_similarity(user_vector, cluster.embedding_vector)

        if sim < settings.profile_match_min_score:
            logger.info(
                "Cluster %s profile match score %.4f below threshold %.2f — skipped.",
                cluster.id,
                sim,
                settings.profile_match_min_score,
            )
            continue

        # Get best role match (highest match_score) for this cluster
        stmt_role_match = (
            select(RoleMatch)
            .where(RoleMatch.gap_cluster_id == cluster.id)
            .order_by(RoleMatch.match_score.desc())
            .limit(1)
        )
        res_role_match = await db.execute(stmt_role_match)
        best_role_match = res_role_match.scalar_one_or_none()

        scored_clusters.append((cluster, sim, flag, best_role_match))

    # Sort by profile match score descending
    scored_clusters.sort(key=lambda x: x[1], reverse=True)

    # Limit to top_n
    top_matches = scored_clusters[:top_n]

    logger.info(
        "Found %d fixable clusters, writing cards for top %d matches for user %s",
        len(scored_clusters),
        len(top_matches),
        user_id,
    )

    persisted_ids: list[uuid.UUID] = []

    for cluster, sim, flag, best_role_match in top_matches:
        try:
            async with db.begin_nested():
                # Check if Card already exists for this user and cluster
                stmt_existing = select(Card).where(
                    Card.user_id == user_id, Card.gap_cluster_id == cluster.id
                )
                res_existing = await db.execute(stmt_existing)
                card = res_existing.scalar_one_or_none()

                role_match_id = best_role_match.id if best_role_match else None

                if card:
                    # Update fields, preserving status and shown_at
                    card.profile_match_score = sim
                    card.fixability_flag_id = flag.id
                    card.role_match_id = role_match_id
                    card.updated_at = datetime.now(timezone.utc)
                else:
                    card = Card(
                        user_id=user_id,
                        gap_cluster_id=cluster.id,
                        company_id=company_id,
                        profile_match_score=sim,
                        fixability_flag_id=flag.id,
                        role_match_id=role_match_id,
                        status="new",
                        created_at=datetime.now(timezone.utc),
                        updated_at=datetime.now(timezone.utc),
                    )
                    db.add(card)

                await db.flush()
                persisted_ids.append(card.id)

                logger.info(
                    "Persisted Card: user %s, cluster %s, score=%.4f, role_match=%s",
                    user_id,
                    cluster.id,
                    sim,
                    role_match_id,
                )
        except Exception as e:
            logger.error(
                "Failed to write card for user %s, cluster %s: %s",
                user_id,
                cluster.id,
                e,
            )

    return persisted_ids
