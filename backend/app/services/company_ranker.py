"""
Scoring & Ranking Layer — Calculates multi-factor match scores & role authenticity.

Formula:
final_score = stack_match * 0.30 + stage_match * 0.25 + domain_match * 0.20 + role_clarity * 0.25
"""

import json
import logging
import os
import httpx
from app.config import settings

logger = logging.getLogger(__name__)

ROLE_CLASSIFY_PROMPT = """
You are a senior technical hiring auditor.
Classify whether the following Job Description (JD) is for a genuine Product/PM role, a pure IC Engineering role, or a Hybrid Builder role.

JD Title: {title}
JD Text: {jd_text}

Output JSON format ONLY:
{{
  "classification": "genuine_product" | "ic_engineering" | "hybrid_builder",
  "confidence": 0.85,
  "reason": "Short 1-sentence rationale."
}}
"""


def jaccard_similarity(list_a: list[str], list_b: list[str]) -> float:
    """Compute Jaccard similarity coefficient between two tech stack lists."""
    set_a = {s.lower() for s in list_a}
    set_b = {s.lower() for s in list_b}
    if not set_a or not set_b:
        return 0.2
    intersection = set_a.intersection(set_b)
    union = set_a.union(set_b)
    return round(len(intersection) / len(union), 3)


async def classify_role_authenticity(jd_title: str, jd_text: str) -> tuple[str, float]:
    """
    Classify whether a job posting is a genuine product role vs IC engineering role.

    Returns:
        (classification_str, confidence_float)
    """
    api_key = settings.openrouter_api_key or os.environ.get("OPENROUTER_API_KEY") or os.environ.get("GEMINI_API_KEY")
    if api_key:
        try:
            prompt_text = ROLE_CLASSIFY_PROMPT.format(title=jd_title, jd_text=jd_text[:1200])
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
                    cls_name = parsed.get("classification", "hybrid_builder")
                    conf = float(parsed.get("confidence", 0.85))
                    return (cls_name, conf)
        except Exception as e:
            logger.warning(f"Role classification LLM call failed, using rule heuristic: {e}")

    # Heuristic Fallback Rule
    title_lower = jd_title.lower()
    if "product engineer" in title_lower or "full stack" in title_lower or "founding" in title_lower:
        return ("hybrid_builder", 0.90)
    elif "manager" in title_lower or "pm" in title_lower:
        return ("genuine_product", 0.85)
    return ("ic_engineering", 0.80)


async def score_company(
    company: dict,
    user_context: dict,
    jd_title: str = "",
    jd_text: str = ""
) -> tuple[float, dict]:
    """
    Calculate multi-factor match score for a company against user context.

    Returns:
        (final_score, breakdown_dict)
    """
    user_stack = user_context.get("stack", [])
    company_stack = company.get("tech_stack", [])
    
    # 1. Tech Stack Match (Jaccard similarity)
    stack_score = jaccard_similarity(company_stack, user_stack)
    if stack_score == 0:
        stack_score = 0.25  # baseline partial overlap bonus

    # 2. Stage Match
    user_stages = user_context.get("company_filters", {}).get("stage", ["seed", "series-a"])
    if isinstance(user_stages, str):
        user_stages = [user_stages]
    user_stages_normalized = [s.lower().replace("-", "_") for s in user_stages]
    company_stage_norm = company.get("stage", "seed").lower().replace("-", "_")

    stage_score = 1.0 if company_stage_norm in user_stages_normalized or "seed" in user_stages_normalized else 0.4

    # 3. Domain Match
    user_industries = user_context.get("company_filters", {}).get("industry", ["ai-native", "devtools"])
    if isinstance(user_industries, str):
        user_industries = [user_industries]
    user_ind_norm = [i.lower() for i in user_industries]
    company_domain_norm = company.get("domain", "devtools").lower()

    domain_score = 1.0 if company_domain_norm in user_ind_norm or "devtools" in user_ind_norm else 0.5

    # 4. Role Clarity Classification Score
    cls_name, conf = await classify_role_authenticity(jd_title, jd_text)
    role_clarity_score = 0.90 if cls_name in ["hybrid_builder", "genuine_product"] else 0.60

    # Composite weighted final score
    final_score = round(
        (stack_score * 0.30) +
        (stage_score * 0.25) +
        (domain_score * 0.20) +
        (role_clarity_score * 0.25),
        2
    )

    breakdown = {
        "stack_match": stack_score,
        "stage_match": stage_score,
        "domain_match": domain_score,
        "role_clarity": role_clarity_score,
        "role_classification": cls_name,
        "role_confidence": conf
    }

    return (final_score, breakdown)
