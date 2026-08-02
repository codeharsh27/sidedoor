"""
Step 5: Matching Engine — pain_point x user_skill
Scores relevance between user context and extracted company pain points.
"""

import logging

logger = logging.getLogger(__name__)


def match_pain_point_to_user(pain_point: dict, user_context: dict) -> dict:
    """
    Evaluates relevance score, reasoning, and suggested artifact type for a pain point.

    Args:
        pain_point: Extracted pain point dictionary.
        user_context: User profile context dictionary.

    Returns:
        Match result dictionary with relevance_score, reasoning, and suggested_artifact_type.
    """
    user_stack = [s.lower() for s in user_context.get("stack", [])]
    pp_text = pain_point.get("pain_point", "").lower()
    evidence = pain_point.get("evidence_text", "").lower()

    # Calculate stack overlap
    matches = 0
    for tech in ["python", "react", "typescript", "fastapi", "postgresql", "node", "go", "rust"]:
        if tech in user_stack and (tech in pp_text or tech in evidence):
            matches += 1

    base_score = 0.75 + min(0.20, matches * 0.08)
    artifact_type = "small diagnostic tool"

    if "log" in pp_text or "telemetry" in pp_text or "observability" in pp_text:
        artifact_type = "visual debugging dashboard"
    elif "test" in pp_text or "qa" in pp_text:
        artifact_type = "automated test runner extension"
    elif "api" in pp_text or "proxy" in pp_text:
        artifact_type = "lightweight API middleware / proxy tool"

    return {
        "pain_point": pain_point.get("pain_point"),
        "evidence_text": pain_point.get("evidence_text"),
        "source_url": pain_point.get("source_url"),
        "relevance_score": round(base_score, 2),
        "reasoning": f"Matches your profile skills ({', '.join(user_context.get('stack', [])[:4])}) and project experience.",
        "suggested_artifact_type": artifact_type
    }
