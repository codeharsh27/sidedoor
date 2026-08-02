"""
Step 6: Artifact / MVP Suggestion Generator (`generate_artifact_brief`)
Generates 1-2 concrete, scoped build options (1-3 day scope, leveraged skills, honest skill gap notes).
"""

import json
import logging
import os
import httpx
from app.config import settings

logger = logging.getLogger(__name__)

BRIEF_PROMPT = """
Target Company: {company_name}
Pain Point: {pain_point}
Evidence: {evidence}
Candidate Stack: {stack}
Candidate Projects: {projects}

Suggest TWO distinct, buildable MVP options (not full products) that demonstrate real value against this pain point.
Option 1: Primary high-impact MVP / visual dashboard console.
Option 2: Lightweight diagnostic tool or browser extension.

Each option must include:
- title: Short descriptive name
- what_it_does: What it builds in 1-2 sentences
- why_creates_value: Why the company CTO will feel 'this candidate deeply understands our problem and created real value'
- scope_days: Build scope (e.g. "1-2 days" or "2-3 days")
- skills_leveraged: Candidate skills used

Return JSON format:
{{
  "option_1": {{
    "title": "Visual Telemetry Inspector & Debug Console",
    "what_it_does": "Build a real-time web dashboard that streams request logs and flags anomaly spikes visually.",
    "why_creates_value": "Solves their manual stdout log watching friction and demonstrates immediate production-grade developer tool utility.",
    "scope_days": "1-2 days",
    "skills_leveraged": "React, TypeScript, Webhooks"
  }},
  "option_2": {{
    "title": "Automated Webhook & Request Proxy Middleware",
    "what_it_does": "Build a lightweight CLI or Chrome extension that intercepts API payloads and inspects status codes in real time.",
    "why_creates_value": "Saves their engineering team hours during local integration testing and shows high technical initiative.",
    "scope_days": "2-3 days",
    "skills_leveraged": "FastAPI, Python, Async HTTP"
  }}
}}
"""


async def generate_artifact_brief(company_name: str, match: dict, user_context: dict) -> dict:
    """
    Generates 2 tailored MVP build options for a company.
    """
    api_key = settings.openrouter_api_key or os.environ.get("OPENROUTER_API_KEY") or os.environ.get("GEMINI_API_KEY")

    if api_key:
        try:
            proj_names = ", ".join([p.get("name", "") for p in user_context.get("key_projects", [])[:2]])
            prompt_text = BRIEF_PROMPT.format(
                company_name=company_name,
                pain_point=match.get("pain_point", ""),
                evidence=match.get("evidence_text", ""),
                stack=", ".join(user_context.get("stack", [])[:6]),
                projects=proj_names if proj_names else "Developer Dashboard"
            )

            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(
                    "https://openrouter.ai/api/v1/chat/completions",
                    headers={
                        "Authorization": f"Bearer {api_key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": getattr(settings, "openrouter_model", "google/gemini-2.0-flash-001"),
                        "messages": [{"role": "user", "content": prompt_text}],
                        "temperature": 0.3,
                    },
                )
                if resp.status_code == 200:
                    content = resp.json()["choices"][0]["message"]["content"]
                    if "```json" in content:
                        content = content.split("```json")[1].split("```")[0].strip()
                    elif "```" in content:
                        content = content.split("```")[1].split("```")[0].strip()
                    parsed = json.loads(content)
                    if isinstance(parsed, dict) and "option_1" in parsed:
                        return parsed
        except Exception as e:
            logger.warning(f"LLM MVP options generation failed, using structured template fallback: {e}")

    # Fallback 2 options
    stack_str = ", ".join(user_context.get("stack", [])[:3])
    return {
        "option_1": {
            "title": f"Visual Telemetry Inspector & Debug Console for {company_name}",
            "what_it_does": f"Build a real-time web console that aggregates request event streams and flags payload anomalies visually.",
            "why_creates_value": f"Eliminates manual terminal log watching for {company_name}'s dev team, showing you deeply understand their workflow.",
            "scope_days": "1-2 days",
            "skills_leveraged": f"{stack_str}"
        },
        "option_2": {
            "title": f"Automated Webhook & Request Proxy Middleware for {company_name}",
            "what_it_does": f"Build a lightweight proxy tool that captures API payloads and validates schema structures automatically.",
            "why_creates_value": f"Saves engineering hours during integration testing and demonstrates proactive technical problem-solving.",
            "scope_days": "2-3 days",
            "skills_leveraged": f"{stack_str}"
        }
    }
