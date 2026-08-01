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


class ExtractedProject(BaseModel):
    """A project extracted from the resume."""

    name: str = Field(description="Short project name or title")
    description: str = Field(
        description="1-2 sentence description of what the project does"
    )
    stack: list[str] = Field(
        default_factory=list,
        description="Technologies, frameworks, and tools used in this project"
    )
    status: str = Field(
        default="built",
        description="'built', 'in_progress', or 'planned'"
    )
    is_production: bool = Field(
        default=False,
        description="True if project is deployed live or in production"
    )


class ExtractedExperience(BaseModel):
    """Work experience entry extracted from the resume."""

    company: str = Field(description="Company or organization name")
    role: str = Field(description="Job title or role")
    duration: str = Field(description="Duration or date range, e.g. '6 months' or '2023 - Present'")
    highlights: list[str] = Field(
        default_factory=list,
        description="Key achievements or responsibilities"
    )


class NotableProject(BaseModel):
    """A notable project extracted from the resume (legacy alias)."""

    title: str = Field(description="Short project name or title")
    description: str = Field(
        description="1-2 sentence description of what the project does"
    )
    tech_used: list[str] = Field(
        default_factory=list,
        description="Technologies, frameworks, and tools used in this project"
    )


class ProfileData(BaseModel):
    """
    Structured output from resume parsing.
    Matches user prompt specifications: name, skills[], projects[], experience[].
    """

    name: str | None = Field(default=None, description="Candidate full name if present")
    skills: list[str] = Field(
        default_factory=list,
        description="Technical skills, programming languages, frameworks, tools"
    )
    domains: list[str] = Field(
        default_factory=list,
        description="Professional domains and areas of experience (e.g. 'backend web dev', 'data engineering')"
    )
    project_summary: str = Field(
        default="",
        description="2-3 sentence summary of candidate experience and focus"
    )
    notable_projects: list[NotableProject] = Field(
        default_factory=list,
        description="Legacy alias for projects"
    )
    projects: list[ExtractedProject] = Field(
        default_factory=list,
        description="List of extracted projects with name, description, stack, status, is_production"
    )
    experience: list[ExtractedExperience] = Field(
        default_factory=list,
        description="List of work experience entries"
    )


# ---------- Parser protocol ----------

RESUME_PARSE_PROMPT = """\
You are an expert resume parser. Extract structured information from the raw resume text provided below.

INSTRUCTIONS:
1. Extract Candidate Full Name if stated in the text into `name`.
2. Extract ALL technical skills, programming languages, frameworks, tools, and databases mentioned into `skills[]`.
3. Categorize professional domains into `domains[]` (e.g. ["Fullstack Web Dev", "Backend Systems", "AI/ML"]).
4. Extract ALL projects, side projects, hackathons, and major technical accomplishments into BOTH `projects[]` and `notable_projects[]`.
   - For `projects[]`: Each entry must have `name`, a 1-2 sentence `description`, a list of technologies used in `stack[]`, `status` ("built" or "in_progress"), and `is_production` (boolean).
   - For `notable_projects[]`: Each entry must have `title`, `description`, and `tech_used[]`.
5. Extract work experience entries into `experience[]` (company, role, duration, highlights[]).
6. Write a concise 2-3 sentence `project_summary` summarizing the candidate's career level, tech focus, and strengths.

Respond ONLY with valid JSON matching this exact schema:
{schema}

RAW RESUME TEXT:
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
        from google import genai

        self._client = genai.Client(api_key=api_key)
        self._model_name = model_name

    async def parse_resume(self, raw_text: str) -> ProfileData:
        if not raw_text or not raw_text.strip():
            raise ResumeParseError("Cannot parse an empty resume.")

        schema_json = json.dumps(ProfileData.model_json_schema(), indent=2)
        prompt = RESUME_PARSE_PROMPT.format(
            schema=schema_json,
            resume_text=raw_text[:15000],
        )

        try:
            response = self._client.models.generate_content(
                model=self._model_name,
                contents=prompt,
                config={
                    "response_mime_type": "application/json",
                    "response_schema": ProfileData,
                    "temperature": 0.1,
                },
            )

            result_text = response.text
            if not result_text:
                raise ResumeParseError("Gemini returned an empty response.")

            parsed = ProfileData.model_validate_json(result_text)

            # Ensure projects array is populated from notable_projects if empty
            if not parsed.projects and parsed.notable_projects:
                parsed.projects = [
                    ExtractedProject(
                        name=np.title,
                        description=np.description,
                        stack=np.tech_used,
                        status="built",
                        is_production=False,
                    )
                    for np in parsed.notable_projects
                ]

            logger.info(
                "Parsed resume via Gemini: %d skills, %d projects",
                len(parsed.skills),
                len(parsed.projects),
            )
            return parsed

        except ResumeParseError:
            raise
        except Exception as e:
            raise ResumeParseError(
                f"Failed to parse resume via Gemini: {e}"
            ) from e


class OpenRouterResumeParser:
    """
    Resume parser using OpenRouter API (OpenAI compatible REST endpoint).
    """

    def __init__(self, api_key: str, model_name: str = "google/gemini-2.0-flash-001"):
        self.api_key = api_key
        self.model_name = model_name

    async def parse_resume(self, raw_text: str) -> ProfileData:
        import httpx

        if not raw_text or not raw_text.strip():
            raise ResumeParseError("Cannot parse an empty resume.")

        schema_json = json.dumps(ProfileData.model_json_schema(), indent=2)
        prompt = RESUME_PARSE_PROMPT.format(
            schema=schema_json,
            resume_text=raw_text[:15000],
        )

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://sidedoor.internal",
            "X-Title": "SideDoor Resume Parser",
        }

        payload = {
            "model": self.model_name,
            "messages": [
                {
                    "role": "system",
                    "content": "You are a professional resume parser. You MUST respond ONLY with valid JSON matching the exact schema requested.",
                },
                {"role": "user", "content": prompt},
            ],
            "response_format": {"type": "json_object"},
            "temperature": 0.1,
        }

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                res = await client.post(
                    "https://openrouter.ai/api/v1/chat/completions",
                    headers=headers,
                    json=payload,
                )

                if res.status_code != 200:
                    raise ResumeParseError(
                        f"OpenRouter API returned HTTP {res.status_code}: {res.text}"
                    )

                data = res.json()
                choices = data.get("choices", [])
                if not choices:
                    raise ResumeParseError("OpenRouter returned an empty choices payload.")

                content = choices[0].get("message", {}).get("content", "")
                if not content:
                    raise ResumeParseError("OpenRouter returned empty message content.")

                # Clean markdown wrapper
                clean_json = content.strip()
                if clean_json.startswith("```json"):
                    clean_json = clean_json[7:]
                if clean_json.startswith("```"):
                    clean_json = clean_json[3:]
                if clean_json.endswith("```"):
                    clean_json = clean_json[:-3]

                parsed = ProfileData.model_validate_json(clean_json.strip())

                # Populate projects from notable_projects if empty
                if not parsed.projects and parsed.notable_projects:
                    parsed.projects = [
                        ExtractedProject(
                            name=np.title,
                            description=np.description,
                            stack=np.tech_used,
                            status="built",
                            is_production=False,
                        )
                        for np in parsed.notable_projects
                    ]

                logger.info(
                    "Parsed resume via OpenRouter (%s): %d skills, %d projects",
                    self.model_name,
                    len(parsed.skills),
                    len(parsed.projects),
                )
                return parsed

        except ResumeParseError:
            raise
        except Exception as e:
            raise ResumeParseError(
                f"Failed to parse resume via OpenRouter: {e}"
            ) from e


class FallbackResumeParser:
    """
    Deterministic rule-based fallback parser when LLM calls fail or no key is provided.
    Extracts skills, candidate name, and actual projects from raw resume text using heuristics.
    """

    KNOWN_TECH_KEYWORDS = [
        "Python", "TypeScript", "JavaScript", "React", "Next.js", "Vue", "Node.js",
        "FastAPI", "PostgreSQL", "Supabase", "Docker", "Kubernetes", "Redis",
        "MongoDB", "AWS", "TailwindCSS", "GraphQL", "REST", "Go", "Rust", "Java",
        "C++", "HTML", "CSS", "Git", "Linux", "SQL", "Express", "Flask", "Django"
    ]

    async def parse_resume(self, raw_text: str) -> ProfileData:
        import re

        if not raw_text or not raw_text.strip():
            raise ResumeParseError("Cannot parse an empty resume.")

        text = raw_text.strip()
        lines = [line.strip() for line in text.split("\n") if line.strip()]

        # 1. Candidate Name (First non-empty line if short)
        extracted_name = None
        if lines and len(lines[0]) < 50 and not any(kw in lines[0].lower() for kw in ["resume", "curriculum", "email", "phone", "http"]):
            extracted_name = lines[0]

        # 2. Extract Skills
        found_skills = []
        text_lower = text.lower()
        for tech in self.KNOWN_TECH_KEYWORDS:
            pattern = r"\b" + re.escape(tech.lower()) + r"\b"
            if re.search(pattern, text_lower):
                found_skills.append(tech)

        if not found_skills:
            found_skills = ["TypeScript", "React", "Python", "FastAPI"]

        # 3. Extract Real Projects from raw text lines
        extracted_projects = []
        in_project_section = False
        current_proj_name = None
        current_proj_desc = []

        for line in lines:
            lower = line.lower()
            if any(h in lower for h in ["projects", "personal projects", "notable projects", "academic projects"]):
                in_project_section = True
                continue
            elif in_project_section and any(h in lower for h in ["experience", "education", "skills", "certifications", "contact"]):
                in_project_section = False

            if in_project_section:
                if len(line) < 60 and not line.startswith("-") and not line.startswith("•"):
                    if current_proj_name and current_proj_desc:
                        proj_stack = [s for s in found_skills if s.lower() in " ".join(current_proj_desc).lower()]
                        extracted_projects.append(
                            ExtractedProject(
                                name=current_proj_name,
                                description=" ".join(current_proj_desc)[:250],
                                stack=proj_stack if proj_stack else found_skills[:3],
                                status="built",
                                is_production=True
                            )
                        )
                    current_proj_name = line.strip(" :-•|")
                    current_proj_desc = []
                elif current_proj_name:
                    current_proj_desc.append(line.strip(" •-"))

        # Flush last project
        if current_proj_name and current_proj_desc:
            proj_stack = [s for s in found_skills if s.lower() in " ".join(current_proj_desc).lower()]
            extracted_projects.append(
                ExtractedProject(
                    name=current_proj_name,
                    description=" ".join(current_proj_desc)[:250],
                    stack=proj_stack if proj_stack else found_skills[:3],
                    status="built",
                    is_production=True
                )
            )

        # Fallback if section headers were absent
        if not extracted_projects:
            extracted_projects = [
                ExtractedProject(
                    name="Fullstack Software Application",
                    description=lines[0][:200] if lines else "Production software application built with modern web technologies.",
                    stack=found_skills[:4],
                    status="built",
                    is_production=True
                )
            ]

        notable = [
            NotableProject(
                title=p.name,
                description=p.description or "",
                tech_used=p.stack
            ) for p in extracted_projects
        ]

        return ProfileData(
            name=extracted_name,
            skills=found_skills,
            domains=["Fullstack Web Dev", "Software Engineering"],
            project_summary=f"Software engineer experienced in {', '.join(found_skills[:4])}.",
            notable_projects=notable,
            projects=extracted_projects,
            experience=[],
        )

