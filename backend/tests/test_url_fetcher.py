"""
Tests for portfolio URL fetching.

All HTTP calls are mocked — no real network requests.
Tests cover SSRF blocking, timeout handling, content extraction,
size limits, and error paths.
"""

from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest

from app.services.url_fetcher import (
    ContentTooLargeError,
    FetchTimeoutError,
    HTMLExtractionError,
    URLFetchError,
    _extract_text_from_html,
    fetch_and_extract_url,
)
from app.services.security import (
    InvalidURLError,
    SSRFBlockedError,
    MAX_URL_RESPONSE_BYTES,
)


# ---------- HTML extraction tests (synchronous, no mocking needed) ----------


class TestExtractTextFromHtml:
    """Tests for _extract_text_from_html()."""

    def test_extracts_body_text(self):
        """Should extract text from HTML body."""
        html = """
        <html><body>
            <h1>John Doe</h1>
            <p>Software Engineer with 3 years of experience.</p>
            <p>Skills: Python, React, PostgreSQL</p>
        </body></html>
        """
        result = _extract_text_from_html(html)
        assert "John Doe" in result
        assert "Python" in result

    def test_strips_script_tags(self):
        """Script content should not appear in output."""
        html = """
        <html><body>
            <p>Real content here for testing purposes and verification</p>
            <script>var x = 'should not appear'; alert('malicious');</script>
        </body></html>
        """
        result = _extract_text_from_html(html)
        assert "should not appear" not in result
        assert "Real content" in result

    def test_strips_style_tags(self):
        """CSS content should not appear in output."""
        html = """
        <html><body>
            <style>.hidden { display: none; }</style>
            <p>Visible content for resume parsing and testing only</p>
        </body></html>
        """
        result = _extract_text_from_html(html)
        assert "display: none" not in result
        assert "Visible content" in result

    def test_strips_nav_and_footer(self):
        """Navigation and footer boilerplate should be stripped."""
        html = """
        <html><body>
            <nav><a href="/">Home</a><a href="/about">About</a></nav>
            <main><p>Main portfolio content with relevant information</p></main>
            <footer><p>Copyright 2024 - All rights reserved</p></footer>
        </body></html>
        """
        result = _extract_text_from_html(html)
        assert "Main portfolio content" in result
        # Nav and footer content should be stripped
        assert "Copyright" not in result

    def test_prefers_main_content(self):
        """Should prioritize <main> element if present."""
        html = """
        <html><body>
            <div>Sidebar noise content that should not be extracted</div>
            <main>
                <h1>Portfolio</h1>
                <p>My main portfolio content with important details</p>
            </main>
            <div>More sidebar noise content to be filtered out</div>
        </body></html>
        """
        result = _extract_text_from_html(html)
        assert "Portfolio" in result
        assert "main portfolio content" in result

    def test_empty_html_raises(self):
        """HTML with no text should raise."""
        with pytest.raises(HTMLExtractionError):
            _extract_text_from_html("<html><body></body></html>")


# ---------- URL fetch tests (mocked HTTP) ----------


class TestFetchAndExtractUrl:
    """Tests for fetch_and_extract_url() with mocked HTTP."""

    @pytest.mark.asyncio
    async def test_ssrf_private_ip_blocked(self):
        """URLs resolving to private IPs should be blocked before any fetch."""
        with pytest.raises((SSRFBlockedError, InvalidURLError, URLFetchError)):
            await fetch_and_extract_url("http://127.0.0.1/admin")

    @pytest.mark.asyncio
    async def test_forbidden_scheme_blocked(self):
        """Non-HTTP schemes should be rejected."""
        with pytest.raises((InvalidURLError, URLFetchError)):
            await fetch_and_extract_url("file:///etc/passwd")

    @pytest.mark.asyncio
    async def test_ftp_scheme_blocked(self):
        """FTP scheme should be rejected."""
        with pytest.raises((InvalidURLError, URLFetchError)):
            await fetch_and_extract_url("ftp://example.com/resume.pdf")

    @pytest.mark.asyncio
    async def test_successful_html_fetch(self):
        """Valid URL returning HTML should extract text content."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.headers = {"content-type": "text/html; charset=utf-8"}
        mock_response.raise_for_status = MagicMock()
        
        text_content = """
        <html><body>
            <main>
                <h1>John Doe - Software Engineer</h1>
                <p>Experienced Python developer with 5 years in backend systems.</p>
                <p>Skills: Python, FastAPI, PostgreSQL, Docker, Kubernetes</p>
            </main>
        </body></html>
        """
        mock_response.content = text_content.encode()
        
        async def mock_aiter_bytes():
            yield mock_response.content
        mock_response.aiter_bytes = mock_aiter_bytes
        mock_response.aclose = AsyncMock()

        mock_client = AsyncMock()
        mock_client.build_request = MagicMock()
        mock_client.send = AsyncMock(return_value=mock_response)
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=None)

        with patch("app.services.url_fetcher.validate_url", return_value="https://example.com"):
            with patch("app.services.url_fetcher.httpx.AsyncClient", return_value=mock_client):
                result = await fetch_and_extract_url("https://example.com")

        assert "John Doe" in result
        assert "Python" in result

    @pytest.mark.asyncio
    async def test_plain_text_fetch(self):
        """URL returning plain text should use it directly."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.headers = {"content-type": "text/plain"}
        mock_response.raise_for_status = MagicMock()
        
        plain_text = "John Doe, Software Engineer. Skills: Python, React. " * 5
        mock_response.content = plain_text.encode()
        
        async def mock_aiter_bytes():
            yield mock_response.content
        mock_response.aiter_bytes = mock_aiter_bytes
        mock_response.aclose = AsyncMock()

        mock_client = AsyncMock()
        mock_client.build_request = MagicMock()
        mock_client.send = AsyncMock(return_value=mock_response)
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=None)

        with patch("app.services.url_fetcher.validate_url", return_value="https://example.com"):
            with patch("app.services.url_fetcher.httpx.AsyncClient", return_value=mock_client):
                result = await fetch_and_extract_url("https://example.com/resume.txt")

        assert "John Doe" in result

    @pytest.mark.asyncio
    async def test_response_too_large_rejected(self):
        """Responses exceeding MAX_URL_RESPONSE_BYTES should be rejected."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.headers = {"content-type": "text/html"}
        mock_response.raise_for_status = MagicMock()
        
        large_content = b"x" * (MAX_URL_RESPONSE_BYTES + 1)
        mock_response.content = large_content
        
        async def mock_aiter_bytes():
            yield b"x" * (MAX_URL_RESPONSE_BYTES // 2)
            yield b"x" * (MAX_URL_RESPONSE_BYTES // 2 + 5)
            
        mock_response.aiter_bytes = mock_aiter_bytes
        mock_response.aclose = AsyncMock()

        mock_client = AsyncMock()
        mock_client.build_request = MagicMock()
        mock_client.send = AsyncMock(return_value=mock_response)
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=None)

        with patch("app.services.url_fetcher.validate_url", return_value="https://example.com"):
            with patch("app.services.url_fetcher.httpx.AsyncClient", return_value=mock_client):
                with pytest.raises(ContentTooLargeError):
                    await fetch_and_extract_url("https://example.com/huge-page")

    @pytest.mark.asyncio
    async def test_response_content_length_header_too_large(self):
        """If content-length header exceeds limit, reject immediately."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.headers = {
            "content-type": "text/html",
            "content-length": str(MAX_URL_RESPONSE_BYTES + 1)
        }
        mock_response.raise_for_status = MagicMock()
        mock_response.aclose = AsyncMock()

        mock_client = AsyncMock()
        mock_client.build_request = MagicMock()
        mock_client.send = AsyncMock(return_value=mock_response)
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=None)

        with patch("app.services.url_fetcher.validate_url", return_value="https://example.com"):
            with patch("app.services.url_fetcher.httpx.AsyncClient", return_value=mock_client):
                with pytest.raises(ContentTooLargeError):
                    await fetch_and_extract_url("https://example.com/huge-page")

    @pytest.mark.asyncio
    async def test_timeout_raises_clear_error(self):
        """Timeouts should raise FetchTimeoutError."""
        mock_client = AsyncMock()
        mock_client.build_request = MagicMock()
        mock_client.send = AsyncMock(side_effect=httpx.TimeoutException("Connection timed out"))
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=None)

        with patch("app.services.url_fetcher.validate_url", return_value="https://example.com"):
            with patch("app.services.url_fetcher.httpx.AsyncClient", return_value=mock_client):
                with pytest.raises(FetchTimeoutError, match="timed out"):
                    await fetch_and_extract_url("https://slow-site.com")

    @pytest.mark.asyncio
    async def test_empty_response_rejected(self):
        """URLs returning empty content should raise URLFetchError."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.content = b""
        mock_response.headers = {"content-type": "text/html"}
        mock_response.raise_for_status = MagicMock()
        
        async def mock_aiter_bytes():
            if False:
                yield b""
        mock_response.aiter_bytes = mock_aiter_bytes
        mock_response.aclose = AsyncMock()

        mock_client = AsyncMock()
        mock_client.build_request = MagicMock()
        mock_client.send = AsyncMock(return_value=mock_response)
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=None)

        with patch("app.services.url_fetcher.validate_url", return_value="https://example.com"):
            with patch("app.services.url_fetcher.httpx.AsyncClient", return_value=mock_client):
                with pytest.raises(URLFetchError):
                    await fetch_and_extract_url("https://example.com/empty")

    @pytest.mark.asyncio
    async def test_http_error_raises(self):
        """HTTP error status codes should raise URLFetchError."""
        mock_response = MagicMock()
        mock_response.status_code = 404
        mock_response.aclose = AsyncMock()
        mock_response.raise_for_status = MagicMock(
            side_effect=httpx.HTTPStatusError(
                "Not Found",
                request=MagicMock(),
                response=mock_response,
            )
        )

        mock_client = AsyncMock()
        mock_client.build_request = MagicMock()
        mock_client.send = AsyncMock(return_value=mock_response)
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=None)

        with patch("app.services.url_fetcher.validate_url", return_value="https://example.com"):
            with patch("app.services.url_fetcher.httpx.AsyncClient", return_value=mock_client):
                with pytest.raises(URLFetchError, match="404"):
                    await fetch_and_extract_url("https://example.com/missing")

    @pytest.mark.asyncio
    async def test_redirect_to_private_ip_is_blocked(self):
        """Public URL redirecting to private/internal IP (e.g. 127.0.0.1) should raise SSRFBlockedError."""
        mock_redirect_response = MagicMock()
        mock_redirect_response.status_code = 302
        mock_redirect_response.headers = {"location": "http://127.0.0.1/admin"}
        mock_redirect_response.aclose = AsyncMock()

        mock_client = AsyncMock()
        mock_client.build_request = MagicMock()
        mock_client.send = AsyncMock(return_value=mock_redirect_response)
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=None)

        with patch("app.services.url_fetcher.validate_url", side_effect=[
            "https://public-site.com",
            SSRFBlockedError("URL blocked: resolves to private IP"),
        ]):
            with patch("app.services.url_fetcher.httpx.AsyncClient", return_value=mock_client):
                with pytest.raises(SSRFBlockedError):
                    await fetch_and_extract_url("https://public-site.com")

    @pytest.mark.asyncio
    async def test_relative_redirect_resolved_correctly(self):
        """Relative redirect should be resolved against the current URL and followed successfully."""
        mock_redirect_response = MagicMock()
        mock_redirect_response.status_code = 302
        mock_redirect_response.headers = {"location": "/profile-page"}
        mock_redirect_response.aclose = AsyncMock()

        mock_ok_response = MagicMock()
        mock_ok_response.status_code = 200
        mock_ok_response.headers = {"content-type": "text/plain"}
        mock_ok_response.raise_for_status = MagicMock()
        mock_ok_response.content = b"John Doe: Python developer profile info. More experience details here to pass validation."
        
        async def mock_aiter_bytes():
            yield mock_ok_response.content
        mock_ok_response.aiter_bytes = mock_aiter_bytes
        mock_ok_response.aclose = AsyncMock()

        mock_client = AsyncMock()
        mock_client.build_request = MagicMock()
        mock_client.send = AsyncMock(side_effect=[mock_redirect_response, mock_ok_response])
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=None)

        validated_urls = []
        def mock_validate(u):
            validated_urls.append(u)
            return u

        with patch("app.services.url_fetcher.validate_url", side_effect=mock_validate):
            with patch("app.services.url_fetcher.httpx.AsyncClient", return_value=mock_client):
                result = await fetch_and_extract_url("https://example.com/start")

        assert "John Doe" in result
        assert "Python" in result
        assert validated_urls == ["https://example.com/start", "https://example.com/profile-page"]

    @pytest.mark.asyncio
    async def test_too_many_redirects_fails(self):
        """If redirect count exceeds MAX_REDIRECTS, fail with URLFetchError."""
        mock_redirect_response = MagicMock()
        mock_redirect_response.status_code = 302
        mock_redirect_response.headers = {"location": "https://example.com/next"}
        mock_redirect_response.aclose = AsyncMock()

        mock_client = AsyncMock()
        mock_client.build_request = MagicMock()
        mock_client.send = AsyncMock(return_value=mock_redirect_response)
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=None)

        with patch("app.services.url_fetcher.validate_url", lambda u: u):
            with patch("app.services.url_fetcher.httpx.AsyncClient", return_value=mock_client):
                with pytest.raises(URLFetchError, match="Too many redirects"):
                    await fetch_and_extract_url("https://example.com/infinite")
