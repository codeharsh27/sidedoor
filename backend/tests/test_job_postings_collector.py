"""Tests for the job postings collector."""

from unittest.mock import AsyncMock, MagicMock, patch
import httpx
import pytest

from app.services.collectors.job_postings import JobPostingsCollector


class TestJobPostingsCollector:
    """Unit tests for JobPostingsCollector."""

    def test_detect_ats_slug_and_type(self):
        """Verify ATS type detection and slug extraction."""
        collector = JobPostingsCollector()

        # Greenhouse URL
        slug, ats_type = collector._detect_ats_slug_and_type("https://boards.greenhouse.io/stripe", "Stripe")
        assert slug == "stripe"
        assert ats_type == "greenhouse"

        slug, ats_type = collector._detect_ats_slug_and_type("https://boards.greenhouse.io/embed/job_board?board_id=stripe", "Stripe")
        assert slug == "stripe"
        assert ats_type == "greenhouse"

        # Lever URL
        slug, ats_type = collector._detect_ats_slug_and_type("https://jobs.lever.co/stripe", "Stripe")
        assert slug == "stripe"
        assert ats_type == "lever"

        # No URL
        slug, ats_type = collector._detect_ats_slug_and_type(None, "Stripe Inc")
        assert slug == "stripeinc"
        assert ats_type == "unknown"

    @pytest.mark.asyncio
    @patch("httpx.AsyncClient.get")
    async def test_collect_greenhouse(self, mock_get):
        """Verify successful jobs collection from Greenhouse API."""
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            "jobs": [
                {
                    "title": "Backend Engineer",
                    "content": "<h1>Requirements</h1><p>Python experience required.</p>",
                    "updated_at": "2023-10-24T12:00:00Z",
                }
            ]
        }
        mock_get.return_value = mock_resp

        collector = JobPostingsCollector()
        results = await collector.collect("Stripe", careers_page_url="https://boards.greenhouse.io/stripe")

        assert len(results) == 1
        assert results[0].title == "Backend Engineer"
        assert "Requirements" in results[0].raw_text
        assert "Python experience" in results[0].raw_text
        assert results[0].posted_at is not None

    @pytest.mark.asyncio
    @patch("httpx.AsyncClient.get")
    async def test_collect_lever(self, mock_get):
        """Verify successful jobs collection from Lever API."""
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = [
            {
                "text": "Frontend Developer",
                "descriptionPlain": "Build gorgeous UI surfaces.",
                "lists": [
                    {
                        "text": "Qualifications",
                        "content": ["React expert", "3+ years experience"]
                    }
                ],
                "additionalPlain": "This is a full-time role.",
                "createdAt": 1698144000000,
            }
        ]
        mock_get.return_value = mock_resp

        collector = JobPostingsCollector()
        results = await collector.collect("Stripe", careers_page_url="https://jobs.lever.co/stripe")

        assert len(results) == 1
        assert results[0].title == "Frontend Developer"
        assert "Build gorgeous UI surfaces" in results[0].raw_text
        assert "React expert" in results[0].raw_text
        assert "This is a full-time role" in results[0].raw_text
        assert results[0].posted_at is not None
