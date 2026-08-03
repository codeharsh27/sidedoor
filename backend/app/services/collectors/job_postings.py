"""Job postings collector for Greenhouse, Lever, and generic fallbacks."""

import logging
import re
from datetime import datetime, timezone
import httpx
from bs4 import BeautifulSoup

from app.services.collectors.base import JobPostingCreate

logger = logging.getLogger(__name__)


class JobPostingsCollector:
    """Collects job postings for a company using public Greenhouse or Lever APIs."""

    def _detect_ats_slug_and_type(self, careers_url: str | None, company_name: str) -> tuple[str, str]:
        """Detect ATS type and company slug from careers URL or company name."""
        if not careers_url:
            # Fallback to sanitized company name
            slug = re.sub(r"[^a-zA-Z0-9]", "", company_name.lower())
            return slug, "unknown"

        # Check Lever (e.g. https://jobs.lever.co/facebook)
        lever_match = re.search(r"lever\.co/([a-zA-Z0-9\-_]+)", careers_url)
        if lever_match:
            return lever_match.group(1), "lever"

        # Check Greenhouse (e.g. https://boards.greenhouse.io/facebook)
        gh_match = re.search(r"greenhouse\.io/([a-zA-Z0-9\-_/]+)", careers_url)
        if gh_match:
            from urllib.parse import urlparse, parse_qs
            parsed_url = urlparse(careers_url)
            qs = parse_qs(parsed_url.query)
            if "board_id" in qs:
                return qs["board_id"][0], "greenhouse"

            parts = gh_match.group(1).strip("/").split("/")
            if len(parts) > 1 and parts[0] == "boards":
                return parts[1], "greenhouse"
            return parts[0], "greenhouse"

        # Default fallback
        slug = re.sub(r"[^a-zA-Z0-9]", "", company_name.lower())
        return slug, "unknown"

    def _clean_html(self, html_content: str) -> str:
        """Helper to convert job description HTML to clean plain text."""
        if not html_content:
            return ""
        try:
            soup = BeautifulSoup(html_content, "html.parser")
            return soup.get_text(separator="\n").strip()
        except Exception:
            return html_content

    def _parse_iso_date(self, date_str: str | None) -> datetime | None:
        """Parse Greenhouse date string."""
        if not date_str:
            return None
        try:
            dt = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
            return dt.astimezone(timezone.utc)
        except Exception:
            return None

    def _parse_epoch_ms(self, epoch_ms: int | None) -> datetime | None:
        """Parse Lever epoch timestamp in ms."""
        if epoch_ms is None:
            return None
        try:
            return datetime.fromtimestamp(epoch_ms / 1000.0, tz=timezone.utc)
        except Exception:
            return None

    async def collect(
        self,
        company_name: str,
        careers_page_url: str | None = None,
        ats_slug: str | None = None,
    ) -> list[JobPostingCreate]:
        """Fetch open roles for the company."""
        # 1. Resolve slug and ATS type
        if ats_slug:
            # If slug is explicitly provided, we try Greenhouse first, then Lever
            slug = ats_slug
            ats_type = "detect"
        else:
            slug, ats_type = self._detect_ats_slug_and_type(careers_page_url, company_name)

        logger.info("Collecting jobs for %s: slug=%s, type=%s", company_name, slug, ats_type)
        job_postings: list[JobPostingCreate] = []

        async with httpx.AsyncClient(timeout=15.0) as client:
            # Try Greenhouse if type is greenhouse or we are guessing/detecting
            if ats_type in ("greenhouse", "detect", "unknown"):
                try:
                    gh_url = f"https://boards-api.greenhouse.io/v1/boards/{slug}/jobs"
                    response = await client.get(gh_url, params={"content": "true"})
                    if response.status_code == 200:
                        data = response.json()
                        jobs = data.get("jobs", [])
                        for job in jobs:
                            title = job.get("title")
                            content = job.get("content", "")
                            updated_at_raw = job.get("updated_at")

                            if not title:
                                continue

                            clean_desc = self._clean_html(content)
                            posted_at = self._parse_iso_date(updated_at_raw)

                            job_postings.append(
                                JobPostingCreate(
                                    title=title,
                                    raw_text=clean_desc,
                                    posted_at=posted_at,
                                )
                            )
                        logger.info("Found %d jobs on Greenhouse for %s", len(job_postings), company_name)
                        return job_postings
                except Exception as e:
                    logger.debug("Greenhouse collection skipped or failed for %s: %s", company_name, e)

            # Try Lever if type is lever or we got no results on Greenhouse (under detect/unknown)
            if ats_type in ("lever", "detect", "unknown") and not job_postings:
                try:
                    lever_url = f"https://api.lever.co/v0/postings/{slug}"
                    response = await client.get(lever_url, params={"mode": "json"})
                    if response.status_code == 200:
                        data = response.json()
                        for posting in data:
                            title = posting.get("text")
                            desc_plain = posting.get("descriptionPlain", "")
                            lists = posting.get("lists", [])
                            add_plain = posting.get("additionalPlain", "")
                            created_at_raw = posting.get("createdAt")

                            if not title:
                                continue

                            # Reconstruct full plain text description
                            full_desc_parts = [desc_plain]
                            for list_item in lists:
                                list_title = list_item.get("text", "")
                                list_content = "\n".join([f"- {i}" for i in list_item.get("content", [])])
                                if list_title or list_content:
                                    full_desc_parts.append(f"\n{list_title}\n{list_content}")
                            if add_plain:
                                full_desc_parts.append(f"\n{add_plain}")

                            full_desc = "\n".join(full_desc_parts).strip()
                            posted_at = self._parse_epoch_ms(created_at_raw)

                            job_postings.append(
                                JobPostingCreate(
                                    title=title,
                                    raw_text=full_desc,
                                    posted_at=posted_at,
                                )
                            )
                        logger.info("Found %d jobs on Lever for %s", len(job_postings), company_name)
                        return job_postings
                except Exception as e:
                    logger.debug("Lever collection skipped or failed for %s: %s", company_name, e)

        # Fail gracefully if no job API returned listings
        logger.info("No jobs found via Greenhouse or Lever APIs for company: %s", company_name)
        return []
