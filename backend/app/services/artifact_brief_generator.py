"""
Step 6: Artifact / MVP Suggestion Generator (`generate_artifact_brief`)
Generates concrete, scoped build briefs (1-2 sentence description, 1-3 day scope, leveraged skills, honest skill gap notes).
"""

import json
import logging
import os
import httpx
from app.config import settings

logger = logging.getLogger(__name__)

BRIEF_PROMPT = """
Pain point: {pain_point}
Evidence: {evidence}
Candidate Stack: {stack}
Candidate Projects: {projects}

Suggest ONE small, buildable artifact (not a full product) that demonstrates value against this specific pain point.
Include:
- what it does in 1-2 sentences
- rough scope (buildable in 1-3 days by a solo developer)
- which of the user's existing skills/projects it leverages
- honest note on any gap between user's current skills and what's needed

Return JSON object:
{{
  "opportunity": "What it does in 1-2 sentences",
  "gap": "Concise summary of the company gap",
  "solve": "Rough scope (1-3 day build plan)",
  "perfect": "Which existing skills it leverages",
  "honest_skill_gap": "Honest note on skill gap or learning requirement"
}}
"""


async def generate_artifact_brief(match: dict, user_context: dict) -> dict:
    """
    Generates a structured, scoped build brief for a matched opportunity.
    """
    api_key = settings.openrouter_api_key or os.environ.get("OPENROUTER_API_KEY") or os.environ.get("GEMINI_API_KEY")

    if api_key:
        try:
            proj_names = ", ".join([p.get("name", "") for p in user_context.get("key_projects", [])[:2]])
            prompt_text = BRIEF_PROMPT.format(
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
                    if isinstance(parsed, dict) and "opportunity" in parsed:
                        return parsed
        except Exception as e:
            logger.warning(f"LLM artifact brief generation failed, using structured template fallback: {e}")

    # Structured template fallback
    stack_str = ", ".join(user_context.get("stack", [])[:3])
    return {
        "opportunity": f"Build a lightweight open-source micro-app or Chrome extension solving: '{match.get('pain_point')}'",
        "gap": match.get("evidence_text", "Operational friction identified in public developer channels."),
        "solve": "Scaffold a Next.js / FastAPI sandbox in 1-2 days, deploy live on Vercel/Railway, and record a 2-minute Loom walkthrough.",
        "perfect": f"Perfect fit for your {stack_str} background and builder experience.",
        "honest_skill_gap": "No major skill gaps — you possess all necessary core stack building blocks."
    }
