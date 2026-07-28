"""X / Twitter collector using Twitter API v2 recent search."""

import logging
from datetime import datetime, timezone
import httpx

from app.services.collectors.base import EvidenceItemCreate
from app.config import settings

logger = logging.getLogger(__name__)


class XTwitterCollector:
    """Collects tweets mentioning the company from X (formerly Twitter)."""

    @property
    def source_type(self) -> str:
        return "x_post"

    def _parse_iso_date(self, date_str: str | None) -> datetime | None:
        """Parse Twitter's ISO-8601 timestamp."""
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
        """Collect recent tweets mentioning the company."""
        if not settings.twitter_bearer_token:
            logger.info("Twitter bearer token not set. Skipping X collector.")
            return []

        if not company_name or not company_name.strip():
            return []

        # Sanitize query
        query = "".join(c for c in company_name if c.isalnum() or c in " -_").strip()
        if not query:
            return []

        evidence_items: list[EvidenceItemCreate] = []

        headers = {
            "Authorization": f"Bearer {settings.twitter_bearer_token}",
            "User-Agent": "SideDoorBot/1.0",
        }

        # Query recent search API
        # We query for the company name, excluding retweets, in english.
        search_url = "https://api.twitter.com/2/tweets/search/recent"
        params = {
            "query": f'"{query}" -is:retweet lang:en',
            "max_results": 10,
            "tweet.fields": "created_at,author_id",
        }

        try:
            async with httpx.AsyncClient(timeout=10.0, headers=headers) as client:
                response = await client.get(search_url, params=params)

                if response.status_code == 429:
                    logger.warning("X / Twitter API rate limited (429) for query: %s", query)
                    return []
                elif response.status_code != 200:
                    logger.warning("X / Twitter API returned status %d for query %s", response.status_code, query)
                    return []

                data = response.json()
                tweets = data.get("data", [])

                for tweet in tweets:
                    tweet_id = tweet.get("id")
                    text = tweet.get("text")
                    created_at_raw = tweet.get("created_at")
                    author_id = tweet.get("author_id")

                    if not tweet_id or not text:
                        continue

                    # Skip promotional tweets or too short tweets
                    if len(text.strip()) < 30:
                        continue

                    source_url = f"https://x.com/i/web/status/{tweet_id}"
                    posted_at = self._parse_iso_date(created_at_raw)

                    evidence_items.append(
                        EvidenceItemCreate(
                            source_type=self.source_type,
                            source_url=source_url,
                            raw_text=text,
                            author_handle=author_id,  # Twitter v2 author_id is the standard unique handle representation
                            posted_at=posted_at,
                        )
                    )

        except Exception as e:
            logger.error("X / Twitter collection error for %s: %s", company_name, e)

        return evidence_items
