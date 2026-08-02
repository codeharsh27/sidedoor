"""
Unit tests for the personalized company scouting, search, enrichment, and ranking pipeline.
"""

import pytest
import uuid
from app.services.context_builder import build_user_context
from app.services.query_generator import generate_search_queries
from app.services.company_searcher import search_companies, get_cached_page, set_cached_page
from app.services.company_enricher import enrich_company, extract_stack_from_jd, infer_stage, classify_domain
from app.services.company_ranker import jaccard_similarity, classify_role_authenticity, score_company
from app.services.fit_explainer import generate_fit_explanation


@pytest.mark.asyncio
async def test_jaccard_similarity():
    stack_a = ["TypeScript", "React", "Python", "FastAPI"]
    stack_b = ["Python", "FastAPI", "PostgreSQL"]
    sim = jaccard_similarity(stack_a, stack_b)
    # Intersection: Python, FastAPI (2). Union: TypeScript, React, Python, FastAPI, PostgreSQL (5). 2/5 = 0.4
    assert sim == 0.4


@pytest.mark.asyncio
async def test_extract_stack_from_jd():
    jd = "We are seeking a Full Stack Engineer proficient in TypeScript, React, Python, and PostgreSQL."
    extracted = extract_stack_from_jd(jd)
    assert "TypeScript" in extracted
    assert "React" in extracted
    assert "Python" in extracted
    assert "PostgreSQL" in extracted


@pytest.mark.asyncio
async def test_query_generator():
    ctx = {
        "role_target": ["Product Engineer"],
        "stack": ["TypeScript", "React", "Python"],
        "company_filters": {
            "stage": ["seed", "yc-backed"],
            "industry": ["ai-native"],
            "location": "remote"
        }
    }
    queries = await generate_search_queries(ctx)
    assert len(queries) >= 3
    assert any("ycombinator" in q for q in queries)


@pytest.mark.asyncio
async def test_company_searcher_and_caching():
    set_cached_page("https://example.com/test", "<html>Cached Content</html>")
    cached = get_cached_page("https://example.com/test")
    assert cached == "<html>Cached Content</html>"

    queries = ["site:ycombinator.com/companies jobs Product Engineer"]
    cands = await search_companies(queries)
    assert len(cands) > 0
    assert "name" in cands[0]
    assert "website" in cands[0]


@pytest.mark.asyncio
async def test_company_enricher():
    enriched = enrich_company(
        company_name="Oximy",
        website_url="https://oximy.com",
        jd_text="Oximy is an AI search startup using Python, React, and Anthropic API. Seed stage YC W24.",
        jd_url="https://ycombinator.com/companies/oximy/jobs/10293"
    )
    assert enriched["name"] == "Oximy"
    assert enriched["stage"] == "seed"
    assert "Python" in enriched["tech_stack"]
    assert enriched["domain"] == "ai-native"


@pytest.mark.asyncio
async def test_company_ranker():
    ctx = {
        "stack": ["TypeScript", "React", "Python"],
        "company_filters": {
            "stage": ["seed"],
            "industry": ["ai-native"]
        }
    }
    comp = {
        "name": "Oximy",
        "stage": "seed",
        "domain": "ai-native",
        "tech_stack": ["TypeScript", "Python", "React"]
    }
    final_score, breakdown = await score_company(
        company=comp,
        user_context=ctx,
        jd_title="AI Product Engineer",
        jd_text="Building AI features with Python, React, TypeScript."
    )
    assert final_score >= 0.75
    assert "stack_match" in breakdown
    assert "role_clarity" in breakdown


@pytest.mark.asyncio
async def test_fit_explainer():
    ctx = {
        "name": "Arjun",
        "stack": ["TypeScript", "React", "Python"],
        "key_projects": [{"name": "HuntAI", "stack": ["Python", "Anthropic"]}]
    }
    comp = {
        "name": "Oximy",
        "stage": "seed",
        "domain": "ai-native",
        "tech_stack": ["TypeScript", "Python"]
    }
    scores = {"stack_match": 0.5, "stage_match": 1.0}
    explanation = await generate_fit_explanation(comp, ctx, scores)
    assert len(explanation) > 20
    assert "Oximy" in explanation
