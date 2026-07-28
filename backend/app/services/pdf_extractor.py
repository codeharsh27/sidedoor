"""
PDF text extraction — deterministic, no LLM.

Uses pdfplumber to pull plain text from uploaded resume PDFs.
This is a simple extraction step, not an intelligence step.
"""

import io
import logging

import pdfplumber

logger = logging.getLogger(__name__)


class PDFExtractionError(Exception):
    """Raised when PDF text extraction fails or yields no usable text."""

    pass


def extract_text_from_pdf(file_bytes: bytes) -> str:
    """
    Extract plain text from a PDF file.

    Args:
        file_bytes: Raw bytes of the PDF file.

    Returns:
        Concatenated text from all pages, whitespace-normalized.

    Raises:
        PDFExtractionError: If the PDF can't be read or yields no text.
    """
    try:
        with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
            pages_text: list[str] = []
            for page in pdf.pages:
                text = page.extract_text()
                if text:
                    pages_text.append(text.strip())

            if not pages_text:
                raise PDFExtractionError(
                    "PDF was read successfully but contained no extractable text. "
                    "The file may be image-only or scanned without OCR."
                )

            full_text = "\n\n".join(pages_text)
            logger.info(
                "Extracted %d characters from %d pages", len(full_text), len(pdf.pages)
            )
            return full_text

    except PDFExtractionError:
        raise
    except Exception as e:
        raise PDFExtractionError(f"Failed to extract text from PDF: {e}") from e
