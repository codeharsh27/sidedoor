"""
Resume parsing — THE ONE DELIBERATE LLM CALL in the entire system.

Extracts structured fields from raw resume text:
  - skills (flat list)
  - domains (flat list)
  - project_summary (includes seniority signal)
  - notable_projects (structured list of 2-4 projects)

Pluggable: ResumeParserProtocol defines the interface.
GeminiResumeParser is the concrete implementation.
Swapping to OpenAI/Anthropic = writing one new class.
"""

import json
import logging
from typing import Protocol, runtime_checkable

from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)


# ---------- Structured output models ----------


class NotableProject(BaseModel):
    """A notable project extracted from the resume."""

    title: str = Field(description="Short project name or title")
    description: str = Field(
        description="1-2 sentence description of what the project does"
    )
    tech_used: list[str] = Field(
        description="Technologies, frameworks, and tools used in this project"
    )


class ProfileData(BaseModel):
    """
    Structured output from resume parsing.

    This is the contract between the LLM call and the rest of the system.
    Everything downstream (embedding, profile storage, later matching)
    consumes this shape.
    """

    skills: list[str] = Field(
        description="Technical skills, programming languages, frameworks, tools"
    )
    domains: list[str] = Field(
        description="Professional domains and areas of experience "
        "(e.g. 'backend web dev', 'data pipelines', 'mobile apps')"
    )
    project_summary: str = Field(
        description="2-3 sentence career/project summary. "
        "Include seniority signal (e.g. 'final-year student with 2 internships' "
        "or '3 years of backend experience')."
    )
    notable_projects: list[NotableProject] = Field(
        description="2-4 most notable/impressive projects from the resume",
        min_length=1,
        max_length=6,
    )


# ---------- Parser protocol ----------

RESUME_PARSE_PROMPT = """\
You are a resume parser. Extract structured information from the following resume text.

RULES:
- Extract ONLY what is explicitly stated in the resume. Do not infer or generate.
- For skills: list every technical skill, programming language, framework, and tool mentioned.
- For domains: categorize the person's experience areas (e.g. "backend web dev", "data engineering", "mobile apps").
- For project_summary: write a 2-3 sentence summary of their career level and focus. Include seniority signals (years of experience, student/junior/mid/senior, number of internships, etc.).
- For notable_projects: pick the 2-4 most impressive or substantial projects. For each, extract the title, a 1-2 sentence description, and the technologies used.
- If the resume is thin (e.g. a student with one project), still extract what's there — don't pad or inflate.

Respond with valid JSON matching this exact schema:
{schema}

RESUME TEXT:
{resume_text}
"""


@runtime_checkable
class ResumeParserProtocol(Protocol):
    """Interface for resume parsers. Swap LLM providers by implementing this."""

    async def parse_resume(self, raw_text: str) -> ProfileData: ...


class ResumeParseError(Exception):
    """Raised when the LLM fails to parse a resume into structured data."""

    pass


class GeminiResumeParser:
    """
    Resume parser using Google Gemini.

    This is the ONE LLM API call in the entire SideDoor system.
    It runs once per user at signup, not per request.
    """

    def __init__(self, api_key: str, model_name: str = "gemini-2.0-flash"):
        # Lazy import so the module can be loaded without google-genai installed
        # (useful for tests with mocked parsers).
        from google import genai

        self._client = genai.Client(api_key=api_key)
        self._model_name = model_name

    async def parse_resume(self, raw_text: str) -> ProfileData:
        """
        Send raw resume text to Gemini, get back structured ProfileData.

        Args:
            raw_text: Plain text extracted from the user's resume/portfolio.

        Returns:
            Parsed ProfileData with skills, domains, project_summary, notable_projects.

        Raises:
            ResumeParseError: If the LLM call fails or returns unparseable output.
        """
        if not raw_text or not raw_text.strip():
            raise ResumeParseError("Cannot parse an empty resume.")

        schema_json = json.dumps(ProfileData.model_json_schema(), indent=2)
        prompt = RESUME_PARSE_PROMPT.format(
            schema=schema_json,
            resume_text=raw_text[:15000],  # Cap input to avoid excessive token usage
        )

        try:
            response = self._client.models.generate_content(
                model=self._model_name,
                contents=prompt,
                config={
                    "response_mime_type": "application/json",
                    "response_schema": ProfileData,
                    "temperature": 0.1,  # Low temp for extraction, not generation
                },
            )

            # Parse the structured response
            result_text = response.text
            if not result_text:
                raise ResumeParseError("Gemini returned an empty response.")

            parsed = ProfileData.model_validate_json(result_text)

            logger.info(
                "Parsed resume: %d skills, %d domains, %d projects",
                len(parsed.skills),
                len(parsed.domains),
                len(parsed.notable_projects),
            )
            return parsed

        except ResumeParseError:
            raise
        except Exception as e:
            raise ResumeParseError(
                f"Failed to parse resume via Gemini: {e}"
            ) from e
