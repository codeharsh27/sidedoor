"""
Query Generator Layer — Converts compact user context into targeted search queries.

Generates 5-8 search queries using structured templates and an LLM call
to adapt to unique candidate profiles.
"""

import json
import logging
import os
import httpx
from app.config import settings

logger = logging.getLogger(__name__)

QUERY_GEN_PROMPT = """
You are an expert technical talent scout and company search engine optimizer.
Given the candidate context below, generate 5 diverse, highly-targeted search queries to find real early-stage tech companies, YC startups, or VC-funded startups currently hiring for roles that match this candidate.

Candidate Context:
- Target Roles: {target_roles}
- Tech Stack: {stack}
- Target Company Stages: {stages}
- Target Industries: {industries}
- Location Preferences: {locations}

Guidelines:
- Include site-specific queries for ycombinator.com, wellfound.com, techcrunch.com, or Github.
- Include queries targeting tech stack needs (e.g. "TypeScript Python seed startup hiring").
- Output ONLY valid JSON in format: ["query 1", "query 2", "query 3", "query 4", "query 5"]
"""


async def generate_search_queries(context: dict) -> list[str]:
    """
    Generates 5-8 search queries tailored to user context.

    Args:
        context: Compact user context dictionary from build_user_context.

    Returns:
        List of unique search query strings.
    """
    target_roles = context.get("role_target", ["Product Engineer"])
    stack = context.get("stack", ["TypeScript", "React", "Python"])
    filters = context.get("company_filters", {})
    stages = filters.get("stage", ["seed", "series-a"])
    if isinstance(stages, str):
        stages = [stages]
    industries = filters.get("industry", ["ai-native", "devtools"])
    if isinstance(industries, str):
        industries = [industries]
    locations = filters.get("location", "remote")
    if isinstance(locations, list):
        locations = ", ".join(locations)

    # 1. Base rule-based queries
    base_queries: list[str] = []
    for role in target_roles[:2]:
        for stage in stages[:2]:
            base_queries.append(f"{stage} startups hiring {role} {locations}".strip())
    
    first_role = target_roles[0] if target_roles else "Product Engineer"
    base_queries.append(f"site:ycombinator.com/companies jobs {first_role}")
    base_queries.append(f"site:wellfound.com {first_role} {locations}")

    # 2. LLM-driven query generation (OpenRouter / Gemini)
    llm_queries: list[str] = []
    api_key = settings.openrouter_api_key or os.environ.get("OPENROUTER_API_KEY") or os.environ.get("GEMINI_API_KEY")

    if api_key:
        prompt_text = QUERY_GEN_PROMPT.format(
            target_roles=", ".join(target_roles),
            stack=", ".join(stack[:8]),
            stages=", ".join(stages),
            industries=", ".join(industries),
            locations=locations,
        )

        try:
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
                        "temperature": 0.4,
                    },
                )
                if resp.status_code == 200:
                    content = resp.json()["choices"][0]["message"]["content"]
                    # Clean JSON
                    if "```json" in content:
                        content = content.split("```json")[1].split("```")[0].strip()
                    elif "```" in content:
                        content = content.split("```")[1].split("```")[0].strip()
                    parsed = json.loads(content)
                    if isinstance(parsed, list):
                        llm_queries = [str(q).strip() for q in parsed if q]
        except Exception as e:
            logger.warning(f"LLM query generation failed, relying on rule-based queries: {e}")

    # Merge & deduplicate queries while preserving order
    all_queries = base_queries + llm_queries
    seen = set()
    final_queries = []
    for q in all_queries:
        normalized = q.lower().strip()
        if normalized not in seen and len(normalized) > 5:
            seen.add(normalized)
            final_queries.append(q)

    return final_queries[:8]
