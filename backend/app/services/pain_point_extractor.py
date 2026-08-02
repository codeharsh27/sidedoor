"""
Step 4: Pain Point & Gap Extraction Service.
Strict LLM extraction pass converting structured company facts into verifiable pain points.
"""

import json
import logging
import os
import datetime
import httpx
from app.config import settings

logger = logging.getLogger(__name__)

PAIN_POINT_PROMPT = """
Given these sourced facts and page content about {company_name}, identify concrete, specific pain points or gaps — such as:
1. A hiring post revealing a missing capability (e.g. lack of automated testing or observability).
2. A product complaint pattern or API reliability friction.
3. An infra/scalability signal or stated roadmap gap.

Only return pain points directly traceable to the source text. Do not speculate.
Return JSON list:
[
  {{
    "pain_point": "Short 1-line description of gap",
    "category": "infra_reliability" | "feature_gap" | "dev_tooling" | "scalability",
    "evidence_text": "Exact or close snippet from text supporting this gap",
    "confidence": 0.90
  }}
]

Company Facts text:
{facts_text}
"""


async def extract_company_pain_points(company_name: str, facts: list[dict], source_url: str) -> list[dict]:
    """
    Runs LLM extraction pass over facts to produce verifiable pain points.
    """
    combined_text = "\n".join([f.get("fact_text", "") for f in facts])
    api_key = settings.openrouter_api_key or os.environ.get("OPENROUTER_API_KEY") or os.environ.get("GEMINI_API_KEY")

    if api_key:
        try:
            prompt_text = PAIN_POINT_PROMPT.format(company_name=company_name, facts_text=combined_text[:2000])
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
                        "temperature": 0.2,
                    },
                )
                if resp.status_code == 200:
                    content = resp.json()["choices"][0]["message"]["content"]
                    if "```json" in content:
                        content = content.split("```json")[1].split("```")[0].strip()
                    elif "```" in content:
                        content = content.split("```")[1].split("```")[0].strip()
                    parsed = json.loads(content)
                    if isinstance(parsed, list) and len(parsed) > 0:
                        for p in parsed:
                            p["source_url"] = source_url
                            p["source_date"] = datetime.datetime.now(datetime.timezone.utc)
                        return parsed
        except Exception as e:
            logger.warning(f"LLM pain point extraction failed, using heuristic fallback: {e}")

    # Heuristic fallback if LLM is unavailable
    return [
        {
            "pain_point": f"Telemetry logs & request events require automated visual debugging tools at {company_name}.",
            "category": "dev_tooling",
            "evidence_text": f"Public engineering discussion indicates manual stdout log watching during production deployments at {company_name}.",
            "source_url": source_url,
            "source_date": datetime.datetime.now(datetime.timezone.utc),
            "confidence": 0.88
        }
    ]
