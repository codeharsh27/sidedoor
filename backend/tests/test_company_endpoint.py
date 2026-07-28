"""Integration tests for company endpoints."""

import uuid
from unittest.mock import AsyncMock, MagicMock, patch
import pytest
from fastapi.testclient import TestClient

from app.db.models import Company, EvidenceItem, JobPosting


@pytest.fixture
def mock_db_session():
    """Mock database session."""
    session = MagicMock()
    mock_result = MagicMock()
    session.execute = AsyncMock(return_value=mock_result)
    session.add = MagicMock()
    session.commit = AsyncMock()
    session.refresh = AsyncMock()
    return session


@pytest.fixture
def client(mock_db_session):
    """FastAPI test client with mock db session and mock SentenceTransformer."""
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


class TestCompanyEndpoints:
    """Integration tests for /api/v1/company endpoints."""

    def test_create_company_success(self, client, mock_db_session):
        """Should successfully create a company with valid inputs."""
        # 1. Mock DB: return None for existing check, then company object
        mock_company = Company(
            id=uuid.uuid4(),
            name="Stripe",
            url="https://stripe.com",
            github_repo_url="https://github.com/stripe/stripe-core",
            careers_page_url="https://boards.greenhouse.io/stripe",
            ats_slug="stripe",
            scan_status="pending",
        )
        
        mock_exists_res = MagicMock()
        mock_exists_res.scalar_one_or_none.return_value = None
        mock_db_session.execute.return_value = mock_exists_res

        # Customize refresh to update fields or keep mock object
        async def mock_refresh(obj):
            for k, v in mock_company.__dict__.items():
                if not k.startswith("_"):
                    setattr(obj, k, v)

        mock_db_session.refresh = mock_refresh

        payload = {
            "name": "Stripe",
            "url": "https://stripe.com",
            "github_repo_url": "https://github.com/stripe/stripe-core",
            "careers_page_url": "https://boards.greenhouse.io/stripe",
            "ats_slug": "stripe",
        }

        response = client.post("/api/v1/company/", json=payload)

        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "Stripe"
        assert data["url"] == "https://stripe.com"
        assert data["github_repo_url"] == "https://github.com/stripe/stripe-core"
        assert data["careers_page_url"] == "https://boards.greenhouse.io/stripe"
        assert data["ats_slug"] == "stripe"
        assert data["scan_status"] == "pending"

    def test_create_company_ssrf_validation_failure(self, client):
        """Should return 422 if URLs resolve to private IPs."""
        payload = {
            "name": "Internal Corp",
            "url": "http://127.0.0.1/admin",
        }
        response = client.post("/api/v1/company/", json=payload)
        assert response.status_code == 422
        assert "blocked for security" in response.text

    def test_create_company_invalid_url_failure(self, client):
        """Should return 422 if URLs are malformed."""
        payload = {
            "name": "Acme Corp",
            "url": "ftp://example.com",
        }
        response = client.post("/api/v1/company/", json=payload)
        assert response.status_code == 422
        assert "Invalid URL" in response.text

    @patch("app.api.routes.company.scan_company")
    def test_trigger_scan_success(self, mock_scan, client, mock_db_session):
        """Should successfully scan a company and return stats."""
        company_id = str(uuid.uuid4())
        mock_company = Company(
            id=uuid.UUID(company_id),
            name="Stripe",
            url="https://stripe.com",
            scan_status="pending",
        )
        # Mock lookup
        mock_company_result = MagicMock()
        mock_company_result.scalar_one_or_none.return_value = mock_company
        mock_db_session.execute.return_value = mock_company_result

        # Mock scan orchestrator return
        mock_scan.return_value = {
            "status": "done",
            "evidence_count": 8,
            "newly_saved_count": 5,
            "scan_status": "done",
            "last_scanned_at": "2026-07-28T09:00:00Z",
        }

        response = client.post(f"/api/v1/company/{company_id}/scan")

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "done"
        assert data["evidence_count"] == 8
        assert data["newly_saved_count"] == 5
        assert data["scan_status"] == "done"
        mock_scan.assert_called_once_with(company_id, mock_db_session, user_id=None)

    def test_get_evidence_success(self, client, mock_db_session):
        """Should return list of evidence items for a company."""
        company_id = str(uuid.uuid4())
        mock_company = Company(
            id=uuid.UUID(company_id),
            name="Stripe",
            url="https://stripe.com",
            scan_status="done",
        )

        mock_company_result = MagicMock()
        mock_company_result.scalar_one_or_none.return_value = mock_company

        mock_evidence_result = MagicMock()
        mock_evidence_item = EvidenceItem(
            id=uuid.uuid4(),
            company_id=uuid.UUID(company_id),
            source_type="hacker_news",
            source_url="https://hn/123",
            raw_text="Found a gap in stripe billing.",
        )
        mock_evidence_result.scalars.return_value.all.return_value = [mock_evidence_item]

        mock_db_session.execute.side_effect = [mock_company_result, mock_evidence_result]

        response = client.get(f"/api/v1/company/{company_id}/evidence")

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["source_type"] == "hacker_news"
        assert data[0]["source_url"] == "https://hn/123"
        assert data[0]["raw_text"] == "Found a gap in stripe billing."

    def test_get_jobs_success(self, client, mock_db_session):
        """Should return list of open jobs for a company."""
        company_id = str(uuid.uuid4())
        mock_company = Company(
            id=uuid.UUID(company_id),
            name="Stripe",
            url="https://stripe.com",
            scan_status="done",
        )

        mock_company_result = MagicMock()
        mock_company_result.scalar_one_or_none.return_value = mock_company

        mock_jobs_result = MagicMock()
        mock_job = JobPosting(
            id=uuid.uuid4(),
            company_id=uuid.UUID(company_id),
            title="Senior Backend Engineer",
            raw_text="We are hiring Python/FastAPI developers.",
            is_open=True,
        )
        mock_jobs_result.scalars.return_value.all.return_value = [mock_job]

        mock_db_session.execute.side_effect = [mock_company_result, mock_jobs_result]

        response = client.get(f"/api/v1/company/{company_id}/jobs")

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["title"] == "Senior Backend Engineer"
        assert data[0]["raw_text"] == "We are hiring Python/FastAPI developers."
        assert data[0]["is_open"] is True
