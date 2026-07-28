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

    from urllib.parse import urljoin
    current_url = validated_url
    redirects_count = 0
    content_bytes = bytearray()
    last_response_status_code = None
    last_response_headers = None
    last_response_request = None

    try:
        async with httpx.AsyncClient(
            timeout=timeout,
            follow_redirects=False,
            headers={"User-Agent": _USER_AGENT},
        ) as client:
            while True:
                req = client.build_request("GET", current_url)
                response = await client.send(req, stream=True)
                try:
                    last_response_status_code = response.status_code
                    last_response_headers = response.headers
                    last_response_request = response.request

                    # Check for redirect
                    if response.status_code in (301, 302, 303, 307, 308):
                        location = response.headers.get("location")
                        if not location:
                            raise URLFetchError("Redirect response missing Location header.")
                        
                        next_url = urljoin(current_url, location)
                        current_url = validate_url(next_url)
                        
                        redirects_count += 1
                        if redirects_count > MAX_REDIRECTS:
                            raise URLFetchError(f"Too many redirects (limit: {MAX_REDIRECTS})")
                        
                        continue
                    
                    response.raise_for_status()
                    
                    content_length_header = response.headers.get("content-length")
                    if content_length_header:
                        try:
                            cl = int(content_length_header)
                            if cl > MAX_URL_RESPONSE_BYTES:
                                raise ContentTooLargeError(
                                    f"Response too large ({cl} bytes). Maximum: {MAX_URL_RESPONSE_BYTES} bytes."
                                )
                        except ValueError:
                            pass
                    
                    async for chunk in response.aiter_bytes():
                        content_bytes.extend(chunk)
                        if len(content_bytes) > MAX_URL_RESPONSE_BYTES:
                            raise ContentTooLargeError(
                                f"Response too large ({len(content_bytes)} bytes). Maximum: {MAX_URL_RESPONSE_BYTES} bytes."
                            )
                    
                    break
                finally:
                    await response.aclose()

    except httpx.TimeoutException as e:
        raise FetchTimeoutError(
            f"Timed out fetching URL (limit: {URL_FETCH_TIMEOUT_TOTAL}s): {e}"
        ) from e
    except (InvalidURLError, SSRFBlockedError):
        raise
    except httpx.HTTPStatusError as e:
        raise URLFetchError(
            f"URL returned HTTP {e.response.status_code}: {e}"
        ) from e
    except URLFetchError:
        raise
    except Exception as e:
        raise URLFetchError(f"Failed to fetch URL: {e}") from e

    # Build dummy completed response to pass to downstream extraction
    response = httpx.Response(
        status_code=last_response_status_code,
        headers=last_response_headers,
        content=bytes(content_bytes),
        request=last_response_request,
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
