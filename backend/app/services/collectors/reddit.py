"""Reddit collector using the public JSON search API."""

import logging
from datetime import datetime, timezone
import httpx

from app.services.collectors.base import EvidenceItemCreate

logger = logging.getLogger(__name__)


class RedditCollector:
    """Collects posts from Reddit mentioning a company or its products."""

    @property
    def source_type(self) -> str:
        return "reddit"

    def _is_resume_or_job_ad(self, text: str) -> bool:
        """Check if text is a developer resume or job seeker post."""
        if not text:
            return True
        t_lower = text.lower()
        resume_signals = [
            "seeking work",
            "freelancer",
            "who is hiring",
            "willing to relocate:",
            "industries i am not willing to work in:",
            "resume/cv:",
        ]
        if any(sig in t_lower for sig in resume_signals):
            return True
        
        combo_count = 0
        if "location:" in t_lower:
            combo_count += 1
        if "remote:" in t_lower or "remote :" in t_lower:
            combo_count += 1
        if "resume:" in t_lower or "cv:" in t_lower:
            combo_count += 1
        if "technologies:" in t_lower:
            combo_count += 1
        
        return combo_count >= 3

    def _parse_created_utc(self, created_utc: float | None) -> datetime | None:
        """Parse epoch timestamp to datetime."""
        if created_utc is None:
            return None
        try:
            return datetime.fromtimestamp(created_utc, tz=timezone.utc)
        except Exception:
            return None

    async def _fetch_query(
        self,
        client: httpx.AsyncClient,
        query: str,
    ) -> list[EvidenceItemCreate]:
        """Run a single Reddit search query and return evidence items."""
        search_url = "https://www.reddit.com/search.json"
        params = {
            "q": f'"{query}"',
            "sort": "new",
            "limit": 50,
        }
        items: list[EvidenceItemCreate] = []
        try:
            response = await client.get(search_url, params=params)

            if response.status_code == 429:
                logger.warning("Reddit API rate limited (429) for query: %s", query)
                return []
            elif response.status_code != 200:
                logger.warning("Reddit API returned status %d for query: %s", response.status_code, query)
                return []

            data = response.json()
            children = data.get("data", {}).get("children", [])

            for child in children:
                post_data = child.get("data", {})
                permalink = post_data.get("permalink")
                title = post_data.get("title")
                selftext = post_data.get("selftext", "")
                author = post_data.get("author")
                created_utc = post_data.get("created_utc")

                if not permalink or not title:
                    continue

                combined_text = title
                if selftext:
                    combined_text += f"\n\n{selftext}"

                if len(combined_text.strip()) < 30 or self._is_resume_or_job_ad(combined_text):
                    continue

                source_url = f"https://www.reddit.com{permalink}"
                posted_at = self._parse_created_utc(created_utc)

                items.append(
                    EvidenceItemCreate(
                        source_type=self.source_type,
                        source_url=source_url,
                        raw_text=combined_text,
                        author_handle=author,
                        posted_at=posted_at,
                    )
                )
        except Exception as e:
            logger.error("Reddit collection error for query '%s': %s", query, e)
        return items

    async def collect(
        self,
        company_name: str,
        company_url: str,
        github_repo_url: str | None = None,
        careers_page_url: str | None = None,
        search_aliases: list[str] | None = None,
    ) -> list[EvidenceItemCreate]:
        """Fetch posts from Reddit's public search endpoint.

        Runs one query per alias in search_aliases (deduplicated by source_url).
        Falls back to company_name alone if no aliases provided.
        """
        if not company_name or not company_name.strip():
            return []

        # Build alias list — sanitize each to alphanumeric + spaces
        raw_aliases = search_aliases if search_aliases else [company_name]
        queries: list[str] = []
        for alias in raw_aliases:
            sanitized = "".join(c for c in alias if c.isalnum() or c in " -_").strip()
            if sanitized and sanitized not in queries:
                queries.append(sanitized)

        if not queries:
            return []

        # Reddit requires a unique User-Agent to avoid aggressive 429 rate limiting
        headers = {
            "User-Agent": "SideDoorBot/1.0 (contact: support@sidedoor.com; target: developer-job-matching)"
        }

        seen_urls: set[str] = set()
        all_items: list[EvidenceItemCreate] = []

        async with httpx.AsyncClient(timeout=10.0, headers=headers) as client:
            for query in queries:
                items = await self._fetch_query(client, query)
                for item in items:
                    if item.source_url not in seen_urls:
                        seen_urls.add(item.source_url)
                        all_items.append(item)

        logger.info(
            "Reddit collected %d unique items for '%s' (aliases: %s)",
            len(all_items),
            company_name,
            queries,
        )
        return all_items
