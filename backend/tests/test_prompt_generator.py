"""
Tests for Stage 5 Prompt Generator.
"""

import uuid
from unittest.mock import AsyncMock, MagicMock

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Company, EvidenceItem, GapCluster, JobPosting, RoleMatch, UserProfile
from app.services.prompt_generator import (
    generate_handoff_prompt,
    get_matching_skill_and_domain,
    render_explanation,
)


def test_get_matching_skill_and_domain_exact_match():
    """Matches exact skill and domain when present in cluster text."""
    skills = ["Python", "JavaScript", "C++"]
    domains = ["backend development", "machine learning"]
    cluster_text = "Users complained that the backend development in python was slow and auth failed."
    cluster_label = "slow login auth"

    skill, domain = get_matching_skill_and_domain(skills, domains, cluster_text, cluster_label)
    assert skill == "Python"
    assert domain == "backend development"


def test_get_matching_skill_and_domain_case_insensitive_boundary():
    """Matches case-insensitively and respects word boundaries (e.g. not matching 'c' in 'cloud')."""
    skills = ["C", "Go", "FastAPI"]
    domains = ["web applications"]
    cluster_text = "The application runs on a cloud server using golang."
    cluster_label = "cloud services"

    # 'c' is in 'cloud', but word boundaries prevent matching it.
    # 'Go' matches 'golang' or does it? No, 'golang' does not have word boundaries matching 'go'.
    # Wait, let's see if we fall back.
    skill, domain = get_matching_skill_and_domain(skills, domains, cluster_text, cluster_label)
    assert skill == "C"  # Fallback since no boundary match found
    assert domain == "cloud services"  # Fallback to first two words of label


def test_get_matching_skill_and_domain_fallback_first():
    """Falls back to first skill/label words if no matches found."""
    skills = ["React", "CSS"]
    domains = ["frontend"]
    cluster_text = "Database connection times out on docker compose."
    cluster_label = "database timeout compose"

    skill, domain = get_matching_skill_and_domain(skills, domains, cluster_text, cluster_label)
    assert skill == "React"
    assert domain == "database timeout"


def test_render_explanation():
    """Formats correctly according to the template."""
    text = render_explanation("Python", "backend API design")
    assert text == "You listed Python — this gap involves backend API design."


@pytest.mark.asyncio
async def test_generate_handoff_prompt_happy_path():
    """Successfully retrieves DB objects and populates prompt markdown."""
    user_id = uuid.uuid4()
    company_id = uuid.uuid4()
    cluster_id = uuid.uuid4()

    # Mocks
    profile = MagicMock(spec=UserProfile)
    profile.user_id = user_id
    profile.parsed_skills = ["FastAPI", "PostgreSQL"]
    profile.parsed_domains = ["API design"]
    profile.parsed_project_summary = "Builds REST APIs."

    company_name = "Stripe"

    cluster = MagicMock(spec=GapCluster)
    cluster.id = cluster_id
    cluster.label = "slow authentication login"
    cluster.evidence_item_ids = [uuid.uuid4()]

    ev = MagicMock(spec=EvidenceItem)
    ev.source_type = "hacker_news"
    ev.source_url = "https://news.ycombinator.com/item?id=123"
    ev.raw_text = "The authentication page is incredibly slow."

    role = MagicMock(spec=RoleMatch)
    role.id = uuid.uuid4()
    role.gap_cluster_id = cluster_id
    role.job_posting_id = uuid.uuid4()

    job_title = "Senior Backend Engineer"

    # Mock DB Session execution side effects
    db = MagicMock(spec=AsyncSession)

    res_profile = MagicMock()
    res_profile.scalar_one_or_none.return_value = profile

    res_company = MagicMock()
    res_company.scalar_one_or_none.return_value = company_name

    res_cluster = MagicMock()
    res_cluster.scalar_one_or_none.return_value = cluster

    res_ev = MagicMock()
    res_ev.scalars.return_value.all.return_value = [ev]

    res_role = MagicMock()
    res_role.scalar_one_or_none.return_value = role

    res_job = MagicMock()
    res_job.scalar_one_or_none.return_value = job_title

    db.execute = AsyncMock(
        side_effect=[
            res_profile,
            res_company,
            res_cluster,
            res_ev,
            res_role,
            res_job,
        ]
    )

    prompt = await generate_handoff_prompt(company_id, cluster_id, user_id, db)
    assert "Target Company: Stripe" in prompt
    assert "Matching Role: Senior Backend Engineer" in prompt
    assert "Primary Matching Tech: FastAPI" in prompt
    assert "Topic: slow authentication login" in prompt
    assert "https://news.ycombinator.com/item?id=123" in prompt
