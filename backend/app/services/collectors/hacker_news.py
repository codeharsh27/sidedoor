"""Hacker News collector using Algolia public search API."""

import logging
from datetime import datetime, timezone
import httpx
from bs4 import BeautifulSoup

from app.services.collectors.base import EvidenceItemCreate
from app.config import settings

logger = logging.getLogger(__name__)


class HackerNewsCollector:
    """Collects comments and posts from Hacker News mentioning a company."""

    @property
    def source_type(self) -> str:
        return "hacker_news"

    def _clean_html(self, html_content: str) -> str:
        """Helper to convert Algolia's HTML comment/post content to clean text."""
        if not html_content:
            return ""
        try:
            soup = BeautifulSoup(html_content, "html.parser")
            return soup.get_text(separator="\n").strip()
        except Exception as e:
            logger.warning("Error cleaning HN comment HTML: %s", e)
            return html_content

    def _parse_created_at(self, date_str: str) -> datetime | None:
        """Parse ISO format created_at date into UTC datetime."""
        if not date_str:
            return None
        try:
            # Algolia date is e.g. "2023-10-24T12:34:56.000Z"
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
        """Query Algolia Search API for comments and stories mentioning the company."""
        if not company_name or not company_name.strip():
            return []

        # Sanitize query: keep alphanumeric and basic punctuation to avoid API break
        query = "".join(c for c in company_name if c.isalnum() or c in " -_").strip()
        if not query:
            return []

        evidence_items: list[EvidenceItemCreate] = []

        async with httpx.AsyncClient(timeout=10.0) as client:
            # 1. Search tags=comment (we want user discussions)
            try:
                comment_url = "https://hn.algolia.com/api/v1/search"
                params = {
                    "query": query,
                    "tags": "comment",
                    "hitsPerPage": 40,
                }
                response = await client.get(comment_url, params=params)
                if response.status_code == 200:
                    data = response.json()
                    hits = data.get("hits", [])
                    for hit in hits:
                        # Extract details
                        object_id = hit.get("objectID")
                        comment_text = hit.get("comment_text")
                        author = hit.get("author")
                        created_at_raw = hit.get("created_at")
                        story_id = hit.get("story_id")

                        if not object_id or not comment_text:
                            continue

                        # Noise filtering: require comment to have parent/story info, or author
                        clean_text = self._clean_html(comment_text)
                        if len(clean_text) < 30:  # Skip too short comments
                            continue

                        # Construct a permanent URL to the comment
                        source_url = f"https://news.ycombinator.com/item?id={object_id}"
                        posted_at = self._parse_created_at(created_at_raw)

                        evidence_items.append(
                            EvidenceItemCreate(
                                source_type=self.source_type,
                                source_url=source_url,
                                raw_text=clean_text,
                                author_handle=author,
                                posted_at=posted_at,
                            )
                        )
            except Exception as e:
                logger.error("HN comment collection error for %s: %s", company_name, e)

            # 2. Search tags=story (e.g. Ask HN / Show HN posts)
            try:
                story_url = "https://hn.algolia.com/api/v1/search"
                params = {
                    "query": query,
                    "tags": "story",
                    "hitsPerPage": 20,
                }
                response = await client.get(story_url, params=params)
                if response.status_code == 200:
                    data = response.json()
                    hits = data.get("hits", [])
                    for hit in hits:
                        object_id = hit.get("objectID")
                        title = hit.get("title")
                        story_text = hit.get("story_text")
                        author = hit.get("author")
                        created_at_raw = hit.get("created_at")
                        points = hit.get("points", 0)

                        if not object_id or not title:
                            continue

                        # We combine title and story text for raw_text
                        combined_text = title
                        if story_text:
                            combined_text += f"\n\n{self._clean_html(story_text)}"

                        # Noise filtering: only keep stories with some traction (e.g., points > 1 or contains text)
                        if points <= 1 and not story_text:
                            continue

                        source_url = f"https://news.ycombinator.com/item?id={object_id}"
                        posted_at = self._parse_created_at(created_at_raw)

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
                logger.error("HN story collection error for %s: %s", company_name, e)

        # De-duplicate entries by source_url just in case
        unique_items = {}
        for item in evidence_items:
            unique_items[item.source_url] = item

        return list(unique_items.values())
