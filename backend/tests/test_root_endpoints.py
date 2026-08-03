"""Integration tests for root endpoint routes (/scan, /cards, /profile/upload)."""

import uuid
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch
import pytest
from fastapi.testclient import TestClient

from app.db.models import Company, Card, GapCluster, FixabilityFlag, User, UserProfile, EvidenceItem


@pytest.fixture
def mock_db_session():
    """Mock database session."""
    session = MagicMock()
    session.execute = AsyncMock()
    session.add = MagicMock()
    session.commit = AsyncMock()
    session.refresh = AsyncMock()
    session.flush = AsyncMock()
    return session


@pytest.fixture
def mock_parser():
    """Mock resume parser fixture returning valid ProfileData."""
    from app.services.resume_parser import ProfileData, NotableProject
    parser = MagicMock()
    mock_parsed = ProfileData(
        skills=["React", "Node.js"],
        domains=["Cloud"],
        project_summary="Project summary text",
        notable_projects=[
            NotableProject(
                title="Project Alpha",
                description="A great web project",
                tech_used=["React", "Node.js"]
            )
        ]
    )
    parser.parse_resume = AsyncMock(return_value=mock_parsed)
    return parser


@pytest.fixture
def client(mock_db_session, mock_parser):
    """FastAPI test client with mock db session and resume parser."""
    from app.db.session import get_db_session
    from app.api.routes.profile import get_resume_parser

    with patch("app.services.embedder.SentenceTransformer") as mock_transformer_cls:
        mock_transformer_cls.return_value.get_sentence_embedding_dimension.return_value = 384
        
        from app.main import app

        async def override_db():
            yield mock_db_session

        app.dependency_overrides[get_db_session] = override_db
        app.dependency_overrides[get_resume_parser] = lambda: mock_parser
        with TestClient(app) as c:
            yield c
        app.dependency_overrides.clear()


class TestRootEndpoints:
    """Tests for scan, card feed, and profile upload endpoints."""

    def test_profile_upload_raw_text_success(self, client, mock_db_session):
        """Should parse raw text and return UserProfile format expected by frontend."""
        user_id = str(uuid.uuid4())
        
        # 1. Mock DB select user
        res_user = MagicMock()
        res_user.scalar_one_or_none.return_value = User(id=uuid.UUID(user_id))
        
        # 2. Mock DB select existing profile (none)
        res_profile = MagicMock()
        res_profile.scalar_one_or_none.return_value = None
        
        mock_db_session.execute.side_effect = [res_user, res_profile]

        from app.services.resume_parser import ProfileData, NotableProject
        mock_parsed = ProfileData(
            skills=["React", "Node.js"],
            domains=["Cloud"],
            project_summary="Project summary text",
            notable_projects=[
                NotableProject(
                    title="Project Alpha",
                    description="A great web project",
                    tech_used=["React", "Node.js"]
                )
            ]
        )

        # 4. Mock embedder
        mock_emb = [0.1] * 384

        with patch("app.api.routes.profile.get_embedder") as mock_embedder_cls:
            mock_embedder_instance = MagicMock()
            mock_embedder_instance.embed_profile.return_value = mock_emb
            mock_embedder_cls.return_value = mock_embedder_instance

            payload = {
                "user_id": user_id,
                "raw_text": "Experienced React developer with Node.js backend experience.",
            }

            response = client.post("/api/v1/profile/upload", data=payload)
            assert response.status_code == 200
            data = response.json()
            assert data["user_id"] == user_id
            assert data["profile"]["parsed_skills"] == ["React", "Node.js"]
            assert data["profile"]["parsed_domains"] == ["Cloud"]
            assert data["profile"]["parsed_project_summary"] == "Project summary text"

    def test_get_cards_root_success(self, client, mock_db_session):
        """Should return user's feed of enriched cards matching OpportunityCardView."""
        user_id = uuid.uuid4()
        company_id = uuid.uuid4()
        cluster_id = uuid.uuid4()
        flag_id = uuid.uuid4()
        ev_id = uuid.uuid4()

        # Seed mock card
        card = Card(
            id=uuid.uuid4(),
            user_id=user_id,
            company_id=company_id,
            gap_cluster_id=cluster_id,
            fixability_flag_id=flag_id,
            profile_match_score=0.9,
            status="new",
            shown_at=None,
        )
        res_cards = MagicMock()
        res_cards.scalars.return_value.all.return_value = [card]

        # Seed cluster
        cluster = GapCluster(
            id=cluster_id,
            company_id=company_id,
            label="performance slow memory",
            evidence_item_ids=[ev_id],
            evidence_count=1,
            recency_score=0.9,
            rank_score=0.85,
        )
        res_cluster = MagicMock()
        res_cluster.scalar_one_or_none.return_value = cluster

        # Seed flag
        flag = FixabilityFlag(
            id=flag_id,
            gap_cluster_id=cluster_id,
            has_public_repo=True,
            has_public_api=True,
            has_ui_surface=True,
            fixability_type="direct_surface",
            fixability_reason="Test reason",
            is_buildable=True,
        )
        res_flag = MagicMock()
        res_flag.scalar_one_or_none.return_value = flag

        # Seed evidence
        evidence = EvidenceItem(
            id=ev_id,
            company_id=company_id,
            source_type="github_issue",
            source_url="https://github.com/testco/issues/1",
            raw_text="The login screen is slow to load."
        )
        res_ev = MagicMock()
        res_ev.scalars.return_value.all.return_value = [evidence]

        # Seed company
        company = Company(
            id=company_id,
            name="TestCo",
            url="https://testco.com"
        )
        res_comp = MagicMock()
        res_comp.scalar_one_or_none.return_value = company

        # Seed user profile
        profile = UserProfile(
            user_id=user_id,
            parsed_skills=["React", "Python"],
            parsed_domains=["Engineering"]
        )
        res_profile = MagicMock()
        res_profile.scalar_one_or_none.return_value = profile

        mock_db_session.execute.side_effect = [
            res_cards, res_cluster, res_flag, res_ev, res_comp, res_profile
        ]

        response = client.get(f"/api/v1/cards?user_id={user_id}")
        assert response.status_code == 200
        data = response.json()
        assert "cards" in data
        assert len(data["cards"]) == 1
        
        card_view = data["cards"][0]
        assert card_view["company"]["name"] == "TestCo"
        assert card_view["why_matches_you"] == "You listed React — this gap involves performance slow."
        assert card_view["card"]["profile_match_score"] == 90.0
        assert card_view["gap_cluster"]["rank_score"] == 85.0
        assert card_view["fixability_flags"]["is_buildable"] is True
        assert len(card_view["evidence_items"]) == 1

    def test_patch_card_status_success(self, client, mock_db_session):
        """Should patch status of a card to selected or dismissed."""
        card_id = uuid.uuid4()
        card = Card(id=card_id, status="new")
        
        res_card = MagicMock()
        res_card.scalar_one_or_none.return_value = card
        mock_db_session.execute.return_value = res_card

        response = client.patch(
            f"/api/v1/cards/{card_id}/status",
            json={"status": "selected"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["card_id"] == str(card_id)
        assert data["status"] == "selected"
        assert card.status == "selected"
