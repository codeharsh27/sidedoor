"""
Stage 6 Contact Finder Service — rule-based contact discovery, zero LLM.

Discovers contacts for a target company via three paths (in priority order):

  1. GitHub contributor scan (if github_repo_url is set)
     - Hits the public GitHub API; respects rate limits gracefully.
     - Optional GITHUB_TOKEN from config for higher rate limits.

  2. LinkedIn search URL generation (always runs, zero external calls)
     - Generates clickable search URLs; NEVER fetches LinkedIn programmatically.

  3. Public team/about page scrape
     - Fetches {company.url}/team and {company.url}/about using the existing
       SSRF-hardened url_fetcher.
     - Parses name+title patterns from plain text.

All discovery paths are non-blocking: errors are logged and skipped,
never re-raised. The scan continues even if all three paths fail.

Cache: contacts are returned from DB if they were scraped within 7 days.
Idempotency: upsert on (company_id, source_url) prevents duplicates on rescan.
"""

import logging
import re
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any
from urllib.parse import quote_plus

import httpx
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db.models import Company, Contact
from app.services.security import validate_url, SSRFBlockedError, InvalidURLError

logger = logging.getLogger(__name__)

# -----------------------------------------------------------------
# Constants
# -----------------------------------------------------------------
_GITHUB_API_TIMEOUT_S = 10
_CONTACT_CACHE_DAYS = 7
_GITHUB_CONTRIBUTOR_CAP = 5
_TEAM_PAGE_CONTACT_CAP = 5
_LINKEDIN_TARGET_TITLES = [
    "Engineering Manager",
    "Product Manager",
    "Founding Engineer",
]

# Role-keyword regex for team-page parsing
_ROLE_KEYWORDS_RE = re.compile(
    r"\b(engineer|manager|founder|cto|cpo|vp|director|lead|principal|head of)\b",
    re.IGNORECASE,
)

# Markdown bold name pattern:  **Name** — Title  or  **Name**, Title
_MD_BOLD_NAME_RE = re.compile(
    r"\*\*([A-Z][a-zA-Z\s'\-]+?)\*\*\s*[,\u2014\-]\s*(.+)"
)

# Plain-text parenthetical:  Name (Title)
_PAREN_TITLE_RE = re.compile(
    r"^([A-Z][a-zA-Z\s'\-]{2,40})\s+\(([^)]{5,80})\)\s*$"
)


# -----------------------------------------------------------------
# Pydantic model for GitHub API response validation
# -----------------------------------------------------------------
class _GitHubContributor(BaseModel):
    """Validated shape of one GitHub contributor API response item."""

    login: str
    html_url: str
    type: str = "User"


# -----------------------------------------------------------------
# Internal helpers
# -----------------------------------------------------------------
def _build_linkedin_search_url(title: str, company_name: str) -> str:
    """Return a LinkedIn people-search URL for the given title + company."""
    kw = quote_plus(f"{title} {company_name}")
    return (
        f"https://www.linkedin.com/search/results/people/"
        f"?keywords={kw}&origin=GLOBAL_SEARCH_HEADER"
    )


def _extract_contacts_from_text(text: str, source_url: str) -> list[dict]:
    """
    Parse a page's plain text for name+title pairs.

    Returns a list of dicts with keys: name, title, source_url, contact_type.
    """
    found: list[dict] = []

    for line in text.splitlines():
        line = line.strip()
        if not line:
            continue

        # Pattern A — markdown bold
        m = _MD_BOLD_NAME_RE.match(line)
        if m:
            name, title = m.group(1).strip(), m.group(2).strip()
            if _ROLE_KEYWORDS_RE.search(title):
                found.append(
                    {
                        "name": name,
                        "title": title[:200],
                        "source_url": source_url,
                        "contact_type": "team_page",
                    }
                )
                continue

        # Pattern B — Name (Title)
        m = _PAREN_TITLE_RE.match(line)
        if m:
            name, title = m.group(1).strip(), m.group(2).strip()
            if _ROLE_KEYWORDS_RE.search(title):
                found.append(
                    {
                        "name": name,
                        "title": title[:200],
                        "source_url": source_url,
                        "contact_type": "team_page",
                    }
                )

    return found[:_TEAM_PAGE_CONTACT_CAP]


async def _upsert_contacts(
    contacts: list[dict[str, Any]],
    company_id: uuid.UUID,
    db: AsyncSession,
) -> None:
    """
    Upsert contact rows for a company.

    Uses ON CONFLICT DO UPDATE to refresh scraped_at on rescan without
    creating duplicate rows.  Each row is wrapped in its own savepoint so
    a single bad row never rolls back the entire batch.
    """
    now = datetime.now(timezone.utc)
    for c in contacts:
        try:
            async with db.begin_nested():
                stmt = pg_insert(Contact).values(
                    company_id=company_id,
                    name=c.get("name"),
                    title=c["title"],
                    source_url=c["source_url"],
                    contact_type=c["contact_type"],
                    scraped_at=now,
                )
                stmt = stmt.on_conflict_do_update(
                    constraint="uq_contacts_company_source_url",
                    set_={"scraped_at": now},
                )
                await db.execute(stmt)
        except Exception as exc:
            logger.error("Failed to upsert contact %s: %s", c.get("source_url"), exc)


# -----------------------------------------------------------------
# Public API
# -----------------------------------------------------------------
async def find_contacts(
    company_id: uuid.UUID, db: AsyncSession
) -> list[Contact]:
    """
    Discover and persist contacts for a company.

    Returns the full list of contacts stored for this company (all types).
    Never raises — all errors are logged and skipped.

    Args:
        company_id: UUID of the company to discover contacts for.
        db: Active async SQLAlchemy session.

    Returns:
        List of Contact ORM objects for this company.
    """
    # 1. Fetch company
    stmt_company = select(Company).where(Company.id == company_id)
    company = (await db.execute(stmt_company)).scalar_one_or_none()
    if not company:
        logger.error("find_contacts: company %s not found", company_id)
        return []

    # 2. Cache check — return early if recent contacts exist
    cache_cutoff = datetime.now(timezone.utc) - timedelta(days=_CONTACT_CACHE_DAYS)
    stmt_cache = select(Contact).where(
        Contact.company_id == company_id,
        Contact.scraped_at >= cache_cutoff,
    )
    cached = (await db.execute(stmt_cache)).scalars().all()
    if cached:
        logger.info(
            "Returning %d cached contacts for company %s", len(cached), company.name
        )
        return list(cached)

    new_contacts: list[dict[str, Any]] = []

    # ------------------------------------------------------------------
    # Path A: GitHub contributor scan
    # ------------------------------------------------------------------
    if company.github_repo_url:
        new_contacts.extend(
            await _scan_github_contributors(company.github_repo_url)
        )

    # ------------------------------------------------------------------
    # Path B: LinkedIn search URL generation (always runs, no HTTP call)
    # ------------------------------------------------------------------
    for title in _LINKEDIN_TARGET_TITLES:
        new_contacts.append(
            {
                "name": None,
                "title": title,
                "source_url": _build_linkedin_search_url(title, company.name),
                "contact_type": "linkedin_search",
            }
        )

    # ------------------------------------------------------------------
    # Path C: Public team/about page scrape
    # ------------------------------------------------------------------
    if company.url:
        new_contacts.extend(await _scrape_team_pages(company.url))

    # 3. Persist
    if new_contacts:
        await _upsert_contacts(new_contacts, company_id, db)
        await db.commit()

    # 4. Return all contacts (including any pre-existing ones from prior scans)
    stmt_all = select(Contact).where(Contact.company_id == company_id)
    all_contacts = (await db.execute(stmt_all)).scalars().all()
    logger.info(
        "find_contacts complete for %s: %d total contacts",
        company.name,
        len(all_contacts),
    )
    return list(all_contacts)


async def _scan_github_contributors(github_repo_url: str) -> list[dict[str, Any]]:
    """
    Fetch up to _GITHUB_CONTRIBUTOR_CAP contributors from the GitHub API.

    Returns an empty list on any error (rate-limit, network failure, bad URL).
    """
    # Extract owner/repo from URL
    match = re.search(r"github\.com/([^/]+)/([^/?\s#]+)", github_repo_url)
    if not match:
        logger.warning("Could not parse owner/repo from %s", github_repo_url)
        return []

    owner, repo = match.group(1), match.group(2).rstrip(".git")
    api_url = (
        f"https://api.github.com/repos/{owner}/{repo}/contributors"
        f"?per_page={_GITHUB_CONTRIBUTOR_CAP}"
    )

    headers: dict[str, str] = {"Accept": "application/vnd.github+json"}
    if settings.github_token:
        headers["Authorization"] = f"token {settings.github_token}"

    try:
        timeout = httpx.Timeout(connect=5.0, read=_GITHUB_API_TIMEOUT_S, write=5.0, pool=5.0)
        async with httpx.AsyncClient(timeout=timeout, follow_redirects=False) as client:
            resp = await client.get(api_url, headers=headers)
    except Exception as exc:
        logger.warning("GitHub API request failed for %s/%s: %s", owner, repo, exc)
        return []

    if resp.status_code in (403, 429):
        logger.warning(
            "GitHub API rate-limited (%d) for %s/%s — skipping contributor scan",
            resp.status_code,
            owner,
            repo,
        )
        return []

    if resp.status_code != 200:
        logger.warning(
            "GitHub API returned %d for %s/%s — skipping",
            resp.status_code,
            owner,
            repo,
        )
        return []

    try:
        raw_items: list[dict] = resp.json()
    except Exception as exc:
        logger.warning("Failed to parse GitHub API JSON: %s", exc)
        return []

    contacts: list[dict[str, Any]] = []
    for item in raw_items[:_GITHUB_CONTRIBUTOR_CAP]:
        try:
            contributor = _GitHubContributor.model_validate(item)
        except Exception as exc:
            logger.debug("Skipping invalid contributor item: %s", exc)
            continue

        if contributor.type != "User":
            continue  # Skip bots

        # Validate the profile URL before storing
        try:
            safe_url = validate_url(contributor.html_url)
        except (SSRFBlockedError, InvalidURLError) as exc:
            logger.warning("SSRF/Invalid URL for GitHub contributor %s: %s", contributor.login, exc)
            continue

        contacts.append(
            {
                "name": contributor.login,
                "title": "Contributor",
                "source_url": safe_url,
                "contact_type": "github_profile",
            }
        )

    logger.info("GitHub contributor scan: found %d contacts for %s/%s", len(contacts), owner, repo)
    return contacts


async def _scrape_team_pages(company_url: str) -> list[dict[str, Any]]:
    """
    Attempt to scrape /team and /about pages for name+title pairs.

    Returns an empty list on any fetch error (timeout, 404, SSRF block).
    """
    from app.services.url_fetcher import fetch_and_extract_url, URLFetchError

    contacts: list[dict[str, Any]] = []
    base = company_url.rstrip("/")

    for path in ("/team", "/about"):
        target_url = f"{base}{path}"

        try:
            # validate_url is called inside fetch_and_extract_url — SSRF guarded
            text = await fetch_and_extract_url(target_url)
        except (URLFetchError, SSRFBlockedError, InvalidURLError) as exc:
            logger.debug("Team page fetch skipped for %s: %s", target_url, exc)
            continue
        except Exception as exc:
            logger.warning("Unexpected error scraping %s: %s", target_url, exc)
            continue

        found = _extract_contacts_from_text(text, target_url)
        logger.info("Team page scrape %s: found %d contacts", target_url, len(found))
        contacts.extend(found)

    return contacts[:_TEAM_PAGE_CONTACT_CAP]
