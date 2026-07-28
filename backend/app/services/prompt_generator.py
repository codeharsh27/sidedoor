"""
Stage 5 Prompt Generator Service — rule-based variable matching and template generation.

Provides:
  - Explanation card variables (top_matching_skill, gap_domain) based on profile/cluster overlap.
  - Explanation card rendering string.
  - Tailored prompt handoff formatting using a markdown template.

Fully deterministic, zero-LLM.
"""

import logging
import re
import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Company, EvidenceItem, GapCluster, JobPosting, RoleMatch, UserProfile

logger = logging.getLogger(__name__)

# Handoff prompt template
_MEMENTO_PROMPT_TEMPLATE = """You are an expert senior software engineer and build mentor. A developer is building a small MVP/scaffold to address a real problem identified at {company_name}.

Target Company: {company_name}
Matching Role: {role_title}

### The Problem/Gap:
- Topic: {cluster_label}
- Evidence from users/community:
{evidence_quotes}

### Developer Profile:
- Core Skills: {user_skills}
- Relevant Skill to target: {top_matching_skill}
- Ingested Resume/Portfolio Summary: {user_summary}

### Your Task:
Create a detailed 2-3 hour implementation roadmap and scaffolding plan for a small MVP that demonstrates a solution to this problem.

Follow these strict rules:
1. **Scaffold, don't finish**: Suggest folder layout, model schemas, and endpoint signatures, but do NOT write the core business logic. Use comments like "# TODO: implement auth logic using {top_matching_skill}" so the developer does the actual thinking.
2. **Match the environment**: Keep the tech stack focused on the developer's core skills ({top_matching_skill}).
3. **Verification**: Outline 3 concrete CLI commands or tests the developer can run to verify their build works.
"""


def get_matching_skill_and_domain(
    user_skills: list[str],
    user_domains: list[str],
    cluster_text: str,
    cluster_label: str,
) -> tuple[str, str]:
    """
    Deterministically find the matching skill and domain between a profile and a cluster.

    Args:
        user_skills: List of skills from UserProfile.
        user_domains: List of domains from UserProfile.
        cluster_text: Combined text of all evidence items in the cluster.
        cluster_label: The TF-IDF label of the cluster.

    Returns:
        tuple (top_matching_skill, gap_domain)
    """
    clean_text = cluster_text.lower()

    # 1. Find top matching skill using word-boundary regex
    top_skill = None
    for skill in user_skills:
        if not skill:
            continue
        # Use word boundaries to avoid matching "c" in "cloud" or "go" in "good"
        pattern = r"\b" + re.escape(skill.lower()) + r"\b"
        if re.search(pattern, clean_text):
            top_skill = skill
            break

    if not top_skill:
        # Fallback to first user skill or default
        top_skill = user_skills[0] if user_skills else "software engineering"

    # 2. Find matching domain
    matching_domain = None
    for domain in user_domains:
        if not domain:
            continue
        pattern = r"\b" + re.escape(domain.lower()) + r"\b"
        if re.search(pattern, clean_text):
            matching_domain = domain
            break

    if not matching_domain:
        # Fallback to first two words of cluster label, or a default
        label_words = cluster_label.split()
        if label_words:
            matching_domain = " ".join(label_words[:2])
        else:
            matching_domain = "software development"

    return top_skill, matching_domain


def render_explanation(top_matching_skill: str, gap_domain: str) -> str:
    """Generate the 'why this matches you' explanation string."""
    return f"You listed {top_matching_skill} — this gap involves {gap_domain}."


async def generate_handoff_prompt(
    company_id: uuid.UUID,
    cluster_id: uuid.UUID,
    user_id: uuid.UUID,
    db: AsyncSession,
) -> str:
    """
    Generate the complete handoff prompt markdown.

    Args:
        company_id: UUID of the company.
        cluster_id: UUID of the cluster.
        user_id: UUID of the user.
        db: Active async DB session.

    Returns:
        A formatted markdown string representing the build prompt.
    """
    # 1. Fetch User Profile
    stmt_profile = select(UserProfile).where(UserProfile.user_id == user_id)
    profile = (await db.execute(stmt_profile)).scalar_one_or_none()
    if not profile:
        raise ValueError(f"User profile for user {user_id} not found")

    # 2. Fetch Company Name
    stmt_company = select(Company.name).where(Company.id == company_id)
    company_name = (await db.execute(stmt_company)).scalar_one_or_none()
    if not company_name:
        raise ValueError(f"Company {company_id} not found")

    # 3. Fetch Cluster details
    stmt_cluster = select(GapCluster).where(GapCluster.id == cluster_id)
    cluster = (await db.execute(stmt_cluster)).scalar_one_or_none()
    if not cluster:
        raise ValueError(f"Gap cluster {cluster_id} not found")

    # 4. Fetch Evidence items to build aggregates & quotes
    evidence_text = ""
    evidence_quotes_list = []
    if cluster.evidence_item_ids:
        stmt_ev = select(EvidenceItem).where(EvidenceItem.id.in_(cluster.evidence_item_ids))
        items = (await db.execute(stmt_ev)).scalars().all()
        evidence_text = " ".join(item.raw_text for item in items)
        
        # Take up to 3 quotes for the prompt
        for item in items[:3]:
            source_type_label = item.source_type.replace("_", " ").title()
            quote_text = item.raw_text[:300] + ("..." if len(item.raw_text) > 300 else "")
            evidence_quotes_list.append(
                f'- Quote from {source_type_label} ({item.source_url}):\n  "{quote_text}"'
            )

    evidence_quotes = "\n".join(evidence_quotes_list) if evidence_quotes_list else "- No community quotes available."

    # 5. Fetch best role match (if any)
    stmt_role = select(RoleMatch).where(RoleMatch.gap_cluster_id == cluster.id).order_by(RoleMatch.match_score.desc()).limit(1)
    role_match = (await db.execute(stmt_role)).scalar_one_or_none()

    role_title = "General Engineering Target"
    if role_match:
        stmt_job = select(JobPosting.title).where(JobPosting.id == role_match.job_posting_id)
        job_title = (await db.execute(stmt_job)).scalar_one_or_none()
        if job_title:
            role_title = job_title

    # 6. Run overlap matching
    top_matching_skill, gap_domain = get_matching_skill_and_domain(
        profile.parsed_skills,
        profile.parsed_domains,
        evidence_text or cluster.label,
        cluster.label,
    )

    # 7. Render template
    prompt = _MEMENTO_PROMPT_TEMPLATE.format(
        company_name=company_name,
        role_title=role_title,
        cluster_label=cluster.label,
        evidence_quotes=evidence_quotes,
        user_skills=", ".join(profile.parsed_skills) if profile.parsed_skills else "software engineering",
        top_matching_skill=top_matching_skill,
        user_summary=profile.parsed_project_summary or "No summary available.",
        gap_domain=gap_domain,
    )

    return prompt
