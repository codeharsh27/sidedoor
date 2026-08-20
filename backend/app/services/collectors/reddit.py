"""Reddit collector using the public JSON search API."""

import logging
from datetime import datetime, timezone
import httpx

from app.services.collectors.base import EvidenceItemCreate

logger = logging.getLogger(__name__)


import asyncio
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

class RateLimitError(Exception):
    pass

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

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        retry=retry_if_exception_type(RateLimitError),
        reraise=True
    )
    async def _fetch_query(self, query: str, client: httpx.AsyncClient) -> list[dict]:
        search_url = "https://www.reddit.com/search.json"
        params = {
            "q": query,
            "sort": "new",
            "limit": 50,
        }
        response = await client.get(search_url, params=params)
        
        if response.status_code == 429:
            logger.warning("Reddit API rate limited (429) for query: %s", query)
            raise RateLimitError("Rate limited")
        elif response.status_code != 200:
            logger.warning("Reddit API returned status %d for query: %s", response.status_code, query)
            return []

        data = response.json()
        return data.get("data", {}).get("children", [])

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

        query = "".join(c for c in company_name if c.isalnum() or c in " -_").strip()
        if not query:
            return []

        evidence_items: list[EvidenceItemCreate] = []

        headers = {
            "User-Agent": "SideDoorBot/1.0 (contact: support@sidedoor.com; target: developer-job-matching)"
        }
        
        multi_angle_queries = [
            f'"{query}"',
            f'"switched from {query}"',
            f'"alternative to {query}"',
        ]

        seen_urls = set()

        try:
            async with httpx.AsyncClient(timeout=10.0, headers=headers) as client:
                for q in multi_angle_queries:
                    try:
                        children = await self._fetch_query(q, client)
                    except RateLimitError:
                        logger.error("Reddit collection rate limit exhausted for query %s", q)
                        continue

                    for child in children:
                        post_data = child.get("data", {})
                        
                        permalink = post_data.get("permalink")
                        title = post_data.get("title")
                        selftext = post_data.get("selftext", "")
                        author = post_data.get("author")
                        created_utc = post_data.get("created_utc")

                        if not permalink or not title:
                            continue

                        source_url = f"https://www.reddit.com{permalink}"
                        if source_url in seen_urls:
                            continue
                        seen_urls.add(source_url)

                        combined_text = title
                        if selftext:
                            combined_text += f"\n\n{selftext}"

                        if len(combined_text.strip()) < 30:
                            continue

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
                    # small delay between queries
                    await asyncio.sleep(1.0)
        except Exception as e:
            logger.error("Reddit collection error for %s: %s", company_name, e)

        return evidence_items
