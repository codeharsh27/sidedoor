"""Tests for the Hacker News collector."""

from unittest.mock import AsyncMock, MagicMock, patch
import httpx
import pytest

from app.services.collectors.hacker_news import HackerNewsCollector
from app.services.collectors.base import EvidenceItemCreate


class TestHackerNewsCollector:
    """Unit tests for HackerNewsCollector."""

    def test_source_type(self):
        """Verify source type is hacker_news."""
        collector = HackerNewsCollector()
        assert collector.source_type == "hacker_news"

    def test_clean_html(self):
        """Verify HTML stripping from Algolia comment text."""
        collector = HackerNewsCollector()
        raw_html = "<p>This is a <b>HN</b> comment.<br/>New line.</p>"
        clean = collector._clean_html(raw_html)
        assert clean == "This is a \nHN\n comment.\nNew line."

    @pytest.mark.asyncio
    async def test_collect_empty_query(self):
        """Empty query should return empty list."""
        collector = HackerNewsCollector()
        assert await collector.collect("", "https://example.com") == []
        assert await collector.collect("   ", "https://example.com") == []

    @pytest.mark.asyncio
    @patch("httpx.AsyncClient.get")
    async def test_collect_success(self, mock_get):
        """Verify successful collection of comments and stories."""
        # Mock responses for comments (first call) and stories (second call)
        mock_comments_resp = MagicMock()
        mock_comments_resp.status_code = 200
        mock_comments_resp.json.return_value = {
            "hits": [
                {
                    "objectID": "12345",
                    "comment_text": "<p>Using Stripe is awesome, but it had a billing gap for our SaaS.</p>",
                    "author": "devguy",
                    "created_at": "2023-10-24T12:34:56.000Z",
                    "story_id": 9999,
                }
            ]
        }

        mock_stories_resp = MagicMock()
        mock_stories_resp.status_code = 200
        mock_stories_resp.json.return_value = {
            "hits": [
                {
                    "objectID": "67890",
                    "title": "Show HN: Stripe Billing Tool",
                    "story_text": "I built this tool to fix Stripe's invoicing issue.",
                    "author": "founder",
                    "created_at": "2023-10-25T08:00:00.000Z",
                    "points": 10,
                }
            ]
        }

        mock_get.side_effect = [mock_comments_resp, mock_stories_resp]

        collector = HackerNewsCollector()
        results = await collector.collect("Stripe", "https://stripe.com")

        assert len(results) == 2
        # Check comment hit
        assert results[0].source_type == "hacker_news"
        assert results[0].source_url == "https://news.ycombinator.com/item?id=12345"
        assert "billing gap" in results[0].raw_text
        assert results[0].author_handle == "devguy"
        assert results[0].posted_at is not None

        # Check story hit
        assert results[1].source_url == "https://news.ycombinator.com/item?id=67890"
        assert "Show HN: Stripe Billing Tool" in results[1].raw_text
        assert "invoicing issue" in results[1].raw_text

    @pytest.mark.asyncio
    @patch("httpx.AsyncClient.get")
    async def test_collect_failure_continues(self, mock_get):
        """API errors or timeouts should be handled gracefully without crashing."""
        mock_get.side_effect = httpx.ConnectTimeout("Timeout connecting to HN API")

        collector = HackerNewsCollector()
        results = await collector.collect("Stripe", "https://stripe.com")
        assert results == []
