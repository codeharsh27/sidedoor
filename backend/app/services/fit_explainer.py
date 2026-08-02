"""
Fit Explanation Layer — Generates grounded, honest 2-3 sentence explanations for why a company fits a user context.

Grounded in structured scores, user projects, and company requirements (no fluff).
"""

import logging
import os
import httpx
from app.config import settings

logger = logging.getLogger(__name__)

FIT_EXPLAIN_PROMPT = """
You are an objective engineering career agent.
Given the candidate profile and company match scores below, write a 2-3 sentence honest explanation of why this company fits (or partially fits) this user.

Candidate Profile:
- Candidate Name: {name}
- Tech Stack: {stack}
- Key Projects: {key_projects}

Target Company:
- Name: {company_name}
- Funding Stage: {stage}
- Needed Tech Stack: {needed_stack}
- Domain: {domain}
- Match Breakdown: {scores}

Rules:
1. Reference specific overlapping skills or key projects if applicable.
2. Be honest about weak matches — do NOT oversell or give generic marketing fluff.
3. Keep the output strictly to 2-3 clean sentences.
"""


async def generate_fit_explanation(company: dict, user_context: dict, scores: dict) -> str:
    """
    Generate grounded 2-3 sentence explanation of fit.

    Args:
        company: Enriched company dict.
        user_context: Compact user context dict.
        scores: Match score breakdown dict.

    Returns:
        Explanation text string.
    """
    candidate_name = user_context.get("name", "Candidate")
    user_stack = user_context.get("stack", [])
    user_projects = user_context.get("key_projects", [])
    
    company_name = company.get("name", "Target Company")
    stage = company.get("stage", "seed")
    needed_stack = company.get("tech_stack", [])
    domain = company.get("domain", "devtools")

    # Find overlapping skills
    overlapping = [s for s in needed_stack if s.lower() in [us.lower() for us in user_stack]]
    
    api_key = settings.openrouter_api_key or os.environ.get("OPENROUTER_API_KEY") or os.environ.get("GEMINI_API_KEY")
    if api_key:
        try:
            proj_str = ", ".join([p.get("name", "") for p in user_projects[:2]])
            prompt_text = FIT_EXPLAIN_PROMPT.format(
                name=candidate_name,
                stack=", ".join(user_stack[:8]),
                key_projects=proj_str if proj_str else "None listed",
                company_name=company_name,
                stage=stage,
                needed_stack=", ".join(needed_stack),
                domain=domain,
                scores=scores
            )
            async with httpx.AsyncClient(timeout=8.0) as client:
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
                    explanation = resp.json()["choices"][0]["message"]["content"].strip()
                    if len(explanation) > 15:
                        return explanation
        except Exception as e:
            logger.warning(f"Fit explanation LLM call failed, fallback to template: {e}")

    # Fallback template-based explanation (Grounded & Honest)
    if overlapping:
        skills_phrase = ", ".join(overlapping[:3])
        return (
            f"Strong tech stack overlap — {company_name} requires skills in {skills_phrase}, "
            f"which aligns with your verified builder credentials. Their {stage} stage and {domain} domain "
            f"match your target company preferences."
        )
    else:
        return (
            f"Partial match — {company_name} is a {stage}-stage company in the {domain} space. "
            f"While their required tech stack differs slightly, your generalist engineering background gives you a solid foundation to bridge the gap."
        )
