"""Tests for the X (Twitter) collector."""

from unittest.mock import AsyncMock, MagicMock, patch
import httpx
import pytest

from app.services.collectors.x_twitter import XTwitterCollector
from app.config import settings


class TestXTwitterCollector:
    """Unit tests for XTwitterCollector."""

    def test_source_type(self):
        """Verify source type is x_post."""
        collector = XTwitterCollector()
        assert collector.source_type == "x_post"

    @pytest.mark.asyncio
    @patch("app.config.settings.twitter_bearer_token", "")
    async def test_collect_no_token(self):
        """Should skip immediately if bearer token is missing."""
        collector = XTwitterCollector()
        results = await collector.collect("Stripe", "https://stripe.com")
        assert results == []

    @pytest.mark.asyncio
    @patch("app.config.settings.twitter_bearer_token", "fake_bearer_token")
    @patch("httpx.AsyncClient.get")
    async def test_collect_success(self, mock_get):
        """Verify successful search for tweets."""
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            "data": [
                {
                    "id": "987654321",
                    "text": "Stripe invoices API has been throwing 500 errors all morning. Fix this!",
                    "created_at": "2023-10-24T12:34:56.000Z",
                    "author_id": "112233",
                }
            ]
        }
        mock_get.return_value = mock_resp

        collector = XTwitterCollector()
        results = await collector.collect("Stripe", "https://stripe.com")

        assert len(results) == 1
        assert results[0].source_type == "x_post"
        assert results[0].source_url == "https://x.com/i/web/status/987654321"
        assert "Stripe invoices API" in results[0].raw_text
        assert results[0].author_handle == "112233"
        assert results[0].posted_at is not None

    @pytest.mark.asyncio
    @patch("app.config.settings.twitter_bearer_token", "fake_bearer_token")
    @patch("httpx.AsyncClient.get")
    async def test_collect_rate_limit(self, mock_get):
        """Verify rate limits are handled gracefully."""
        mock_resp = MagicMock()
        mock_resp.status_code = 429
        mock_get.return_value = mock_resp

        collector = XTwitterCollector()
        results = await collector.collect("Stripe", "https://stripe.com")
        assert results == []
