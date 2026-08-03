"""
Tests for security validation helpers.

Covers:
  - Private IP detection (all RFC1918, loopback, link-local, CGNAT, IPv6)
  - URL validation (scheme check, SSRF blocking, port restrictions)
  - File size validation
  - File content type validation
  - Text input validation
"""

import pytest

from app.services.security import (
    FileTooLargeError,
    InsufficientContentError,
    InvalidURLError,
    MAX_FILE_SIZE_BYTES,
    MAX_TEXT_INPUT_CHARS,
    MIN_EXTRACTABLE_CHARS,
    SSRFBlockedError,
    TextTooLargeError,
    UnsupportedFileTypeError,
    is_private_ip,
    validate_file_content_type,
    validate_file_size,
    validate_text_input,
    validate_url,
)


class TestIsPrivateIP:
    """Tests for is_private_ip()."""

    @pytest.mark.parametrize(
        "ip",
        [
            "127.0.0.1",       # Loopback
            "127.0.0.2",       # Loopback range
            "10.0.0.1",        # Private class A
            "10.255.255.255",  # Private class A boundary
            "172.16.0.1",      # Private class B
            "172.31.255.255",  # Private class B boundary
            "192.168.0.1",     # Private class C
            "192.168.255.255", # Private class C boundary
            "169.254.1.1",     # Link-local
            "0.0.0.0",         # "This" network
            "100.64.0.1",      # CGNAT
            "::1",             # IPv6 loopback
        ],
    )
    def test_private_ips_detected(self, ip):
        """All private/internal IPs should be flagged."""
        assert is_private_ip(ip) is True

    @pytest.mark.parametrize(
        "ip",
        [
            "8.8.8.8",          # Google DNS
            "1.1.1.1",          # Cloudflare DNS
            "142.250.80.46",    # google.com
            "151.101.1.140",    # reddit.com
            "2607:f8b0:4004:800::200e",  # IPv6 Google
        ],
    )
    def test_public_ips_allowed(self, ip):
        """Public IPs should not be flagged."""
        assert is_private_ip(ip) is False

    def test_unparseable_ip_treated_as_private(self):
        """Unparseable IP strings should be treated as dangerous."""
        assert is_private_ip("not-an-ip") is True
        assert is_private_ip("") is True


class TestValidateUrl:
    """Tests for validate_url()."""

    def test_empty_url_rejected(self):
        with pytest.raises(InvalidURLError, match="empty"):
            validate_url("")

    def test_whitespace_url_rejected(self):
        with pytest.raises(InvalidURLError, match="empty"):
            validate_url("   ")

    def test_too_long_url_rejected(self):
        with pytest.raises(InvalidURLError, match="maximum length"):
            validate_url("https://example.com/" + "a" * 2048)

    @pytest.mark.parametrize(
        "url",
        [
            "ftp://example.com/file.txt",
            "file:///etc/passwd",
            "javascript:alert(1)",
            "data:text/html,<h1>hi</h1>",
            "gopher://example.com",
        ],
    )
    def test_forbidden_schemes_rejected(self, url):
        """Only http and https should be allowed."""
        with pytest.raises(InvalidURLError, match="scheme"):
            validate_url(url)

    def test_no_hostname_rejected(self):
        with pytest.raises(InvalidURLError):
            validate_url("https://")

    def test_unusual_port_rejected(self):
        """Non-standard ports should be blocked to prevent internal service probing."""
        with pytest.raises(InvalidURLError, match="port"):
            validate_url("https://example.com:6379/")  # Redis port

    @pytest.mark.parametrize("port", [80, 443, 8080, 8443])
    def test_standard_ports_allowed(self, port):
        """Standard web ports should pass validation."""
        # This will fail on DNS resolution since example.com resolves to
        # a real IP, but the port check specifically should pass.
        # We test the port logic in isolation by checking it doesn't raise InvalidURLError
        # with a "port" message
        try:
            validate_url(f"https://example.com:{port}/")
        except InvalidURLError as e:
            assert "port" not in str(e).lower()
        except SSRFBlockedError:
            pass  # DNS check — not what we're testing here

    def test_private_ip_url_blocked(self):
        """URLs pointing to private IPs should be SSRF-blocked."""
        with pytest.raises((SSRFBlockedError, InvalidURLError)):
            validate_url("http://127.0.0.1/admin")


class TestValidateFileSize:
    """Tests for validate_file_size()."""

    def test_small_file_passes(self):
        """Files under the limit should pass silently."""
        validate_file_size(1024)  # 1KB

    def test_exact_limit_passes(self):
        """File exactly at the limit should pass."""
        validate_file_size(MAX_FILE_SIZE_BYTES)

    def test_over_limit_raises(self):
        """Files over the limit should raise."""
        with pytest.raises(FileTooLargeError, match="too large"):
            validate_file_size(MAX_FILE_SIZE_BYTES + 1)


class TestValidateFileContentType:
    """Tests for validate_file_content_type()."""

    @pytest.mark.parametrize(
        "content_type",
        [
            "application/pdf",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "application/msword",
        ],
    )
    def test_allowed_content_types_pass(self, content_type):
        """All allowed content types should pass."""
        validate_file_content_type(content_type, "resume.pdf")

    def test_extension_fallback(self):
        """If content type is wrong but extension is right, it should pass."""
        validate_file_content_type("application/octet-stream", "resume.pdf")
        validate_file_content_type("application/octet-stream", "resume.docx")
        validate_file_content_type(None, "resume.doc")

    def test_unsupported_type_rejected(self):
        """Unsupported types should be rejected."""
        with pytest.raises(UnsupportedFileTypeError):
            validate_file_content_type("image/png", "image.png")

    def test_no_type_no_extension_rejected(self):
        """Missing both content type and extension should be rejected."""
        with pytest.raises(UnsupportedFileTypeError):
            validate_file_content_type(None, None)


class TestValidateTextInput:
    """Tests for validate_text_input()."""

    def test_empty_text_rejected(self):
        with pytest.raises(InsufficientContentError):
            validate_text_input("")

    def test_whitespace_only_rejected(self):
        with pytest.raises(InsufficientContentError):
            validate_text_input("   \n\t  ")

    def test_too_short_rejected(self):
        short_text = "x" * (MIN_EXTRACTABLE_CHARS - 1)
        with pytest.raises(InsufficientContentError, match="too short"):
            validate_text_input(short_text)

    def test_too_long_rejected(self):
        long_text = "x" * (MAX_TEXT_INPUT_CHARS + 1)
        with pytest.raises(TextTooLargeError, match="exceeds"):
            validate_text_input(long_text)

    def test_valid_text_passes(self):
        valid = "Python developer with experience in web services. " * 5
        result = validate_text_input(valid)
        assert result == valid.strip()

    def test_strips_whitespace(self):
        result = validate_text_input("  " + "x" * 100 + "  ")
        assert not result.startswith(" ")
        assert not result.endswith(" ")
