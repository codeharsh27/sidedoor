"""Tests for Stage 6 Contact Finder Service."""

import uuid
from datetime import datetime, timezone, timedelta
from unittest.mock import AsyncMock, MagicMock, patch
import pytest

from app.db.models import Company, Contact
from app.services.contact_finder import find_contacts, _extract_contacts_from_text


class TestContactFinder:
    """Tests for Contact Finder Service."""

    def test_extract_contacts_from_text_patterns(self):
        """Verify parsing team page content for standard name/title patterns."""
        markdown_text = """
Some header text
**Alice Smith** — Principal Engineer
**Bob Jones**, CTO & Founder
**Charlie Brown** — Designer
Some random line without bold
Dave White (Founding Engineer)
Eve Black (Marketing Specialist)
"""
        contacts = _extract_contacts_from_text(markdown_text, "https://test.com/team")
        
        # Verify valid role matches
        assert len(contacts) == 3
        
        assert contacts[0]["name"] == "Alice Smith"
        assert contacts[0]["title"] == "Principal Engineer"
        assert contacts[0]["contact_type"] == "team_page"
        
        assert contacts[1]["name"] == "Bob Jones"
        assert contacts[1]["title"] == "CTO & Founder"
        
        assert contacts[2]["name"] == "Dave White"
        assert contacts[2]["title"] == "Founding Engineer"

    @pytest.mark.asyncio
    @patch("app.services.contact_finder._scan_github_contributors")
    @patch("app.services.contact_finder._scrape_team_pages")
    async def test_find_contacts_cache_hit(self, mock_scrape, mock_scan):
        """If recent contacts exist within 7 days, return them without scanning."""
        company_id = uuid.uuid4()
        db = MagicMock()
        
        company = Company(
            id=company_id,
            name="CacheCo",
            url="https://cache.com",
            github_repo_url="https://github.com/cache/co"
        )
        
        # Mock company query
        res_comp = MagicMock()
        res_comp.scalar_one_or_none.return_value = company
        
        # Mock recent contact in database
        contact = Contact(
            id=uuid.uuid4(),
            company_id=company_id,
            name="Cached Person",
            title="Engineer",
            source_url="https://test.com",
            contact_type="team_page",
            scraped_at=datetime.now(timezone.utc) - timedelta(days=2)
        )
        res_contact = MagicMock()
        res_contact.scalars.return_value.all.return_value = [contact]
        
        db.execute = AsyncMock(side_effect=[res_comp, res_contact])
        
        contacts = await find_contacts(company_id, db)
        assert len(contacts) == 1
        assert contacts[0].name == "Cached Person"
        
        # Scanners should not have been called
        mock_scan.assert_not_called()
        mock_scrape.assert_not_called()

    @pytest.mark.asyncio
    @patch("httpx.AsyncClient.get")
    @patch("app.services.contact_finder._scrape_team_pages")
    async def test_find_contacts_github_success(self, mock_scrape, mock_get):
        """Verify GitHub contributors are scanned and mapped to Contacts successfully."""
        company_id = uuid.uuid4()
        db = MagicMock()
        db.commit = AsyncMock()
        
        company = Company(
            id=company_id,
            name="GitCo",
            url="https://git.com",
            github_repo_url="https://github.com/git/co"
        )
        
        # Mock DB executes
        # 1. Company query
        res_comp = MagicMock()
        res_comp.scalar_one_or_none.return_value = company
        # 2. Recent contacts cache check query (none found)
        res_cache = MagicMock()
        res_cache.scalars.return_value.all.return_value = []
        # 3. Final all-contacts query
        res_final = MagicMock()
        # Mock returns of execute
        db.execute = AsyncMock(side_effect=[res_comp, res_cache, MagicMock(), MagicMock(), MagicMock(), MagicMock(), res_final])
        
        # Setup mock final query to return the expected contacts
        github_contact = Contact(
            company_id=company_id,
            name="contributor1",
            title="Contributor",
            source_url="https://github.com/contributor1",
            contact_type="github_profile"
        )
        res_final.scalars.return_value.all.return_value = [github_contact]

        # Setup mock HTTP response for contributors
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = [
            {
                "login": "contributor1",
                "html_url": "https://github.com/contributor1",
                "type": "User",
            }
        ]
        mock_get.return_value = mock_resp
        
        mock_scrape.return_value = []
        
        # Mock nested transactions
        nested_ctx = AsyncMock()
        nested_ctx.__aenter__ = AsyncMock(return_value=nested_ctx)
        nested_ctx.__aexit__ = AsyncMock(return_value=False)
        db.begin_nested = MagicMock(return_value=nested_ctx)
        
        contacts = await find_contacts(company_id, db)
        assert len(contacts) == 1
        assert contacts[0].contact_type == "github_profile"
        assert contacts[0].name == "contributor1"

    @pytest.mark.asyncio
    @patch("httpx.AsyncClient.get")
    @patch("app.services.contact_finder._scrape_team_pages")
    async def test_find_contacts_github_rate_limited(self, mock_scrape, mock_get):
        """Verify GitHub rate limit response is handled gracefully without exception."""
        company_id = uuid.uuid4()
        db = MagicMock()
        db.commit = AsyncMock()
        
        company = Company(
            id=company_id,
            name="RateCo",
            url="https://rate.com",
            github_repo_url="https://github.com/rate/co"
        )
        
        res_comp = MagicMock()
        res_comp.scalar_one_or_none.return_value = company
        res_cache = MagicMock()
        res_cache.scalars.return_value.all.return_value = []
        res_final = MagicMock()
        
        # Expecting calls: company query, cache check, upserts for linkedin (3 calls), final all-contacts query
        db.execute = AsyncMock(side_effect=[res_comp, res_cache, MagicMock(), MagicMock(), MagicMock(), res_final])
        res_final.scalars.return_value.all.return_value = []

        mock_resp = MagicMock()
        mock_resp.status_code = 429  # Too Many Requests
        mock_get.return_value = mock_resp
        
        mock_scrape.return_value = []
        
        nested_ctx = AsyncMock()
        nested_ctx.__aenter__ = AsyncMock(return_value=nested_ctx)
        db.begin_nested = MagicMock(return_value=nested_ctx)

        # Should complete without raising any HTTP status or rate limit exception
        contacts = await find_contacts(company_id, db)
        assert contacts == []

    @pytest.mark.asyncio
    @patch("app.services.contact_finder._scan_github_contributors")
    @patch("app.services.url_fetcher.fetch_and_extract_url")
    async def test_find_contacts_team_page_success(self, mock_fetch, mock_scan):
        """Verify team/about page scraping matches correct name/title patterns."""
        company_id = uuid.uuid4()
        db = MagicMock()
        db.commit = AsyncMock()
        
        company = Company(
            id=company_id,
            name="ScrapeCo",
            url="https://scrape.com",
            github_repo_url=None
        )
        
        res_comp = MagicMock()
        res_comp.scalar_one_or_none.return_value = company
        res_cache = MagicMock()
        res_cache.scalars.return_value.all.return_value = []
        res_final = MagicMock()
        
        db.execute = AsyncMock(side_effect=[res_comp, res_cache, MagicMock(), MagicMock(), MagicMock(), MagicMock(), res_final])
        
        scraped_contact = Contact(
            company_id=company_id,
            name="John Doe",
            title="VP of Engineering",
            source_url="https://scrape.com/team",
            contact_type="team_page"
        )
        res_final.scalars.return_value.all.return_value = [scraped_contact]

        # First fetch (e.g. /team) succeeds, second fetch (e.g. /about) returns nothing or empty
        mock_fetch.side_effect = [
            "**John Doe** — VP of Engineering\n",
            ""
        ]
        
        mock_scan.return_value = []
        
        nested_ctx = AsyncMock()
        nested_ctx.__aenter__ = AsyncMock(return_value=nested_ctx)
        db.begin_nested = MagicMock(return_value=nested_ctx)

        contacts = await find_contacts(company_id, db)
        assert len(contacts) == 1
        assert contacts[0].name == "John Doe"
        assert contacts[0].title == "VP of Engineering"
        assert contacts[0].contact_type == "team_page"
