"""GitHub Issues collector using GitHub REST API v3."""

import logging
import re
from datetime import datetime, timezone
import httpx

from app.services.collectors.base import EvidenceItemCreate
from app.config import settings

logger = logging.getLogger(__name__)


class GitHubCollector:
    """Collects issues from a company's public GitHub repository."""

    @property
    def source_type(self) -> str:
        return "github_issue"

    def _parse_github_repo(self, url: str) -> tuple[str, str] | None:
        """Parse owner and repo name from GitHub URL.

        Handles HTTPS, SSH, subpages, trailing slashes, and .git endings.
        """
        if not url:
            return None
        # Match pattern: github.com/owner/repo or github.com:owner/repo
        pattern = r"github\.com[:/]([a-zA-Z0-9\-_.]+)/([a-zA-Z0-9\-_.]+)"
        match = re.search(pattern, url)
        if match:
            owner = match.group(1)
            repo = match.group(2)
            if repo.endswith(".git"):
                repo = repo[:-4]
            return owner, repo
        return None

    def _parse_iso_date(self, date_str: str | None) -> datetime | None:
        """Parse GitHub's ISO-8601 timestamp."""
        if not date_str:
            return None
        try:
            dt = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
            return dt.astimezone(timezone.utc)
        except Exception:
            return None

    async def collect(
        self,
        company_name: str,
        company_url: str,
        github_repo_url: str | None = None,
        careers_page_url: str | None = None,
    ) -> list[EvidenceItemCreate]:
        """Collect issues from the specified GitHub repository."""
        if not github_repo_url:
            logger.info("No GitHub repo URL provided for company: %s", company_name)
            return []

        parsed = self._parse_github_repo(github_repo_url)
        if not parsed:
            logger.warning("Could not parse GitHub owner/repo from URL: %s", github_repo_url)
            return []

        owner, repo = parsed
        evidence_items: list[EvidenceItemCreate] = []

        headers = {
            "Accept": "application/vnd.github.v3+json",
            "User-Agent": "SideDoorBot/1.0",
        }
        if settings.github_token:
            headers["Authorization"] = f"token {settings.github_token}"

        # Fetch open issues, sort by comment count to target high-activity issues (gaps)
        issues_url = f"https://api.github.com/repos/{owner}/{repo}/issues"
        params = {
            "state": "open",
            "sort": "comments",
            "per_page": 50,
        }

        try:
            async with httpx.AsyncClient(timeout=10.0, headers=headers) as client:
                response = await client.get(issues_url, params=params)

                if response.status_code == 403:
                    # Likely rate limited
                    logger.warning("GitHub API rate limited (403) or forbidden for repo %s/%s", owner, repo)
                    return []
                elif response.status_code == 404:
                    logger.warning("GitHub repository %s/%s not found (404)", owner, repo)
                    return []
                elif response.status_code != 200:
                    logger.warning("GitHub API returned status %d for %s/%s", response.status_code, owner, repo)
                    return []

                data = response.json()
                for issue in data:
                    # Skip pull requests (GitHub API returns PRs as issues)
                    if "pull_request" in issue:
                        continue

                    issue_id = issue.get("number")
                    title = issue.get("title")
                    body = issue.get("body", "")
                    html_url = issue.get("html_url")
                    created_at_raw = issue.get("created_at")
                    user_info = issue.get("user", {})
                    author = user_info.get("login")

                    if not html_url or not title:
                        continue

                    # Combine title and body
                    combined_text = title
                    if body:
                        combined_text += f"\n\n{body}"

                    # Clean content/ensure sensible length
                    if len(combined_text.strip()) < 30:
                        continue

                    # GitHub markdown body could be extremely long; truncate if over 5000 chars
                    if len(combined_text) > 5000:
                        combined_text = combined_text[:5000] + "... (truncated)"

                    posted_at = self._parse_iso_date(created_at_raw)

                    evidence_items.append(
                        EvidenceItemCreate(
                            source_type=self.source_type,
                            source_url=html_url,
                            raw_text=combined_text,
                            author_handle=author,
                            posted_at=posted_at,
                        )
                    )

        except Exception as e:
            logger.error("GitHub collection error for %s/%s: %s", owner, repo, e)

        return evidence_items
