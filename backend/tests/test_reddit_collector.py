"""Tests for the Reddit collector."""

from unittest.mock import AsyncMock, MagicMock, patch
import httpx
import pytest

from app.services.collectors.reddit import RedditCollector


class TestRedditCollector:
    """Unit tests for RedditCollector."""

    def test_source_type(self):
        """Verify source type is reddit."""
        collector = RedditCollector()
        assert collector.source_type == "reddit"

    @pytest.mark.asyncio
    async def test_collect_empty_query(self):
        """Empty query should return empty list."""
        collector = RedditCollector()
        assert await collector.collect("", "https://example.com") == []

    @pytest.mark.asyncio
    @patch("httpx.AsyncClient.get")
    async def test_collect_success(self, mock_get):
        """Verify successful collection of Reddit posts."""
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            "data": {
                "children": [
                    {
                        "data": {
                            "permalink": "/r/saas/comments/123/stripe_issue/",
                            "title": "Stripe issues with invoices",
                            "selftext": "Anyone else experiencing bugs with invoices in Stripe?",
                            "author": "saasfounder",
                            "created_utc": 1698144000.0,
                        }
                    }
                ]
            }
        }
        mock_get.return_value = mock_resp

        collector = RedditCollector()
        results = await collector.collect("Stripe", "https://stripe.com")

        assert len(results) == 1
        assert results[0].source_type == "reddit"
        assert results[0].source_url == "https://www.reddit.com/r/saas/comments/123/stripe_issue/"
        assert "Stripe issues with invoices" in results[0].raw_text
        assert "experiencing bugs" in results[0].raw_text
        assert results[0].author_handle == "saasfounder"
        assert results[0].posted_at is not None

    @pytest.mark.asyncio
    @patch("httpx.AsyncClient.get")
    async def test_collect_rate_limit(self, mock_get):
        """A 429 status code should return an empty list gracefully."""
        mock_resp = MagicMock()
        mock_resp.status_code = 429
        mock_get.return_value = mock_resp

        collector = RedditCollector()
        results = await collector.collect("Stripe", "https://stripe.com")
        assert results == []

    @pytest.mark.asyncio
    @patch("httpx.AsyncClient.get")
    async def test_collect_network_error(self, mock_get):
        """HTTP network exceptions should be caught and return empty list."""
        mock_get.side_effect = httpx.NetworkError("Network issue")

        collector = RedditCollector()
        results = await collector.collect("Stripe", "https://stripe.com")
        assert results == []
