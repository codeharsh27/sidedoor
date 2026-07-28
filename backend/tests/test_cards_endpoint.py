"""
Integration tests for Stage 4 Cards API endpoints.
"""

import uuid
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch
import pytest
from fastapi.testclient import TestClient

from app.db.models import Card, Company, EvidenceItem, FixabilityFlag, GapCluster, RoleMatch, User, UserProfile


@pytest.fixture
def mock_db_session():
    """Mock database session."""
    session = MagicMock()
    session.execute = AsyncMock()
    session.add = MagicMock()
    session.commit = AsyncMock()
    session.refresh = AsyncMock()
    return session


@pytest.fixture
def client(mock_db_session):
    """FastAPI test client with mock db session."""
    from app.db.session import get_db_session

    with patch("app.services.embedder.SentenceTransformer") as mock_transformer_cls:
        # Prevent loading the real model during lifespan startup
        mock_transformer_cls.return_value.get_sentence_embedding_dimension.return_value = 384
        
        from app.main import app

        async def override_db():
            yield mock_db_session

        app.dependency_overrides[get_db_session] = override_db

        with TestClient(app) as c:
            yield c

        app.dependency_overrides.clear()


class TestCardsEndpoints:
    """Tests for GET /company/{id}/cards and PATCH /company/{id}/cards/{card_id}"""

    @pytest.mark.asyncio
    async def test_get_cards_success(self, client, mock_db_session):
        """Should return structured card response details sorted by score."""
        user_id = uuid.uuid4()
        company_id = uuid.uuid4()

        # Mock User exists
        res_user = MagicMock()
        res_user.scalar_one_or_none.return_value = User(id=user_id, email="test@test.com")

        # Mock Company exists
        res_comp = MagicMock()
        res_comp.scalar_one_or_none.return_value = Company(
            id=company_id, name="Test Co", url="https://test.com"
        )

        # Mock Cards query
        card_id = uuid.uuid4()
        cluster_id = uuid.uuid4()
        flag_id = uuid.uuid4()
        role_id = uuid.uuid4()

        card = Card(
            id=card_id,
            user_id=user_id,
            company_id=company_id,
            gap_cluster_id=cluster_id,
            fixability_flag_id=flag_id,
            role_match_id=role_id,
            profile_match_score=0.85,
            status="new",
            shown_at=None,
        )
        res_cards = MagicMock()
        res_cards.scalars.return_value.all.return_value = [card]

        # Mock GapCluster fetch
        cluster = GapCluster(
            id=cluster_id,
            company_id=company_id,
            label="performance slow memory",
            evidence_item_ids=[uuid.uuid4()],
            evidence_count=1,
            rank_score=0.9,
            recency_score=0.8,
        )
        res_cluster = MagicMock()
        res_cluster.scalar_one.return_value = cluster

        # Mock FixabilityFlag fetch
        flag = FixabilityFlag(
            id=flag_id,
            gap_cluster_id=cluster_id,
            company_id=company_id,
            has_public_repo=True,
            has_public_api=False,
            has_ui_surface=True,
            is_buildable=True,
        )
        res_flag = MagicMock()
        res_flag.scalar_one_or_none.return_value = flag

        # Mock RoleMatch fetch
        role = RoleMatch(
            id=role_id,
            gap_cluster_id=cluster_id,
            job_posting_id=uuid.uuid4(),
            match_score=0.6,
            match_reason="overlap: python",
        )
        res_role = MagicMock()
        res_role.scalar_one_or_none.return_value = role

        # Mock JobPosting fetch inside RoleMatch serialization
        job = MagicMock()
        job.title = "Backend Developer"
        res_job = MagicMock()
        res_job.scalar_one_or_none.return_value = job

        # Mock EvidenceItems fetch (limit 3)
        ev_item = EvidenceItem(
            source_type="reddit",
            source_url="https://reddit.com/r/test",
            raw_text="The app has slow performance issues",
            posted_at=datetime.now(timezone.utc),
        )
        res_ev = MagicMock()
        res_ev.scalars.return_value.all.return_value = [ev_item]

        # Mock UserProfile fetch inside loop
        profile = UserProfile(
            user_id=user_id,
            raw_resume_text="...",
            parsed_skills=["Python"],
            parsed_domains=["Backend"],
            parsed_project_summary="...",
            embedding_vector=[0.1] * 384,
        )
        res_profile_loop = MagicMock()
        res_profile_loop.scalar_one_or_none.return_value = profile

        # Order of database execute queries:
        # 1. select User
        # 2. select Company
        # 3. select Cards
        # Inside card loop:
        # 4. select GapCluster
        # 5. select FixabilityFlag
        # 6. select RoleMatch
        # 7. select JobPosting
        # 8. select EvidenceItems (limit 3)
        # 9. select UserProfile (inside loop)
        mock_db_session.execute.side_effect = [
            res_user,
            res_comp,
            res_cards,
            res_cluster,
            res_flag,
            res_role,
            res_job,
            res_ev,
            res_profile_loop,
        ]

        response = client.get(f"/api/v1/company/{company_id}/cards?user_id={user_id}")

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["card_id"] == str(card_id)
        assert data[0]["status"] == "new"
        assert data[0]["profile_match_score"] == 0.85
        assert data[0]["cluster"]["label"] == "performance slow memory"
        assert data[0]["fixability"]["is_buildable"] is True
        assert data[0]["role_match"]["job_title"] == "Backend Developer"
        assert len(data[0]["evidence"]) == 1
        assert data[0]["evidence"][0]["source_type"] == "reddit"
        assert "You listed Python" in data[0]["explanation_string"]
        assert data[0]["top_matching_skill"] == "Python"
        assert data[0]["gap_domain"] == "performance slow"

    def test_get_cards_user_not_found(self, client, mock_db_session):
        """Should raise 404 if user doesn't exist."""
        user_id = uuid.uuid4()
        company_id = uuid.uuid4()

        res_user = MagicMock()
        res_user.scalar_one_or_none.return_value = None
        mock_db_session.execute.return_value = res_user

        response = client.get(f"/api/v1/company/{company_id}/cards?user_id={user_id}")
        assert response.status_code == 404
        assert "not found" in response.json()["detail"]

    def test_get_cards_company_not_found(self, client, mock_db_session):
        """Should raise 404 if company doesn't exist."""
        user_id = uuid.uuid4()
        company_id = uuid.uuid4()

        res_user = MagicMock()
        res_user.scalar_one_or_none.return_value = User(id=user_id, email="test@test.com")
        res_comp = MagicMock()
        res_comp.scalar_one_or_none.return_value = None

        mock_db_session.execute.side_effect = [res_user, res_comp]

        response = client.get(f"/api/v1/company/{company_id}/cards?user_id={user_id}")
        assert response.status_code == 404
        assert "not found" in response.json()["detail"]

    def test_update_card_status_success(self, client, mock_db_session):
        """Should update and return updated status on PATCH."""
        company_id = uuid.uuid4()
        card_id = uuid.uuid4()

        card = Card(
            id=card_id,
            company_id=company_id,
            user_id=uuid.uuid4(),
            status="new",
        )
        res_card = MagicMock()
        res_card.scalar_one_or_none.return_value = card
        mock_db_session.execute.return_value = res_card

        response = client.patch(
            f"/api/v1/company/{company_id}/cards/{card_id}",
            json={"status": "selected"},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "success"
        assert data["new_status"] == "selected"
        assert card.status == "selected"

    def test_update_card_status_invalid_value(self, client, mock_db_session):
        """Should return 422 if updated status value is invalid."""
        company_id = uuid.uuid4()
        card_id = uuid.uuid4()

        response = client.patch(
            f"/api/v1/company/{company_id}/cards/{card_id}",
            json={"status": "invalid_status"},
        )
        assert response.status_code == 422

    def test_get_card_prompt_success(self, client, mock_db_session):
        """Should return formatted prompt text for card."""
        company_id = uuid.uuid4()
        card_id = uuid.uuid4()
        user_id = uuid.uuid4()

        card = Card(
            id=card_id,
            company_id=company_id,
            user_id=user_id,
            status="new",
        )
        res_card = MagicMock()
        res_card.scalar_one_or_none.return_value = card

        res_company = MagicMock()
        res_company.scalar_one_or_none.return_value = "Stripe"

        # Mock generate_handoff_prompt return text
        prompt_text = "Formatted Mentor Prompt Markdown"
        
        with patch("app.services.prompt_generator.generate_handoff_prompt") as mock_gen:
            mock_gen.return_value = prompt_text
            
            mock_db_session.execute.side_effect = [res_card, res_company]
            
            response = client.get(
                f"/api/v1/company/{company_id}/cards/{card_id}/prompt?user_id={user_id}"
            )
            
            assert response.status_code == 200
            data = response.json()
            assert data["card_id"] == str(card_id)
            assert data["company_name"] == "Stripe"
            assert data["prompt_text"] == prompt_text
            mock_gen.assert_called_once_with(company_id, card_id, user_id, mock_db_session)

    def test_get_card_prompt_not_found(self, client, mock_db_session):
        """Should return 404 if card doesn't exist for user + company."""
        company_id = uuid.uuid4()
        card_id = uuid.uuid4()
        user_id = uuid.uuid4()

        res_card = MagicMock()
        res_card.scalar_one_or_none.return_value = None
        mock_db_session.execute.return_value = res_card

        response = client.get(
            f"/api/v1/company/{company_id}/cards/{card_id}/prompt?user_id={user_id}"
        )
        assert response.status_code == 404
        assert "not found" in response.json()["detail"]
