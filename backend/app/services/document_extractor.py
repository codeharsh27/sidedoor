"""
Unified document extraction — single entry point for all input types.

Routes PDF, DOCX, URL, and raw text to the appropriate handler,
applies security validation, and returns a standardized result.

No LLM — pure extraction and routing logic.
"""

import logging
from dataclasses import dataclass

from app.services.security import (
    InsufficientContentError,
    UnsupportedFileTypeError,
    validate_extracted_text,
    validate_file_content_type,
    validate_file_size,
    validate_text_input,
)

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class ExtractionResult:
    """
    Standardized result from any extraction path.

    Consumed by the parse pipeline — every code path
    (PDF, DOCX, URL, raw text) produces the same shape.
    """

    raw_text: str
    source_type: str  # "pdf" | "docx" | "url" | "text"
    char_count: int


class DocumentExtractionError(Exception):
    """Raised when document extraction fails for any reason."""
    pass


async def extract_from_file(file_bytes: bytes, content_type: str | None, filename: str | None) -> ExtractionResult:
    """
    Extract text from an uploaded file (PDF or DOCX).

    Routes to the correct extractor based on content type and filename.
    Validates file size and type before extraction.

    Args:
        file_bytes: Raw bytes of the uploaded file.
        content_type: MIME type from the upload header.
        filename: Original filename.

    Returns:
        ExtractionResult with the extracted text and source type.

    Raises:
        DocumentExtractionError: If extraction fails.
    """
    import asyncio
    if not file_bytes:
        raise DocumentExtractionError("Uploaded file is empty.")

    # Security: validate file size
    try:
        validate_file_size(len(file_bytes))
    except Exception as e:
        raise DocumentExtractionError(str(e)) from e

    # Security: validate file type and magic bytes
    try:
        validate_file_content_type(content_type, filename, file_bytes)
    except UnsupportedFileTypeError as e:
        raise DocumentExtractionError(str(e)) from e

    # Determine extractor from content type or filename
    source_type = _detect_file_type(content_type, filename)

    if source_type == "pdf":
        from app.services.pdf_extractor import PDFExtractionError, extract_text_from_pdf
        try:
            raw_text = await asyncio.to_thread(extract_text_from_pdf, file_bytes)
        except PDFExtractionError as e:
            raise DocumentExtractionError(str(e)) from e

    elif source_type == "docx":
        from app.services.docx_extractor import DOCXExtractionError, extract_text_from_docx
        try:
            raw_text = await asyncio.to_thread(extract_text_from_docx, file_bytes)
        except DOCXExtractionError as e:
            raise DocumentExtractionError(str(e)) from e

    else:
        raise DocumentExtractionError(
            f"Cannot determine file type from content_type='{content_type}', "
            f"filename='{filename}'. Supported: PDF, DOCX."
        )

    return ExtractionResult(
        raw_text=raw_text,
        source_type=source_type,
        char_count=len(raw_text),
    )


async def extract_from_url(url: str) -> ExtractionResult:
    """
    Extract text from a portfolio URL.

    Fetches the URL with full SSRF protection and extracts
    readable text content.

    Args:
        url: Portfolio/resume URL.

    Returns:
        ExtractionResult with the extracted text.

    Raises:
        DocumentExtractionError: If fetching or extraction fails.
    """
    from app.services.url_fetcher import URLFetchError, fetch_and_extract_url
    from app.services.security import InvalidURLError, SSRFBlockedError

    try:
        raw_text = await fetch_and_extract_url(url)
    except (InvalidURLError, SSRFBlockedError) as e:
        # Re-wrap security errors with clear messaging
        raise DocumentExtractionError(str(e)) from e
    except URLFetchError as e:
        raise DocumentExtractionError(str(e)) from e

    return ExtractionResult(
        raw_text=raw_text,
        source_type="url",
        char_count=len(raw_text),
    )


def extract_from_text(raw_text: str) -> ExtractionResult:
    """
    Validate and wrap raw text input.

    Applies length bounds and minimum content checks.

    Args:
        raw_text: Raw resume/portfolio text.

    Returns:
        ExtractionResult with the validated text.

    Raises:
        DocumentExtractionError: If text fails validation.
    """
    try:
        validated = validate_text_input(raw_text)
    except (InsufficientContentError, Exception) as e:
        raise DocumentExtractionError(str(e)) from e

    return ExtractionResult(
        raw_text=validated,
        source_type="text",
        char_count=len(validated),
    )


def _detect_file_type(content_type: str | None, filename: str | None) -> str:
    """
    Determine whether an uploaded file is PDF or DOCX.

    Uses both content-type header and filename extension for reliability,
    since browsers sometimes send incorrect MIME types.

    Args:
        content_type: MIME type from upload header.
        filename: Original filename.

    Returns:
        "pdf" or "docx".
    """
    # Check content type first
    if content_type:
        if content_type == "application/pdf":
            return "pdf"
        if content_type in (
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "application/msword",
        ):
            return "docx"

    # Fall back to extension
    if filename:
        lower = filename.lower()
        if lower.endswith(".pdf"):
            return "pdf"
        if lower.endswith((".doc", ".docx")):
            return "docx"

    # Default to PDF for backward compatibility (original behavior)
    return "pdf"
