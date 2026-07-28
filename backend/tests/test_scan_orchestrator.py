"""Tests for the scan orchestrator."""

from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock, patch
import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Company, EvidenceItem
from app.services.scan_orchestrator import scan_company
from app.services.collectors.base import EvidenceItemCreate, JobPostingCreate


@pytest.fixture
def mock_db_session():
    """Mock SQLAlchemy AsyncSession."""
    session = MagicMock(spec=AsyncSession)
    mock_result = MagicMock()
    session.execute = AsyncMock(return_value=mock_result)
    session.commit = AsyncMock()
    session.add = MagicMock()
    return session


class TestScanOrchestrator:
    """Unit and integration tests for the scan orchestrator."""

    @pytest.mark.asyncio
    async def test_scan_company_not_found(self, mock_db_session):
        """Should raise ValueError if company doesn't exist."""
        mock_db_session.execute.return_value.scalar_one_or_none.return_value = None

        with pytest.raises(ValueError, match="Company with ID .* not found"):
            await scan_company("123-abc", mock_db_session)

    @pytest.mark.asyncio
    async def test_scan_company_cached(self, mock_db_session):
        """Should return cached data if last_scanned_at is within 6 hours."""
        recent_scan = datetime.now(timezone.utc) - timedelta(hours=2)
        mock_company = Company(
            id="123-abc",
            name="Stripe",
            url="https://stripe.com",
            last_scanned_at=recent_scan,
            scan_status="done",
        )
        # First execute mock returns the company
        # Second execute mock returns mock evidence items
        mock_execute = AsyncMock()
        mock_db_session.execute = mock_execute

        mock_company_result = MagicMock()
        mock_company_result.scalar_one_or_none.return_value = mock_company

        mock_items_result = MagicMock()
        mock_items_result.scalars.return_value.all.return_value = [MagicMock(spec=EvidenceItem), MagicMock(spec=EvidenceItem)]

        mock_execute.side_effect = [mock_company_result, mock_items_result]

        results = await scan_company("123-abc", mock_db_session)

        assert results["status"] == "cached"
        assert results["evidence_count"] == 2
        assert results["scan_status"] == "done"

    @pytest.mark.asyncio
    @patch("app.services.scan_orchestrator.HackerNewsCollector.collect")
    @patch("app.services.scan_orchestrator.RedditCollector.collect")
    @patch("app.services.scan_orchestrator.GitHubCollector.collect")
    @patch("app.services.scan_orchestrator.XTwitterCollector.collect")
    @patch("app.services.scan_orchestrator.JobPostingsCollector.collect")
    async def test_scan_company_insufficient_signal(
        self, mock_jobs, mock_x, mock_github, mock_reddit, mock_hn, mock_db_session
    ):
        """Should mark status as insufficient_signal if total evidence items < 3."""
        mock_company = Company(
            id="123-abc",
            name="Stripe",
            url="https://stripe.com",
            last_scanned_at=None,
            scan_status="pending",
        )
        mock_company_result = MagicMock()
        mock_company_result.scalar_one_or_none.return_value = mock_company
        mock_db_session.execute.return_value = mock_company_result

        # Mock collectors returning total 1 item (insufficient)
        mock_hn.return_value = [EvidenceItemCreate("hacker_news", "https://hn/1", "HN comment")]
        mock_reddit.return_value = []
        mock_github.return_value = []
        mock_x.return_value = []
        mock_jobs.return_value = []

        results = await scan_company("123-abc", mock_db_session)

        assert results["status"] == "insufficient_signal"
        assert results["evidence_count"] == 1
        assert mock_company.scan_status == "insufficient_signal"
        assert mock_company.last_scanned_at is not None

    @pytest.mark.asyncio
    @patch("app.services.scan_orchestrator.HackerNewsCollector.collect")
    @patch("app.services.scan_orchestrator.RedditCollector.collect")
    @patch("app.services.scan_orchestrator.GitHubCollector.collect")
    @patch("app.services.scan_orchestrator.XTwitterCollector.collect")
    @patch("app.services.scan_orchestrator.JobPostingsCollector.collect")
    @patch("app.config.settings.twitter_bearer_token", "fake_token")
    async def test_scan_company_full_success_calls_twitter(
        self, mock_jobs, mock_x, mock_github, mock_reddit, mock_hn, mock_db_session
    ):
        """Should call Twitter collector if primary sources yield < 5 items, and mark done."""
        mock_company = Company(
            id="123-abc",
            name="Stripe",
            url="https://stripe.com",
            github_repo_url="https://github.com/stripe/stripe-core",
            last_scanned_at=None,
            scan_status="pending",
        )
        mock_execute = AsyncMock()
        mock_db_session.execute = mock_execute

        mock_company_result = MagicMock()
        mock_company_result.scalar_one_or_none.return_value = mock_company

        # Mock database select/insert responses
        mock_db_res = MagicMock()
        mock_db_res.rowcount = 1

        mock_items_result = MagicMock()
        mock_items_result.scalars.return_value.all.return_value = [MagicMock(), MagicMock(), MagicMock(), MagicMock()]

        # Return sequence for db.execute:
        # 1. Company lookup
        # 2. Deleting old job postings
        # 3. Insert evidence 1
        # 4. Insert evidence 2
        # 5. Insert evidence 3
        # 6. Insert evidence 4
        # 7. Final count lookup
        mock_execute.side_effect = [
            mock_company_result,
            MagicMock(),  # Delete jobs
            mock_db_res,  # Insert 1
            mock_db_res,  # Insert 2
            mock_db_res,  # Insert 3
            mock_db_res,  # Insert 4
            mock_items_result,  # Final lookup
        ]

        # Primary sources yield 3 items (under 5)
        mock_hn.return_value = [
            EvidenceItemCreate("hacker_news", "https://hn/1", "HN comment 1"),
            EvidenceItemCreate("hacker_news", "https://hn/2", "HN comment 2"),
        ]
        mock_reddit.return_value = [
            EvidenceItemCreate("reddit", "https://reddit/1", "Reddit post"),
        ]
        mock_github.return_value = []
        
        # Twitter yields 1 item
        mock_x.return_value = [
            EvidenceItemCreate("x_post", "https://x/1", "Tweet text"),
        ]
        mock_jobs.return_value = [
            JobPostingCreate("Backend Engineer", "Job description"),
        ]

        results = await scan_company("123-abc", mock_db_session)

        # Verify Twitter was invoked
        mock_x.assert_called_once()
        assert results["status"] == "done"
        assert results["scan_status"] == "done"
        assert mock_company.scan_status == "done"
        assert mock_company.last_scanned_at is not None
