"""
Tests for resume parsing.

All tests mock the LLM client — no real API calls.
Tests verify:
  - Structured output parsing from valid JSON
  - Graceful handling of malformed JSON
  - Empty input rejection
  - ProfileData validation (skills, domains, project_summary, notable_projects)
"""

import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services.resume_parser import (
    GeminiResumeParser,
    NotableProject,
    ProfileData,
    ResumeParseError,
)


# ---------- ProfileData model tests ----------


class TestProfileData:
    """Tests for the ProfileData Pydantic model."""

    def test_valid_profile_data(self):
        """A well-formed ProfileData should parse without errors."""
        data = ProfileData(
            skills=["Python", "React", "PostgreSQL"],
            domains=["backend web dev", "data pipelines"],
            project_summary="Final-year CS student with 2 internships focused on backend systems.",
            notable_projects=[
                NotableProject(
                    title="Real-time chat app",
                    description="WebSocket-based chat with Redis pub/sub for horizontal scaling.",
                    tech_used=["Node.js", "WebSocket", "Redis"],
                ),
                NotableProject(
                    title="Data pipeline toolkit",
                    description="ETL framework for processing CSV/JSON into PostgreSQL.",
                    tech_used=["Python", "Pandas", "PostgreSQL"],
                ),
            ],
        )
        assert len(data.skills) == 3
        assert len(data.notable_projects) == 2
        assert data.notable_projects[0].title == "Real-time chat app"

    def test_minimum_one_project_required(self):
        """notable_projects defaults to empty list if omitted."""
        data = ProfileData(
            skills=["Python"],
            domains=["backend"],
            project_summary="A developer.",
            notable_projects=[],
        )
        assert data.notable_projects == []

    def test_from_json_string(self):
        """ProfileData should parse from a JSON string (as LLM returns)."""
        json_str = json.dumps(
            {
                "skills": ["TypeScript", "React"],
                "domains": ["frontend"],
                "project_summary": "Junior frontend developer.",
                "notable_projects": [
                    {
                        "title": "Portfolio site",
                        "description": "Personal portfolio with blog.",
                        "tech_used": ["React", "Next.js"],
                    }
                ],
            }
        )
        parsed = ProfileData.model_validate_json(json_str)
        assert parsed.skills == ["TypeScript", "React"]
        assert len(parsed.notable_projects) == 1


# ---------- GeminiResumeParser tests (mocked LLM) ----------


SAMPLE_LLM_RESPONSE = json.dumps(
    {
        "skills": ["Python", "FastAPI", "PostgreSQL", "Docker"],
        "domains": ["backend web dev", "DevOps"],
        "project_summary": (
            "Mid-level backend engineer with 3 years of experience "
            "building REST APIs and data pipelines. Previously interned "
            "at two startups focused on fintech infrastructure."
        ),
        "notable_projects": [
            {
                "title": "Payment processing API",
                "description": "REST API for processing card payments with Stripe integration and webhook handling.",
                "tech_used": ["Python", "FastAPI", "Stripe", "PostgreSQL"],
            },
            {
                "title": "Log aggregation pipeline",
                "description": "Real-time log ingestion and search using Kafka and Elasticsearch.",
                "tech_used": ["Python", "Kafka", "Elasticsearch", "Docker"],
            },
        ],
    }
)


class TestGeminiResumeParser:
    """Tests for GeminiResumeParser with mocked Gemini client."""

    def _make_parser_with_mock(self, response_text: str) -> GeminiResumeParser:
        """Create a parser with a mocked Gemini client that returns the given text."""
        parser = object.__new__(GeminiResumeParser)

        # Mock the client and its response chain
        mock_response = MagicMock()
        mock_response.text = response_text

        mock_client = MagicMock()
        mock_client.models.generate_content.return_value = mock_response

        parser._client = mock_client
        parser._model_name = "gemini-2.0-flash"
        return parser

    @pytest.mark.asyncio
    async def test_parses_valid_response(self):
        """Parser should return ProfileData from a well-formed LLM response."""
        parser = self._make_parser_with_mock(SAMPLE_LLM_RESPONSE)
        result = await parser.parse_resume("John Doe, Python developer with 3 years...")

        assert isinstance(result, ProfileData)
        assert "Python" in result.skills
        assert len(result.notable_projects) == 2
        assert result.notable_projects[0].title == "Payment processing API"

    @pytest.mark.asyncio
    async def test_raises_on_empty_input(self):
        """Parser should reject empty resume text."""
        parser = self._make_parser_with_mock(SAMPLE_LLM_RESPONSE)
        with pytest.raises(ResumeParseError, match="empty"):
            await parser.parse_resume("")

    @pytest.mark.asyncio
    async def test_raises_on_whitespace_only_input(self):
        """Parser should reject whitespace-only resume text."""
        parser = self._make_parser_with_mock(SAMPLE_LLM_RESPONSE)
        with pytest.raises(ResumeParseError, match="empty"):
            await parser.parse_resume("   \n\t  ")

    @pytest.mark.asyncio
    async def test_raises_on_empty_llm_response(self):
        """Parser should raise when LLM returns empty text."""
        parser = self._make_parser_with_mock("")
        with pytest.raises(ResumeParseError):
            await parser.parse_resume("Some resume text")

    @pytest.mark.asyncio
    async def test_raises_on_none_llm_response(self):
        """Parser should raise when LLM returns None."""
        parser = self._make_parser_with_mock(None)
        with pytest.raises(ResumeParseError):
            await parser.parse_resume("Some resume text")

    @pytest.mark.asyncio
    async def test_raises_on_malformed_json(self):
        """Parser should raise when LLM returns invalid JSON."""
        parser = self._make_parser_with_mock("this is not json {{{")
        with pytest.raises(ResumeParseError):
            await parser.parse_resume("Some resume text")

    @pytest.mark.asyncio
    async def test_raises_on_incomplete_json(self):
        """Parser should raise when LLM returns invalid data types."""
        incomplete = json.dumps({"skills": 12345})  # Invalid type for skills
        parser = self._make_parser_with_mock(incomplete)
        with pytest.raises(ResumeParseError):
            await parser.parse_resume("Some resume text")

    @pytest.mark.asyncio
    async def test_truncates_long_input(self):
        """Parser should handle (truncate) very long resume text without crashing."""
        parser = self._make_parser_with_mock(SAMPLE_LLM_RESPONSE)
        long_text = "A" * 50000  # Way over the 15000 char cap
        result = await parser.parse_resume(long_text)

        # Should still work — the parser caps input at 15000 chars
        assert isinstance(result, ProfileData)

        # Verify the prompt was called with truncated text
        call_args = parser._client.models.generate_content.call_args
        prompt_text = call_args.kwargs.get("contents") or call_args.args[1]
        # The 50000-char string should NOT appear in full in the prompt
        assert "A" * 50000 not in str(prompt_text)
