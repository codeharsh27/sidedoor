"""
OpenRouter-based resume parser with exact JSON schema enforcement and 1-retry logic.
"""

import json
import logging
from pydantic import BaseModel, ValidationError

import httpx
from app.services.resume_parser import ProfileData, NotableProject, ResumeParseError

logger = logging.getLogger(__name__)

class ExtractionProject(BaseModel):
    name: str
    description: str
    domain: str

class ProfileExtractionModel(BaseModel):
    """The exact Pydantic model corresponding to the forced JSON schema."""
    skills: list[str]
    tools: list[str]
    projects: list[ExtractionProject]
    seniority_signal: str
    domains: list[str]


SCHEMA_JSON = {
  "type": "object",
  "required": ["skills", "tools", "projects", "seniority_signal", "domains"],
  "properties": {
    "skills": { "type": "array", "items": { "type": "string" } },
    "tools": { "type": "array", "items": { "type": "string" } },
    "projects": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["name", "description", "domain"],
        "properties": {
          "name": { "type": "string" },
          "description": { "type": "string" },
          "domain": { "type": "string" }
        },
        "additionalProperties": False
      }
    },
    "seniority_signal": { "type": "string" },
    "domains": { "type": "array", "items": { "type": "string" } }
  },
  "additionalProperties": False
}


class OpenRouterResumeParser:
    """
    Resume parser using OpenRouter.
    """

    def __init__(self, api_key: str, model_name: str = "openai/gpt-4o-mini"):
        if not api_key:
            raise ValueError("OPENROUTER_API_KEY is required")
        self._api_key = api_key
        self._model_name = model_name

    async def parse_resume(self, raw_text: str) -> ProfileData:
        """
        Send raw resume text to OpenRouter, enforce schema, map to ProfileData.
        Has 1 retry logic if validation fails.
        """
        if not raw_text or not raw_text.strip():
            raise ResumeParseError("Cannot parse an empty resume.")

        # Prepare initial messages
        system_prompt = "You are a resume parser. Extract structured information exactly as requested, focusing only on the provided text. Never infer or invent."
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"Extract the profile data from this resume text:\n\n{raw_text[:15000]}"}
        ]

        attempt = 1
        max_attempts = 2

        async with httpx.AsyncClient() as client:
            while attempt <= max_attempts:
                try:
                    response = await client.post(
                        "https://openrouter.ai/api/v1/chat/completions",
                        headers={
                            "Authorization": f"Bearer {self._api_key}",
                            "Content-Type": "application/json",
                            "HTTP-Referer": "http://localhost:8000",
                            "X-Title": "SideDoor",
                        },
                        json={
                            "model": self._model_name,
                            "messages": messages,
                            "temperature": 0.0,
                            "response_format": {
                                "type": "json_schema",
                                "json_schema": {
                                    "name": "profile_extraction",
                                    "strict": True,
                                    "schema": SCHEMA_JSON
                                }
                            }
                        },
                        timeout=60.0
                    )
                    
                    if response.status_code != 200:
                        raise ResumeParseError(f"OpenRouter API error: {response.status_code} - {response.text}")

                    data = response.json()
                    content = data["choices"][0]["message"]["content"]
                    
                    if not content:
                        raise ResumeParseError("OpenRouter returned empty content.")

                    # Stage 4: Validation (pure code)
                    # This will raise ValidationError if schema doesn't match
                    extracted = ProfileExtractionModel.model_validate_json(content)

                    # Map ExtractionModel to ProfileData
                    mapped_projects = []
                    for proj in extracted.projects:
                        mapped_projects.append(NotableProject(
                            title=proj.name,
                            description=proj.description,
                            tech_used=[proj.domain] # Domain maps loosely to tech_used for now
                        ))

                    mapped_profile = ProfileData(
                        skills=extracted.skills + extracted.tools,
                        domains=extracted.domains,
                        project_summary=extracted.seniority_signal,
                        notable_projects=mapped_projects if mapped_projects else [NotableProject(title="None", description="No projects found", tech_used=[])]
                    )
                    
                    logger.info("Successfully extracted profile via OpenRouter.")
                    return mapped_profile

                except ValidationError as ve:
                    if attempt >= max_attempts:
                        logger.error("Validation failed twice. Stopping.")
                        raise ResumeParseError("PARSE_FAILED") from ve
                    
                    # Retry logic: Append validation error and try again
                    logger.warning(f"Validation failed on attempt {attempt}. Retrying with error feedback.")
                    if 'content' in locals():
                        messages.append({"role": "assistant", "content": content})
                    messages.append({
                        "role": "user",
                        "content": f"Your previous response was missing required fields or structurally invalid. Fix and return valid JSON only. Error details:\n{str(ve)}"
                    })
                    attempt += 1

                except Exception as e:
                    if "PARSE_FAILED" in str(e):
                        raise
                    if attempt >= max_attempts:
                        raise ResumeParseError(f"Failed to parse resume after {max_attempts} attempts: {e}") from e
                    attempt += 1
            
            raise ResumeParseError("PARSE_FAILED")
