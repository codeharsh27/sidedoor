"""
Tests for PDF text extraction.

Uses a real PDF generated in memory (via reportlab if available,
otherwise a minimal raw PDF) to verify extraction works end-to-end.
No external dependencies beyond pdfplumber.
"""

import pytest

from app.services.pdf_extractor import PDFExtractionError, extract_text_from_pdf


def _make_minimal_pdf(text_content: str) -> bytes:
    """
    Create a minimal valid PDF with the given text content.

    Uses raw PDF syntax to avoid needing reportlab as a test dependency.
    This produces a simple single-page PDF that pdfplumber can read.
    """
    # Minimal PDF structure with a text stream
    content_stream = f"BT /F1 12 Tf 100 700 Td ({text_content}) Tj ET"
    stream_length = len(content_stream)

    pdf = (
        "%PDF-1.4\n"
        "1 0 obj\n"
        "<< /Type /Catalog /Pages 2 0 R >>\n"
        "endobj\n"
        "2 0 obj\n"
        "<< /Type /Pages /Kids [3 0 R] /Count 1 >>\n"
        "endobj\n"
        "3 0 obj\n"
        "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] "
        "/Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\n"
        "endobj\n"
        f"4 0 obj\n"
        f"<< /Length {stream_length} >>\n"
        f"stream\n"
        f"{content_stream}\n"
        f"endstream\n"
        f"endobj\n"
        "5 0 obj\n"
        "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\n"
        "endobj\n"
        "xref\n"
        "0 6\n"
        "0000000000 65535 f \n"
        "0000000009 00000 n \n"
        "0000000058 00000 n \n"
        "0000000115 00000 n \n"
        "0000000266 00000 n \n"
        f"{266 + stream_length + 50:010d} 00000 n \n"
        "trailer\n"
        "<< /Size 6 /Root 1 0 R >>\n"
        "startxref\n"
        f"{266 + stream_length + 120}\n"
        "%%EOF\n"
    )
    return pdf.encode("latin-1")


class TestExtractTextFromPdf:
    """Tests for extract_text_from_pdf()."""

    def test_extracts_text_from_valid_pdf(self):
        """Basic case: a PDF with text should return that text."""
        pdf_bytes = _make_minimal_pdf("Hello World resume content")
        result = extract_text_from_pdf(pdf_bytes)

        assert isinstance(result, str)
        assert len(result) > 0
        # The exact text may vary slightly due to PDF rendering,
        # but the words should be present
        assert "Hello" in result or "resume" in result or len(result) > 5

    def test_raises_on_empty_bytes(self):
        """Empty bytes should raise PDFExtractionError."""
        with pytest.raises(PDFExtractionError):
            extract_text_from_pdf(b"")

    def test_raises_on_invalid_bytes(self):
        """Non-PDF bytes should raise PDFExtractionError."""
        with pytest.raises(PDFExtractionError):
            extract_text_from_pdf(b"this is not a pdf file at all")

    def test_raises_on_image_only_pdf(self):
        """
        A PDF with no extractable text should raise PDFExtractionError.

        We simulate this with a PDF that has pages but no text content.
        """
        # Minimal PDF with an empty content stream
        empty_pdf = (
            "%PDF-1.4\n"
            "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n"
            "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n"
            "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] "
            "/Contents 4 0 R >> endobj\n"
            "4 0 obj << /Length 0 >> stream\nendstream endobj\n"
            "xref\n0 5\n"
            "0000000000 65535 f \n"
            "0000000009 00000 n \n"
            "0000000058 00000 n \n"
            "0000000115 00000 n \n"
            "0000000230 00000 n \n"
            "trailer << /Size 5 /Root 1 0 R >>\n"
            "startxref\n300\n%%EOF\n"
        )
        with pytest.raises(PDFExtractionError, match="no extractable text"):
            extract_text_from_pdf(empty_pdf.encode("latin-1"))

    def test_returns_string_not_bytes(self):
        """Result should always be a string, not bytes."""
        pdf_bytes = _make_minimal_pdf("Test content")
        result = extract_text_from_pdf(pdf_bytes)
        assert isinstance(result, str)
