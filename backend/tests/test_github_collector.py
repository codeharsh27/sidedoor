"""Tests for the GitHub Issues collector."""

from unittest.mock import AsyncMock, MagicMock, patch
import httpx
import pytest

from app.services.collectors.github import GitHubCollector


class TestGitHubCollector:
    """Unit tests for GitHubCollector."""

    def test_source_type(self):
        """Verify source type is github_issue."""
        collector = GitHubCollector()
        assert collector.source_type == "github_issue"

    def test_parse_github_repo(self):
        """Verify parsing owner/repo from different URL formats."""
        collector = GitHubCollector()

        # Standard HTTPS format
        assert collector._parse_github_repo("https://github.com/facebook/react") == ("facebook", "react")
        assert collector._parse_github_repo("https://github.com/facebook/react/") == ("facebook", "react")

        # Subpages/issues URL
        assert collector._parse_github_repo("https://github.com/facebook/react/issues") == ("facebook", "react")

        # SSH format
        assert collector._parse_github_repo("git@github.com:facebook/react.git") == ("facebook", "react")

        # Invalid formats
        assert collector._parse_github_repo("https://google.com") is None
        assert collector._parse_github_repo("") is None

    @pytest.mark.asyncio
    async def test_collect_no_repo_url(self):
        """Should return empty list when no repo URL is provided."""
        collector = GitHubCollector()
        assert await collector.collect("Stripe", "https://stripe.com", github_repo_url=None) == []

    @pytest.mark.asyncio
    async def test_collect_invalid_repo_url(self):
        """Should return empty list when repo URL is invalid/unparseable."""
        collector = GitHubCollector()
        assert await collector.collect("Stripe", "https://stripe.com", github_repo_url="https://invalid-url.com") == []

    @pytest.mark.asyncio
    @patch("httpx.AsyncClient.get")
    async def test_collect_success(self, mock_get):
        """Verify successful collection of GitHub issues, filtering out PRs."""
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = [
            {
                "number": 42,
                "title": "Bug in billing page",
                "body": "The invoice layout is broken on mobile screens.",
                "html_url": "https://github.com/stripe/stripe-core/issues/42",
                "created_at": "2023-10-24T12:34:56Z",
                "user": {"login": "devperson"},
            },
            {
                "number": 43,
                "title": "Update README",
                "html_url": "https://github.com/stripe/stripe-core/pull/43",
                "pull_request": {},  # This flags it as a Pull Request
            }
        ]
        mock_get.return_value = mock_resp

        collector = GitHubCollector()
        results = await collector.collect("Stripe", "https://stripe.com", github_repo_url="https://github.com/stripe/stripe-core")

        # Should only contain the issue, not the PR
        assert len(results) == 1
        assert results[0].source_type == "github_issue"
        assert results[0].source_url == "https://github.com/stripe/stripe-core/issues/42"
        assert "Bug in billing page" in results[0].raw_text
        assert "invoice layout is broken" in results[0].raw_text
        assert results[0].author_handle == "devperson"
        assert results[0].posted_at is not None

    @pytest.mark.asyncio
    @patch("httpx.AsyncClient.get")
    async def test_collect_api_errors(self, mock_get):
        """GitHub API errors should return empty list gracefully."""
        # 404 Not Found
        mock_resp = MagicMock()
        mock_resp.status_code = 404
        mock_get.return_value = mock_resp

        collector = GitHubCollector()
        assert await collector.collect("Stripe", "https://stripe.com", github_repo_url="https://github.com/stripe/stripe-core") == []

        # 403 Rate Limited
        mock_resp.status_code = 403
        assert await collector.collect("Stripe", "https://stripe.com", github_repo_url="https://github.com/stripe/stripe-core") == []
