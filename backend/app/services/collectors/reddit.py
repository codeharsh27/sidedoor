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

    def _parse_created_utc(self, created_utc: float | None) -> datetime | None:
        """Parse epoch timestamp to datetime."""
        if created_utc is None:
            return None
        try:
            return datetime.fromtimestamp(created_utc, tz=timezone.utc)
        except Exception:
            return None

    async def collect(
        self,
        company_name: str,
        company_url: str,
        github_repo_url: str | None = None,
        careers_page_url: str | None = None,
    ) -> list[EvidenceItemCreate]:
        """Fetch posts from Reddit's public search endpoint."""
        if not company_name or not company_name.strip():
            return []

        # Sanitize query
        query = "".join(c for c in company_name if c.isalnum() or c in " -_").strip()
        if not query:
            return []

        evidence_items: list[EvidenceItemCreate] = []

        # Reddit requires a unique User-Agent to avoid aggressive 429 rate limiting
        headers = {
            "User-Agent": "SideDoorBot/1.0 (contact: support@sidedoor.com; target: developer-job-matching)"
        }

        search_url = "https://www.reddit.com/search.json"
        
        # We run a broad search. For better results we query for the company name, or typical issues
        params = {
            "q": f'"{query}"',
            "sort": "new",
            "limit": 50,
        }

        try:
            async with httpx.AsyncClient(timeout=10.0, headers=headers) as client:
                response = await client.get(search_url, params=params)
                
                # Check rate limiting / blocking
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
                    
                    # Skip if missing core attributes
                    permalink = post_data.get("permalink")
                    title = post_data.get("title")
                    selftext = post_data.get("selftext", "")
                    author = post_data.get("author")
                    created_utc = post_data.get("created_utc")
                    is_self = post_data.get("is_self", False)

                    if not permalink or not title:
                        continue

                    # Concatenate title and body
                    combined_text = title
                    if selftext:
                        combined_text += f"\n\n{selftext}"

                    # Skip empty/low content posts
                    if len(combined_text.strip()) < 30:
                        continue

                    source_url = f"https://www.reddit.com{permalink}"
                    posted_at = self._parse_created_utc(created_utc)

                    evidence_items.append(
                        EvidenceItemCreate(
                            source_type=self.source_type,
                            source_url=source_url,
                            raw_text=combined_text,
                            author_handle=author,
                            posted_at=posted_at,
                        )
                    )

        except Exception as e:
            logger.error("Reddit collection error for %s: %s", company_name, e)

        return evidence_items
