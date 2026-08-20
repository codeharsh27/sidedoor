"""
Portfolio URL fetching — deterministic text extraction, no LLM.

Fetches a portfolio URL (GitHub profile, personal site, Notion page, etc.)
and extracts readable text content from it.

Security is the primary concern here:
  - SSRF prevention: all URLs validated via security.validate_url() before connecting
  - Response size cap: stream-reads with byte limit
  - Timeouts: connect + total timeout enforcement
  - Redirect safety: each redirect target re-validated against SSRF rules
"""

import logging

import httpx
from bs4 import BeautifulSoup

from app.services.security import (
    MAX_URL_RESPONSE_BYTES,
    URL_FETCH_TIMEOUT_CONNECT,
    URL_FETCH_TIMEOUT_TOTAL,
    MAX_REDIRECTS,
    InvalidURLError,
    SSRFBlockedError,
    validate_extracted_text,
    validate_url,
)

logger = logging.getLogger(__name__)


class URLFetchError(Exception):
    """Base exception for URL fetching failures."""
    pass


class FetchTimeoutError(URLFetchError):
    """Raised when URL fetching exceeds the timeout."""
    pass


class ContentTooLargeError(URLFetchError):
    """Raised when the fetched content exceeds MAX_URL_RESPONSE_BYTES."""
    pass


class HTMLExtractionError(URLFetchError):
    """Raised when HTML text extraction fails."""
    pass


# Elements to strip from HTML before extracting text
_STRIP_TAGS = {
    "script", "style", "nav", "footer", "header",
    "aside", "noscript", "iframe", "svg", "form",
}

# User-Agent that identifies us honestly (not impersonating a browser)
_USER_AGENT = "SideDoor/0.1 (portfolio-fetcher; +https://github.com/sidedoor)"


def _extract_text_from_html(html: str) -> str:
    """
    Extract readable text from HTML, stripping navigation and boilerplate.

    Prioritizes <main>, <article>, and role="main" content.
    Falls back to full body text if no semantic containers found.

    Args:
        html: Raw HTML string.

    Returns:
        Extracted plain text.

    Raises:
        HTMLExtractionError: If parsing fails or yields no text.
    """
    try:
        soup = BeautifulSoup(html, "html.parser")
    except Exception as e:
        raise HTMLExtractionError(f"Failed to parse HTML: {e}") from e

    # Remove noise elements
    for tag in soup.find_all(_STRIP_TAGS):
        tag.decompose()

    # Try to find the main content container first
    main_content = (
        soup.find("main")
        or soup.find("article")
        or soup.find(attrs={"role": "main"})
        or soup.find("div", class_="content")
        or soup.find("div", id="content")
    )

    target = main_content if main_content else soup.body if soup.body else soup

    # Extract text with separator to preserve some structure
    text = target.get_text(separator="\n", strip=True)

    if not text:
        raise HTMLExtractionError(
            "HTML was parsed but contained no extractable text content."
        )

    return text


async def fetch_and_extract_url(url: str) -> str:
    # Step 1: Validate URL (includes SSRF check)
    current_url = validate_url(url)
    logger.info("Fetching portfolio URL: %s", current_url[:100])

    timeout = httpx.Timeout(
        connect=URL_FETCH_TIMEOUT_CONNECT,
        read=URL_FETCH_TIMEOUT_TOTAL,
        write=URL_FETCH_TIMEOUT_TOTAL,
        pool=URL_FETCH_TIMEOUT_TOTAL,
    )

    redirects_followed = 0
    raw_bytes = b""
    content_type = ""

    try:
        async with httpx.AsyncClient(
            timeout=timeout,
            follow_redirects=False,
            headers={"User-Agent": _USER_AGENT},
        ) as client:
            while True:
                async with client.stream("GET", current_url) as response:
                    if 300 <= response.status_code < 400:
                        redirects_followed += 1
                        if redirects_followed > MAX_REDIRECTS:
                            raise URLFetchError(f"Too many redirects (limit: {MAX_REDIRECTS})")
                        location = response.headers.get("location")
                        if not location:
                            raise URLFetchError("Redirect missing Location header")
                        # Join with base url
                        from urllib.parse import urljoin
                        current_url = urljoin(current_url, location)
                        # Re-validate the redirect target for SSRF
                        current_url = validate_url(current_url)
                        continue

                    response.raise_for_status()
                    content_type = response.headers.get("content-type", "").lower()
                    
                    # Prevent UnicodeDecodeError on binary files before we read them
                    if not any(t in content_type for t in ["text/", "application/xhtml", "application/json", "application/xml"]):
                        raise URLFetchError(f"Unsupported content type: {content_type}")

                    bytes_read = 0
                    chunks = []
                    async for chunk in response.aiter_bytes():
                        bytes_read += len(chunk)
                        if bytes_read > MAX_URL_RESPONSE_BYTES:
                            max_mb = MAX_URL_RESPONSE_BYTES / (1024 * 1024)
                            raise ContentTooLargeError(
                                f"Response too large ({bytes_read / (1024 * 1024):.1f}MB). "
                                f"Maximum: {max_mb:.0f}MB."
                            )
                        chunks.append(chunk)
                    
                    raw_bytes = b"".join(chunks)
                    break
    except httpx.TimeoutException as e:
        raise FetchTimeoutError(f"Timed out fetching URL: {e}") from e
    except (InvalidURLError, SSRFBlockedError):
        raise
    except httpx.HTTPStatusError as e:
        raise URLFetchError(f"URL returned HTTP {e.response.status_code}: {e}") from e
    except Exception as e:
        if isinstance(e, URLFetchError):
            raise
        raise URLFetchError(f"Failed to fetch URL: {e}") from e

    try:
        raw_content = raw_bytes.decode("utf-8")
    except UnicodeDecodeError as e:
        raise URLFetchError(f"Failed to decode content as UTF-8: {e}") from e

    if not raw_content or not raw_content.strip():
        raise URLFetchError("URL returned empty content.")

    if "text/html" in content_type or "application/xhtml" in content_type:
        text = _extract_text_from_html(raw_content)
    elif "text/plain" in content_type or "application/json" in content_type or "application/xml" in content_type:
        text = raw_content.strip()
    else:
        try:
            text = _extract_text_from_html(raw_content)
        except HTMLExtractionError:
            text = raw_content.strip()

    if len(text) > 50_000:
        text = text[:50_000]
        logger.warning("Truncated URL content from %d to 50,000 chars", len(raw_content))

    try:
        text = validate_extracted_text(text, f"URL '{url[:80]}'")
    except Exception as e:
        raise URLFetchError(str(e)) from e

    logger.info("Extracted %d characters from URL (content-type: %s)", len(text), content_type[:50])
    return text
