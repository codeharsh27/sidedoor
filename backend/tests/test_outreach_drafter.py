"""Tests for Stage 6 Outreach Drafter Service."""

import uuid
from unittest.mock import AsyncMock, MagicMock, patch
import pytest

from app.db.models import Card, Company, EvidenceItem, GapCluster, JobPosting, OutreachDraft, RoleMatch, UserProfile
from app.services.outreach_drafter import generate_outreach_draft


class TestOutreachDrafter:
    """Tests for Outreach Drafter Service."""

    @pytest.mark.asyncio
    @patch("app.services.outreach_drafter.get_matching_skill_and_domain")
    async def test_generate_outreach_draft_variant_a(self, mock_matching_skill):
        """Selected cards should use Template A (I built something)."""
        card_id = uuid.uuid4()
        user_id = uuid.uuid4()
        comp_id = uuid.uuid4()
        cluster_id = uuid.uuid4()
        db = MagicMock()

        card = Card(
            id=card_id,
            user_id=user_id,
            company_id=comp_id,
            gap_cluster_id=cluster_id,
            status="selected"
        )
        profile = UserProfile(
            user_id=user_id,
            parsed_skills=["Python", "FastAPI"],
            parsed_domains=["Backend"],
            parsed_project_summary="Built multiple scalable backends"
        )
        cluster = GapCluster(
            id=cluster_id,
            company_id=comp_id,
            label="auth speed",
            evidence_item_ids=[uuid.uuid4()]
        )
        evidence = EvidenceItem(
            id=cluster.evidence_item_ids[0],
            company_id=comp_id,
            source_type="reddit",
            source_url="https://reddit.com/r/auth",
            raw_text="The login takes 10 seconds to respond."
        )

        mock_matching_skill.return_value = ("Python", "Auth")

        # Mock database selects
        res_card = MagicMock()
        res_card.scalar_one_or_none.return_value = card
        res_profile = MagicMock()
        res_profile.scalar_one_or_none.return_value = profile
        res_cluster = MagicMock()
        res_cluster.scalar_one_or_none.return_value = cluster
        res_company = MagicMock()
        res_company.scalar_one_or_none.return_value = "AuthCo"
        res_ev = MagicMock()
        res_ev.scalars.return_value.all.return_value = [evidence]
        res_role = MagicMock()
        res_role.scalar_one_or_none.return_value = None  # No role match
        res_draft = MagicMock()
        res_draft.scalar_one_or_none.return_value = None  # No existing draft

        db.execute = AsyncMock(side_effect=[
            res_card, res_profile, res_cluster, res_company, res_ev, res_role, res_draft
        ])

        db.add = MagicMock()
        db.flush = AsyncMock()

        draft = await generate_outreach_draft(card_id, user_id, db)
        
        # Verify result is a draft and Template A has been chosen
        assert isinstance(draft, OutreachDraft)
        assert "I built a small proof-of-concept" in draft.draft_text
        assert "Loom URL" in draft.draft_text
        assert "AuthCo" in draft.draft_text
        assert "auth speed" in draft.draft_text
        assert "login takes 10 seconds" in draft.draft_text
        assert "https://reddit.com/r/auth" in draft.draft_text
        assert "[TODO:" in draft.draft_text  # Todos remain untouched

    @pytest.mark.asyncio
    @patch("app.services.outreach_drafter.get_matching_skill_and_domain")
    async def test_generate_outreach_draft_variant_b(self, mock_matching_skill):
        """Cards that are not 'selected' should use Template B (I spotted something)."""
        card_id = uuid.uuid4()
        user_id = uuid.uuid4()
        comp_id = uuid.uuid4()
        cluster_id = uuid.uuid4()
        db = MagicMock()

        card = Card(
            id=card_id,
            user_id=user_id,
            company_id=comp_id,
            gap_cluster_id=cluster_id,
            status="new"
        )
        profile = UserProfile(
            user_id=user_id,
            parsed_skills=["Python", "FastAPI"],
            parsed_domains=["Backend"],
            parsed_project_summary="Built multiple scalable backends"
        )
        cluster = GapCluster(
            id=cluster_id,
            company_id=comp_id,
            label="auth speed",
            evidence_item_ids=[]
        )

        mock_matching_skill.return_value = ("Python", "Auth")

        # Mock database selects
        res_card = MagicMock()
        res_card.scalar_one_or_none.return_value = card
        res_profile = MagicMock()
        res_profile.scalar_one_or_none.return_value = profile
        res_cluster = MagicMock()
        res_cluster.scalar_one_or_none.return_value = cluster
        res_company = MagicMock()
        res_company.scalar_one_or_none.return_value = "AuthCo"
        res_ev = MagicMock()
        res_ev.scalars.return_value.all.return_value = []
        res_role = MagicMock()
        res_role.scalar_one_or_none.return_value = None
        res_draft = MagicMock()
        res_draft.scalar_one_or_none.return_value = None

        db.execute = AsyncMock(side_effect=[
            res_card, res_profile, res_cluster, res_company, res_ev, res_role, res_draft
        ])

        db.add = MagicMock()
        db.flush = AsyncMock()

        draft = await generate_outreach_draft(card_id, user_id, db)
        
        # Verify result is a draft and Template B has been chosen
        assert isinstance(draft, OutreachDraft)
        assert "planning to build a small proof-of-concept this week" in draft.draft_text
        assert "Loom URL" not in draft.draft_text
        assert "AuthCo" in draft.draft_text
        assert "auth speed" in draft.draft_text
        assert "Python" in draft.draft_text
        assert "[TODO:" in draft.draft_text

    @pytest.mark.asyncio
    async def test_generate_outreach_draft_wrong_user(self):
        """Should raise ValueError if card belongs to a different user."""
        card_id = uuid.uuid4()
        user_id = uuid.uuid4()
        other_user_id = uuid.uuid4()
        db = MagicMock()

        card = Card(
            id=card_id,
            user_id=other_user_id,
            company_id=uuid.uuid4(),
            gap_cluster_id=uuid.uuid4(),
            status="new"
        )
        res_card = MagicMock()
        res_card.scalar_one_or_none.return_value = card
        db.execute = AsyncMock(return_value=res_card)

        with pytest.raises(ValueError) as exc:
            await generate_outreach_draft(card_id, user_id, db)
        assert "does not belong to user" in str(exc.value)

    @pytest.mark.asyncio
    async def test_generate_outreach_draft_missing_profile(self):
        """Should raise ValueError if user profile is missing."""
        card_id = uuid.uuid4()
        user_id = uuid.uuid4()
        db = MagicMock()

        card = Card(
            id=card_id,
            user_id=user_id,
            company_id=uuid.uuid4(),
            gap_cluster_id=uuid.uuid4(),
            status="new"
        )
        res_card = MagicMock()
        res_card.scalar_one_or_none.return_value = card
        res_profile = MagicMock()
        res_profile.scalar_one_or_none.return_value = None

        db.execute = AsyncMock(side_effect=[res_card, res_profile])

        with pytest.raises(ValueError) as exc:
            await generate_outreach_draft(card_id, user_id, db)
        assert "User profile for user" in str(exc.value)

    @pytest.mark.asyncio
    @patch("app.services.outreach_drafter.get_matching_skill_and_domain")
    async def test_generate_outreach_draft_idempotent(self, mock_matching_skill):
        """Should return existing draft ID and update text on repeat calls."""
        card_id = uuid.uuid4()
        user_id = uuid.uuid4()
        comp_id = uuid.uuid4()
        cluster_id = uuid.uuid4()
        db = MagicMock()

        card = Card(
            id=card_id,
            user_id=user_id,
            company_id=comp_id,
            gap_cluster_id=cluster_id,
            status="new"
        )
        profile = UserProfile(
            user_id=user_id,
            parsed_skills=["Python"],
            parsed_domains=["Backend"],
            parsed_project_summary="Summary"
        )
        cluster = MagicMock(spec=GapCluster)
        cluster.id = cluster_id
        cluster.evidence_item_ids = []
        cluster.label = "auth"

        existing_draft = OutreachDraft(
            id=uuid.uuid4(),
            card_id=card_id,
            user_id=user_id,
            draft_text="Old Text"
        )

        mock_matching_skill.return_value = ("Python", "Auth")

        res_card = MagicMock()
        res_card.scalar_one_or_none.return_value = card
        res_profile = MagicMock()
        res_profile.scalar_one_or_none.return_value = profile
        res_cluster = MagicMock()
        res_cluster.scalar_one_or_none.return_value = cluster
        res_company = MagicMock()
        res_company.scalar_one_or_none.return_value = "AuthCo"
        res_ev = MagicMock()
        res_ev.scalars.return_value.all.return_value = []
        res_role = MagicMock()
        res_role.scalar_one_or_none.return_value = None
        res_draft = MagicMock()
        res_draft.scalar_one_or_none.return_value = existing_draft

        db.execute = AsyncMock(side_effect=[
            res_card, res_profile, res_cluster, res_company, res_ev, res_role, res_draft
        ])

        db.add = MagicMock()
        db.flush = AsyncMock()

        draft = await generate_outreach_draft(card_id, user_id, db)
        
        # Verify same ID was returned
        assert draft.id == existing_draft.id
        # Verify draft text was updated
        assert "planning to build" in draft.draft_text
