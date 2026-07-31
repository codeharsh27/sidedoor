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

    def _is_resume_or_job_ad(self, text: str) -> bool:
        """Check if text is a developer resume or job seeker post."""
        if not text:
            return True
        t_lower = text.lower()
        resume_signals = [
            "seeking work",
            "freelancer?",
            "who is hiring?",
            "willing to relocate:",
            "industries i am not willing to work in:",
            "resume/cv:",
        ]
        if any(sig in t_lower for sig in resume_signals):
            return True
        
        # Check combination signals (e.g., Location: + Remote: + Resume: or Technologies:)
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
            dt = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
            return dt.astimezone(timezone.utc)
        except Exception:
            return None

    async def _fetch_query(
        self,
        client: httpx.AsyncClient,
        query: str,
    ) -> list[EvidenceItemCreate]:
        """Run one HN search (comments + stories) for a single query string."""
        items: list[EvidenceItemCreate] = []

        # 1. Comments
        try:
            response = await client.get(
                "https://hn.algolia.com/api/v1/search",
                params={"query": query, "tags": "comment", "hitsPerPage": 40},
            )
            if response.status_code == 200:
                for hit in response.json().get("hits", []):
                    object_id = hit.get("objectID")
                    comment_text = hit.get("comment_text")
                    author = hit.get("author")
                    created_at_raw = hit.get("created_at")

                    if not object_id or not comment_text:
                        continue
                    clean_text = self._clean_html(comment_text)
                    if len(clean_text) < 30 or self._is_resume_or_job_ad(clean_text):
                        continue

                    items.append(
                        EvidenceItemCreate(
                            source_type=self.source_type,
                            source_url=f"https://news.ycombinator.com/item?id={object_id}",
                            raw_text=clean_text,
                            author_handle=author,
                            posted_at=self._parse_created_at(created_at_raw),
                        )
                    )
        except Exception as e:
            logger.error("HN comment collection error for query '%s': %s", query, e)

        # 2. Stories
        try:
            response = await client.get(
                "https://hn.algolia.com/api/v1/search",
                params={"query": query, "tags": "story", "hitsPerPage": 20},
            )
            if response.status_code == 200:
                for hit in response.json().get("hits", []):
                    object_id = hit.get("objectID")
                    title = hit.get("title")
                    story_text = hit.get("story_text")
                    author = hit.get("author")
                    created_at_raw = hit.get("created_at")
                    points = hit.get("points", 0)

                    if not object_id or not title:
                        continue

                    combined_text = title
                    if story_text:
                        combined_text += f"\n\n{self._clean_html(story_text)}"

                    if (points <= 1 and not story_text) or self._is_resume_or_job_ad(combined_text):
                        continue

                    items.append(
                        EvidenceItemCreate(
                            source_type=self.source_type,
                            source_url=f"https://news.ycombinator.com/item?id={object_id}",
                            raw_text=combined_text,
                            author_handle=author,
                            posted_at=self._parse_created_at(created_at_raw),
                        )
                    )
        except Exception as e:
            logger.error("HN story collection error for query '%s': %s", query, e)

        return items

    async def collect(
        self,
        company_name: str,
        company_url: str,
        github_repo_url: str | None = None,
        careers_page_url: str | None = None,
        search_aliases: list[str] | None = None,
    ) -> list[EvidenceItemCreate]:
        """Query Algolia Search API for comments and stories mentioning the company.

        Runs one search per alias in search_aliases (deduplicated by source_url).
        Falls back to company_name alone if no aliases provided.
        """
        if not company_name or not company_name.strip():
            return []

        # Build alias list — sanitize each entry
        raw_aliases = search_aliases if search_aliases else [company_name]
        queries: list[str] = []
        for alias in raw_aliases:
            sanitized = "".join(c for c in alias if c.isalnum() or c in " -_").strip()
            if sanitized and sanitized not in queries:
                queries.append(sanitized)

        if not queries:
            return []

        seen_urls: set[str] = set()
        all_items: list[EvidenceItemCreate] = []

        async with httpx.AsyncClient(timeout=10.0) as client:
            for query in queries:
                items = await self._fetch_query(client, query)
                for item in items:
                    if item.source_url not in seen_urls:
                        seen_urls.add(item.source_url)
                        all_items.append(item)

        logger.info(
            "HN collected %d unique items for '%s' (aliases: %s)",
            len(all_items),
            company_name,
            queries,
        )
        return all_items
