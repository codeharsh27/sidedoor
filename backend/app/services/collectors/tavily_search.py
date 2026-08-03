"""Tavily search collector for broad evidence gathering."""

import logging
from datetime import datetime, timezone, timedelta
import httpx
import re

from app.config import settings
from app.services.collectors.base import EvidenceItemCreate
from app.services.query_generator import generate_queries

logger = logging.getLogger(__name__)


class TavilyCollector:
    """Collects evidence across the web using Tavily API, driven by targeted queries."""

    @property
    def source_type(self) -> str:
        return "tavily_search"

    async def collect(
        self,
        company_name: str,
        company_url: str,
        github_repo_url: str | None = None,
        careers_page_url: str | None = None,
        skip_hiring: bool = False,
    ) -> list[EvidenceItemCreate]:
        """Fetch targeted search results via Tavily."""
        
        if not settings.tavily_api_key:
            logger.error("TAVILY_API_KEY is missing. Cannot perform Stage 2 collection.")
            return []
            
        is_b2b_saas = False # Could be heuristically determined, false for now
        has_github = bool(github_repo_url)

        queries = generate_queries(
            company_name=company_name, 
            company_url=company_url, 
            is_b2b_saas=is_b2b_saas, 
            has_github=has_github,
            skip_hiring=skip_hiring
        )
        
        if not queries:
            return []

        evidence_items: list[EvidenceItemCreate] = []
        seen_urls = set()
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            for query, category, days in queries:
                cutoff_date = datetime.now(timezone.utc) - timedelta(days=days)
                try:
                    payload = {
                        "api_key": settings.tavily_api_key,
                        "query": query,
                        "include_raw_content": True,
                        "max_results": 5,
                        "days": days,
                        "search_depth": "advanced"
                    }
                    
                    response = await client.post("https://api.tavily.com/search", json=payload)
                    
                    if response.status_code != 200:
                        logger.warning(
                            "Tavily returned %d for query '%s': %s", 
                            response.status_code, query, response.text
                        )
                        continue
                        
                    data = response.json()
                    results = data.get("results", [])
                    
                    for res in results:
                        url = res.get("url")
                        if not url or url in seen_urls:
                            continue

                        url_lower = url.lower()

                        # Post-filter 0: Blocklist directory profiles, company pages, and employee listings.
                        # These provide generic metadata (employee count, logo, funding) but no buildable pain points.
                        PROFILE_BLOCKLIST_PATTERNS = [
                            "linkedin.com/company/",
                            "linkedin.com/in/",
                            "crunchbase.com/",
                            "pitchbook.com/",
                            "zoominfo.com/",
                            "tracxn.com/",
                            "shyft.ai/tools/",
                            "yctierlist.com/",
                        ]
                        if any(pattern in url_lower for pattern in PROFILE_BLOCKLIST_PATTERNS):
                            logger.debug("Dropped result %s (matches profile/directory blocklist pattern)", url)
                            continue

                        # Post-filter 1: enforce site: constraint.
                        # Tavily treats site:domain as a soft preference, not a hard filter.
                        # If the query includes site:domain, drop any result not from that domain.
                        site_match = re.search(r'site:(\S+)', query)
                        if site_match:
                            required_domain = site_match.group(1).rstrip('/')
                            url_domain = url.split('/')[2] if '//' in url else ''
                            if required_domain not in url_domain:
                                logger.debug(
                                    "Dropped result %s (site: filter violated — expected %s)",
                                    url, required_domain
                                )
                                continue

                        # Post-filter 2: company-name relevance check.
                        # Tavily can return results that match query keywords but aren't about
                        # the company at all. Require the company name to appear in title OR
                        # within first 300 chars OR at least twice in raw content.
                        title = res.get("title", "").lower()
                        raw_content_early = (res.get("raw_content") or res.get("content") or "").lower()
                        c_name_lower = company_name.lower()

                        in_title = c_name_lower in title
                        in_lead = c_name_lower in raw_content_early[:300]
                        count_in_text = raw_content_early.count(c_name_lower)

                        if not (in_title or in_lead or count_in_text >= 2):
                            logger.debug(
                                "Dropped result %s (company name '%s' not sufficiently present in title/lead/content)",
                                url, company_name
                            )
                            continue

                        # Extract and check date.
                        # Tavily does NOT reliably return published_date for LinkedIn, YC, or
                        # company home pages. Treat missing date as date_unknown rather than
                        # stale — these sources are still real signal. The ranker will naturally
                        # give them recency_score=0, reducing but not eliminating their rank.
                        published_date_str = res.get("published_date")
                        pub_date: datetime | None = None

                        if published_date_str:
                            try:
                                pub_date = datetime.fromisoformat(published_date_str.replace("Z", "+00:00"))
                                if pub_date.tzinfo is None:
                                    pub_date = pub_date.replace(tzinfo=timezone.utc)
                            except ValueError:
                                logger.debug("Could not parse date %s for %s — treating as date_unknown", published_date_str, url)
                                pub_date = None

                            # If we have a parseable date, enforce recency cutoff
                            if pub_date and pub_date < cutoff_date:
                                logger.debug("Dropped result %s (Too old: %s)", url, pub_date)
                                continue
                        else:
                            logger.debug("Keeping result %s (no published_date — date_unknown, recency will be 0)", url)

                        raw_content = res.get("raw_content") or res.get("content")
                        if not raw_content or len(raw_content.strip()) < 50:
                            logger.debug("Dropped result %s (Not enough raw content)", url)
                            continue

                        # Content date cross-check ONLY when we have an explicit published_date.
                        # If the header says e.g. 2024, but the text only mentions 2021 and
                        # never mentions 2024, the date is likely an aggregator lie — hard drop.
                        if pub_date:
                            pub_year_str = str(pub_date.year)
                            years_in_text = set(re.findall(r"\b20\d\d\b", raw_content))
                            if years_in_text:
                                latest_year_in_text = max(int(y) for y in years_in_text)
                                if latest_year_in_text < pub_date.year and pub_year_str not in years_in_text:
                                    logger.debug(
                                        "Dropped result %s (Content contradicts date: header says %s but latest year in text is %s)",
                                        url, pub_date.year, latest_year_in_text
                                    )
                                    continue
                            
                        # Build EvidenceItem
                        seen_urls.add(url)
                        
                        # Use host name or a mapping for source_type visualization
                        domain = url.split("/")[2] if "//" in url else url
                        if "reddit.com" in domain:
                            source_label = "reddit"
                        elif "github.com" in domain:
                            source_label = "github_issue"
                        elif "news.ycombinator.com" in domain:
                            source_label = "hacker_news"
                        elif "twitter.com" in domain or "x.com" in domain:
                            source_label = "x_post"
                        else:
                            source_label = "web_article"
                            
                        evidence_items.append(
                            EvidenceItemCreate(
                                source_type=source_label,
                                source_url=url,
                                raw_text=f"Title: {res.get('title', '')}\n\n{raw_content}",
                                author_handle=None, # Tavily rarely gives author specifically in base results
                                posted_at=pub_date
                            )
                        )
                        
                except Exception as e:
                    logger.error("Error running Tavily query '%s': %s", query, e)

        return evidence_items
