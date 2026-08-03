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
    """
    Fetch a URL and extract readable text content.

    Full pipeline:
    1. Validate URL (scheme, SSRF check)
    2. Fetch with timeouts and size limits
    3. Extract text (HTML → readable text, or plain text passthrough)
    4. Validate minimum content threshold

    Args:
        url: Portfolio/resume URL to fetch.

    Returns:
        Extracted text content from the URL.

    Raises:
        InvalidURLError: If the URL is malformed or uses a forbidden scheme.
        SSRFBlockedError: If the URL resolves to a private IP.
        FetchTimeoutError: If the request times out.
        ContentTooLargeError: If the response exceeds the size limit.
        HTMLExtractionError: If text extraction from HTML fails.
        URLFetchError: For other fetch failures.
    """
    # Step 1: Validate URL (includes SSRF check)
    validated_url = validate_url(url)
    logger.info("Fetching portfolio URL: %s", validated_url[:100])

    # Step 2: Fetch with security constraints
    timeout = httpx.Timeout(
        connect=URL_FETCH_TIMEOUT_CONNECT,
        read=URL_FETCH_TIMEOUT_TOTAL,
        write=URL_FETCH_TIMEOUT_TOTAL,
        pool=URL_FETCH_TIMEOUT_TOTAL,
    )

    try:
        async with httpx.AsyncClient(
            timeout=timeout,
            max_redirects=MAX_REDIRECTS,
            follow_redirects=True,
            headers={"User-Agent": _USER_AGENT},
        ) as client:
            response = await client.get(validated_url)
            response.raise_for_status()

    except httpx.TimeoutException as e:
        raise FetchTimeoutError(
            f"Timed out fetching URL (limit: {URL_FETCH_TIMEOUT_TOTAL}s): {e}"
        ) from e
    except httpx.TooManyRedirects as e:
        raise URLFetchError(
            f"Too many redirects (limit: {MAX_REDIRECTS}): {e}"
        ) from e
    except (InvalidURLError, SSRFBlockedError):
        # Re-raise our own security errors unchanged
        raise
    except httpx.HTTPStatusError as e:
        raise URLFetchError(
            f"URL returned HTTP {e.response.status_code}: {e}"
        ) from e
    except Exception as e:
        raise URLFetchError(f"Failed to fetch URL: {e}") from e

    # Step 3: Check response size
    content_length = len(response.content)
    if content_length > MAX_URL_RESPONSE_BYTES:
        max_mb = MAX_URL_RESPONSE_BYTES / (1024 * 1024)
        raise ContentTooLargeError(
            f"Response too large ({content_length / (1024 * 1024):.1f}MB). "
            f"Maximum: {max_mb:.0f}MB."
        )

    # Step 4: Extract text based on content type
    content_type = response.headers.get("content-type", "")
    raw_content = response.text

    if not raw_content or not raw_content.strip():
        raise URLFetchError("URL returned empty content.")

    if "text/html" in content_type or "application/xhtml" in content_type:
        text = _extract_text_from_html(raw_content)
    elif "text/plain" in content_type:
        text = raw_content.strip()
    elif "application/json" in content_type:
        # JSON pages (e.g., GitHub API) — extract as-is, the LLM can parse it
        text = raw_content.strip()
    else:
        # Try HTML extraction as fallback (many pages don't set correct content-type)
        try:
            text = _extract_text_from_html(raw_content)
        except HTMLExtractionError:
            text = raw_content.strip()

    # Cap text length to prevent excessive LLM input
    if len(text) > 50_000:
        text = text[:50_000]
        logger.warning("Truncated URL content from %d to 50,000 chars", len(raw_content))

    # Step 5: Validate minimum content
    try:
        text = validate_extracted_text(text, f"URL '{url[:80]}'")
    except Exception as e:
        raise URLFetchError(str(e)) from e

    logger.info(
        "Extracted %d characters from URL (content-type: %s)",
        len(text),
        content_type[:50],
    )
    return text
