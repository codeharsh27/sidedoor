"""
Tests for Stage 4 Profile Matcher and Card writer.
"""

import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import numpy as np
import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Card, FixabilityFlag, GapCluster, RoleMatch, UserProfile
from app.services.profile_matcher import _cosine_similarity, match_profile_and_write_cards


def _make_profile(vector: list[float]):
    profile = MagicMock(spec=UserProfile)
    profile.id = uuid.uuid4()
    profile.embedding_vector = vector
    return profile


def _make_cluster(company_id: uuid.UUID, vector: list[float]):
    c = MagicMock(spec=GapCluster)
    c.id = uuid.uuid4()
    c.company_id = company_id
    c.embedding_vector = vector
    c.rank_score = 50.0
    c.evidence_count = 2
    return c


def _make_flag(cluster_id: uuid.UUID, is_buildable: bool = True):
    f = MagicMock(spec=FixabilityFlag)
    f.id = uuid.uuid4()
    f.gap_cluster_id = cluster_id
    f.fixability_type = "direct_surface" if is_buildable else "too_vague"
    f.fixability_reason = "Test reason"
    f.is_buildable = is_buildable
    f.has_public_repo = True
    f.has_public_api = False
    f.has_ui_surface = True
    return f


def _make_role_match(cluster_id: uuid.UUID, score: float = 0.5):
    rm = MagicMock(spec=RoleMatch)
    rm.id = uuid.uuid4()
    rm.gap_cluster_id = cluster_id
    rm.match_score = score
    return rm


def _make_db_for_profile(
    profile,
    clusters,
    flags: dict,
    role_matches: dict,
    existing_card=None,
):
    session = MagicMock(spec=AsyncSession)

    # 1. select UserProfile
    res_profile = MagicMock()
    res_profile.scalar_one_or_none.return_value = profile

    # 2. select GapClusters
    res_clusters = MagicMock()
    res_clusters.scalars.return_value.all.return_value = clusters

    # Loop 1: select FixabilityFlag per cluster, then select RoleMatch per cluster
    sub_results = []
    for cluster in clusters:
        res_flag = MagicMock()
        res_flag.scalar_one_or_none.return_value = flags.get(cluster.id)
        sub_results.append(res_flag)

        res_role = MagicMock()
        res_role.scalar_one_or_none.return_value = role_matches.get(cluster.id)
        sub_results.append(res_role)

    # Loop 2: select existing Card per written match
    card_results = []
    for _ in clusters:
        res_card = MagicMock()
        res_card.scalar_one_or_none.return_value = existing_card
        card_results.append(res_card)

    session.execute = AsyncMock(
        side_effect=[res_profile, res_clusters] + sub_results + card_results
    )

    nested_ctx = AsyncMock()
    nested_ctx.__aenter__ = AsyncMock(return_value=nested_ctx)
    nested_ctx.__aexit__ = MagicMock(return_value=False)
    session.begin_nested = MagicMock(return_value=nested_ctx)

    session.add = MagicMock()
    session.flush = AsyncMock()

    return session


def test_cosine_similarity():
    """_cosine_similarity computes standard normalized vector dot product."""
    a = [1.0, 0.0, 0.0]
    b = [1.0, 0.0, 0.0]
    assert abs(_cosine_similarity(a, b) - 1.0) < 1e-9

    a = [1.0, 0.0, 0.0]
    b = [0.0, 1.0, 0.0]
    assert abs(_cosine_similarity(a, b)) < 1e-9

    assert _cosine_similarity([0.0, 0.0], [1.0, 1.0]) == 0.0


@pytest.mark.asyncio
async def test_match_profile_and_write_cards_happy_path():
    """Top_n fixable cards are written, unfixable ones are skipped."""
    comp_id = uuid.uuid4()
    profile = _make_profile([1.0] + [0.0] * 383)

    # 3 clusters:
    # c1 is similar, fixable -> card should be written
    # c2 is dissimilar but fixable -> skipped because top_n=1
    # c3 is similar but unfixable -> skipped
    c1 = _make_cluster(comp_id, [1.0] + [0.0] * 383)
    c2 = _make_cluster(comp_id, [0.0, 1.0] + [0.0] * 382)
    c3 = _make_cluster(comp_id, [1.0] + [0.0] * 383)

    flag1 = _make_flag(c1.id, is_buildable=True)
    flag2 = _make_flag(c2.id, is_buildable=True)
    flag3 = _make_flag(c3.id, is_buildable=False)  # unbuildable

    role_match1 = _make_role_match(c1.id)

    db = _make_db_for_profile(
        profile,
        [c1, c2, c3],
        {c1.id: flag1, c2.id: flag2, c3.id: flag3},
        {c1.id: role_match1, c2.id: None, c3.id: None},
    )

    added_cards = []
    db.add.side_effect = lambda x: added_cards.append(x) if isinstance(x, Card) else None

    # Enable write
    with patch("app.services.profile_matcher.settings") as mock_settings:
        mock_settings.profile_match_min_score = 0.0
        mock_settings.cards_top_n = 1

        ids = await match_profile_and_write_cards(profile.user_id, comp_id, db, top_n=1)
        assert len(ids) == 1
        assert len(added_cards) == 1
        assert added_cards[0].gap_cluster_id == c1.id
        assert added_cards[0].fixability_flag_id == flag1.id
        assert added_cards[0].role_match_id == role_match1.id
        assert added_cards[0].profile_match_score == 1.0


@pytest.mark.asyncio
async def test_match_profile_raises_on_missing_profile():
    """If user profile is missing, raises ValueError."""
    db = _make_db_for_profile(None, [], {}, {})
    with pytest.raises(ValueError):
        await match_profile_and_write_cards(uuid.uuid4(), uuid.UUID("00000000-0000-0000-0000-000000000000"), db)


@pytest.mark.asyncio
async def test_match_profile_and_write_cards_idempotent():
    """If card already exists, it is updated and not duplicated."""
    comp_id = uuid.uuid4()
    profile = _make_profile([1.0] + [0.0] * 383)
    c = _make_cluster(comp_id, [1.0] + [0.0] * 383)
    flag = _make_flag(c.id, is_buildable=True)

    existing_card = MagicMock(spec=Card)
    existing_card.id = uuid.uuid4()
    existing_card.profile_match_score = 0.5

    db = _make_db_for_profile(
        profile,
        [c],
        {c.id: flag},
        {c.id: None},
        existing_card=existing_card,
    )

    with patch("app.services.profile_matcher.settings") as mock_settings:
        mock_settings.profile_match_min_score = 0.0
        mock_settings.cards_top_n = 3

        ids = await match_profile_and_write_cards(profile.user_id, comp_id, db)
        assert len(ids) == 1
        assert ids[0] == existing_card.id
        assert existing_card.profile_match_score == 1.0  # score updated
