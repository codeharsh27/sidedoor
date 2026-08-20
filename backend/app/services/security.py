"""
Security constants and validation helpers for the backend pipeline.

Centralized here so every service and endpoint uses the same rules.
No LLM — pure validation logic.
"""

import ipaddress
import logging
import socket
from urllib.parse import urlparse

logger = logging.getLogger(__name__)


# ---------- File upload limits ----------

MAX_FILE_SIZE_BYTES: int = 10 * 1024 * 1024  # 10MB — generous for resumes
ALLOWED_FILE_CONTENT_TYPES: set[str] = {
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",  # .docx
    "application/msword",  # .doc (legacy)
}
ALLOWED_FILE_EXTENSIONS: set[str] = {".pdf", ".doc", ".docx"}


# ---------- URL fetching limits ----------

MAX_URL_RESPONSE_BYTES: int = 2 * 1024 * 1024  # 2MB for fetched pages
URL_FETCH_TIMEOUT_CONNECT: int = 15  # seconds
URL_FETCH_TIMEOUT_TOTAL: int = 30  # seconds
MAX_REDIRECTS: int = 5
ALLOWED_URL_SCHEMES: set[str] = {"http", "https"}


# ---------- Text input limits ----------

MAX_TEXT_INPUT_CHARS: int = 100_000  # 100K chars for pasted text
MIN_EXTRACTABLE_CHARS: int = 50  # reject junk inputs


# ---------- Private IP ranges (SSRF prevention) ----------

_PRIVATE_NETWORKS = [
    ipaddress.ip_network("127.0.0.0/8"),       # Loopback
    ipaddress.ip_network("10.0.0.0/8"),         # Private class A
    ipaddress.ip_network("172.16.0.0/12"),      # Private class B
    ipaddress.ip_network("192.168.0.0/16"),     # Private class C
    ipaddress.ip_network("169.254.0.0/16"),     # Link-local
    ipaddress.ip_network("0.0.0.0/8"),          # "This" network
    ipaddress.ip_network("100.64.0.0/10"),      # Shared address space (CGNAT)
    ipaddress.ip_network("198.18.0.0/15"),      # Benchmarking
    ipaddress.ip_network("::1/128"),            # IPv6 loopback
    ipaddress.ip_network("fc00::/7"),           # IPv6 unique local
    ipaddress.ip_network("fe80::/10"),          # IPv6 link-local
]


# ---------- Exceptions ----------


class SecurityError(Exception):
    """Base exception for security validation failures."""
    pass


class InvalidURLError(SecurityError):
    """Raised when a URL fails basic validation (scheme, format)."""
    pass


class SSRFBlockedError(SecurityError):
    """Raised when a URL resolves to a private/internal IP address."""
    pass


class FileTooLargeError(SecurityError):
    """Raised when an uploaded file exceeds MAX_FILE_SIZE_BYTES."""
    pass


class UnsupportedFileTypeError(SecurityError):
    """Raised when an uploaded file has a disallowed content type."""
    pass


class InsufficientContentError(SecurityError):
    """Raised when extracted text is below MIN_EXTRACTABLE_CHARS."""
    pass


class TextTooLargeError(SecurityError):
    """Raised when pasted text exceeds MAX_TEXT_INPUT_CHARS."""
    pass


# ---------- Validation functions ----------


def is_private_ip(ip_str: str) -> bool:
    """
    Check if an IP address falls within any private/internal range.

    Covers loopback, RFC1918, link-local, CGNAT, and IPv6 equivalents.

    Args:
        ip_str: String representation of an IP address.

    Returns:
        True if the IP is private/internal, False if public.
    """
    try:
        addr = ipaddress.ip_address(ip_str)
    except ValueError:
        # If we can't parse it, treat it as potentially dangerous
        return True

    for network in _PRIVATE_NETWORKS:
        if addr in network:
            return True
    return False


async def resolve_and_check_host(hostname: str) -> str:
    """
    Resolve a hostname to IP and verify it's not private.

    This is the core SSRF prevention check — we resolve DNS
    before connecting to ensure the hostname doesn't point
    to an internal resource.

    Args:
        hostname: The hostname to resolve.

    Returns:
        The resolved public IP address.

    Raises:
        SSRFBlockedError: If the hostname resolves to a private IP.
        InvalidURLError: If DNS resolution fails.
    """
    import asyncio
    try:
        # Resolve all addresses (IPv4 and IPv6)
        addr_infos = await asyncio.to_thread(socket.getaddrinfo, hostname, None, socket.AF_UNSPEC)
    except socket.gaierror as e:
        raise InvalidURLError(f"Cannot resolve hostname '{hostname}': {e}") from e

    if not addr_infos:
        raise InvalidURLError(f"Hostname '{hostname}' resolved to no addresses.")

    for addr_info in addr_infos:
        ip_str = addr_info[4][0]
        if is_private_ip(ip_str):
            raise SSRFBlockedError(
                f"URL blocked: hostname '{hostname}' resolves to private/internal "
                f"IP {ip_str}. This request has been blocked for security."
            )

    # Return the first resolved IP
    return addr_infos[0][4][0]


async def validate_url(url: str) -> str:
    """
    Validate and sanitize a URL for safe fetching.

    Checks:
    1. Non-empty, reasonable length
    2. Has allowed scheme (http/https only)
    3. Has a valid hostname
    4. Hostname doesn't resolve to a private IP (SSRF prevention)

    Args:
        url: The raw URL string from user input.

    Returns:
        Sanitized URL string (stripped, scheme-validated).

    Raises:
        InvalidURLError: If the URL is malformed or uses a forbidden scheme.
        SSRFBlockedError: If the URL resolves to a private IP.
    """
    if not url or not url.strip():
        raise InvalidURLError("URL is empty.")

    url = url.strip()

    if len(url) > 2048:
        raise InvalidURLError("URL exceeds maximum length (2048 characters).")

    parsed = urlparse(url)

    # Scheme check
    if parsed.scheme not in ALLOWED_URL_SCHEMES:
        raise InvalidURLError(
            f"URL scheme '{parsed.scheme}' is not allowed. "
            f"Only {', '.join(sorted(ALLOWED_URL_SCHEMES))} are permitted."
        )

    # Hostname check
    hostname = parsed.hostname
    if not hostname:
        raise InvalidURLError("URL has no hostname.")

    # Port check — block unusual ports that might target internal services
    if parsed.port and parsed.port not in (80, 443, 8080, 8443):
        raise InvalidURLError(
            f"URL port {parsed.port} is not allowed. "
            "Only standard web ports (80, 443, 8080, 8443) are permitted."
        )

    # SSRF check — resolve DNS and verify the IP isn't private
    await resolve_and_check_host(hostname)

    logger.info("URL validated: %s", url[:100])
    return url


def validate_file_size(size_bytes: int) -> None:
    """
    Validate that a file doesn't exceed the maximum allowed size.

    Args:
        size_bytes: Size of the file in bytes.

    Raises:
        FileTooLargeError: If the file exceeds MAX_FILE_SIZE_BYTES.
    """
    if size_bytes > MAX_FILE_SIZE_BYTES:
        max_mb = MAX_FILE_SIZE_BYTES / (1024 * 1024)
        actual_mb = size_bytes / (1024 * 1024)
        raise FileTooLargeError(
            f"File is too large ({actual_mb:.1f}MB). Maximum allowed: {max_mb:.0f}MB."
        )


def validate_file_content_type(
    content_type: str | None, filename: str | None, file_bytes: bytes | None = None
) -> None:
    """
    Validate that a file has an allowed content type or extension,
    and verify magic bytes if file_bytes is provided.

    Uses content-type header, filename extension, and magic bytes for defense in depth.

    Args:
        content_type: MIME type from the upload header (may be None/unreliable).
        filename: Original filename (may be None).
        file_bytes: Raw bytes of the uploaded file (may be None).

    Raises:
        UnsupportedFileTypeError: If neither content type nor extension is allowed, or magic bytes mismatch.
    """
    is_pdf = False
    is_docx = False

    if content_type:
        if content_type == "application/pdf":
            is_pdf = True
        elif content_type in ALLOWED_FILE_CONTENT_TYPES:
            is_docx = True

    if filename:
        ext = "." + filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
        if ext == ".pdf":
            is_pdf = True
        elif ext in ALLOWED_FILE_EXTENSIONS:
            is_docx = True

    if not is_pdf and not is_docx:
        allowed = ", ".join(sorted(ALLOWED_FILE_EXTENSIONS))
        raise UnsupportedFileTypeError(
            f"Unsupported file type. Allowed formats: {allowed}. "
            f"Got content_type='{content_type}', filename='{filename}'."
        )

    if file_bytes is not None:
        if is_pdf and not file_bytes.startswith(b"%PDF-"):
            raise UnsupportedFileTypeError("Invalid PDF file: missing magic bytes.")
        if is_docx and not file_bytes.startswith(b"PK\x03\x04") and not file_bytes.startswith(b"\xd0\xcf\x11\xe0"): # support older doc files too
            raise UnsupportedFileTypeError("Invalid DOCX/DOC file: missing magic bytes.")


def validate_text_input(text: str) -> str:
    """
    Validate and sanitize raw text input.

    Args:
        text: Raw text from user input.

    Returns:
        Sanitized text (stripped, length-checked).

    Raises:
        InsufficientContentError: If text is too short after stripping.
        TextTooLargeError: If text exceeds MAX_TEXT_INPUT_CHARS.
    """
    if not text or not text.strip():
        raise InsufficientContentError("Text input is empty.")

    text = text.strip()

    if len(text) > MAX_TEXT_INPUT_CHARS:
        raise TextTooLargeError(
            f"Text input exceeds maximum length ({MAX_TEXT_INPUT_CHARS:,} characters). "
            f"Got {len(text):,} characters."
        )

    if len(text) < MIN_EXTRACTABLE_CHARS:
        raise InsufficientContentError(
            f"Text input is too short ({len(text)} characters). "
            f"Minimum {MIN_EXTRACTABLE_CHARS} characters required for meaningful parsing."
        )

    return text


def validate_extracted_text(text: str, source: str) -> str:
    """
    Validate text after extraction from a document/URL.

    Args:
        text: Extracted text content.
        source: Description of the source (for error messages).

    Returns:
        The text, if valid.

    Raises:
        InsufficientContentError: If extracted text is too short.
    """
    if not text or len(text.strip()) < MIN_EXTRACTABLE_CHARS:
        raise InsufficientContentError(
            f"Extracted text from {source} is too short "
            f"({len(text.strip()) if text else 0} characters). "
            f"The document may be empty, image-only, or not a resume/portfolio."
        )
    return text.strip()
