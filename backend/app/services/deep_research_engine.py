"""
SideDoor Deep Research Engine — 5-Module Dossier Builder.

Replaces the hardcoded if/elif template system in company.py with
real intelligence derived from live data sources and focused LLM calls.

Module map:
  1. identity       — What the company actually does, tech stack, business model
  2. competitors    — Competitor battle matrix and churn signals
  3. complaints     — Real market complaints with verifiable receipts
  4. stealth_gap    — Competitor gap analysis for early-stage / low-signal companies
  5. alignment      — Candidate skill-to-gap matching
"""

import asyncio
import json
import logging
import re
from datetime import datetime, timezone, timedelta
from typing import Any

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# LLM Helper — single focused call, returns parsed JSON or None on failure
# ---------------------------------------------------------------------------

async def _llm_call(system_prompt: str, user_prompt: str, max_tokens: int = 1500) -> dict | None:
    """
    Make a single LLM call using the configured provider.
    Returns parsed JSON dict, or None if the call fails or returns invalid JSON.
    We use strict JSON-only prompts so parsing is reliable.
    """
    if settings.gemini_api_key:
        try:
            import google.generativeai as genai
            genai.configure(api_key=settings.gemini_api_key)
            model = genai.GenerativeModel("gemini-1.5-flash")
            response = await asyncio.to_thread(
                model.generate_content,
                f"{system_prompt}\n\n{user_prompt}",
                generation_config=genai.types.GenerationConfig(
                    temperature=0.1,
                    max_output_tokens=max_tokens,
                ),
            )
            raw = response.text.strip()
            # Strip markdown code fences if present
            if raw.startswith("```"):
                raw = re.sub(r"^```(?:json)?\s*", "", raw)
                raw = re.sub(r"\s*```$", "", raw)
            return json.loads(raw)
        except Exception as e:
            logger.warning("Gemini LLM call failed: %s", e)
            return None

    if settings.openrouter_api_key:
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.post(
                    "https://openrouter.ai/api/v1/chat/completions",
                    headers={"Authorization": f"Bearer {settings.openrouter_api_key}"},
                    json={
                        "model": "anthropic/claude-3-haiku",
                        "messages": [
                            {"role": "system", "content": system_prompt},
                            {"role": "user", "content": user_prompt},
                        ],
                        "max_tokens": max_tokens,
                        "temperature": 0.1,
                    },
                )
                raw = resp.json()["choices"][0]["message"]["content"].strip()
                if raw.startswith("```"):
                    raw = re.sub(r"^```(?:json)?\s*", "", raw)
                    raw = re.sub(r"\s*```$", "", raw)
                return json.loads(raw)
        except Exception as e:
            logger.warning("OpenRouter LLM call failed: %s", e)
            return None

    return None


# ---------------------------------------------------------------------------
# Tavily helper — run a single search query
# ---------------------------------------------------------------------------

async def _tavily_search(query: str, days: int = 365, max_results: int = 5) -> list[dict]:
    """Run one Tavily search, return list of {title, url, content, published_date}."""
    if not settings.tavily_api_key:
        return []
    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.post(
                "https://api.tavily.com/search",
                json={
                    "api_key": settings.tavily_api_key,
                    "query": query,
                    "max_results": max_results,
                    "days": days,
                    "search_depth": "advanced",
                    "include_raw_content": True,
                },
            )
            if resp.status_code != 200:
                logger.warning("Tavily returned %d for query: %s", resp.status_code, query)
                return []
            data = resp.json()
            results = []
            for r in data.get("results", []):
                content = r.get("raw_content") or r.get("content") or ""
                if len(content.strip()) < 30:
                    continue
                results.append({
                    "title": r.get("title", ""),
                    "url": r.get("url", ""),
                    "content": content[:3000],  # cap at 3000 chars per result
                    "published_date": r.get("published_date"),
                })
            return results
    except Exception as e:
        logger.warning("Tavily search error (%s): %s", query, e)
        return []


# ---------------------------------------------------------------------------
# GitHub helpers
# ---------------------------------------------------------------------------

async def _fetch_github_readme(owner: str, repo: str) -> str | None:
    """Fetch raw README text from a GitHub repository."""
    headers = {
        "Accept": "application/vnd.github.v3.raw",
        "User-Agent": "SideDoorResearchBot/2.0",
    }
    if settings.github_token:
        headers["Authorization"] = f"token {settings.github_token}"

    url = f"https://api.github.com/repos/{owner}/{repo}/readme"
    try:
        async with httpx.AsyncClient(timeout=10.0, headers=headers) as client:
            resp = await client.get(url)
            if resp.status_code == 200:
                text = resp.text
                # Return first 2000 chars — enough to understand the product
                return text[:2000]
    except Exception as e:
        logger.warning("GitHub README fetch failed for %s/%s: %s", owner, repo, e)
    return None


async def _fetch_github_languages(owner: str, repo: str) -> list[str]:
    """Fetch the language breakdown for a GitHub repo."""
    headers = {
        "Accept": "application/vnd.github.v3+json",
        "User-Agent": "SideDoorResearchBot/2.0",
    }
    if settings.github_token:
        headers["Authorization"] = f"token {settings.github_token}"

    url = f"https://api.github.com/repos/{owner}/{repo}/languages"
    try:
        async with httpx.AsyncClient(timeout=10.0, headers=headers) as client:
            resp = await client.get(url)
            if resp.status_code == 200:
                langs = resp.json()
                # Return top 5 by byte count
                sorted_langs = sorted(langs.items(), key=lambda x: x[1], reverse=True)
                return [lang for lang, _ in sorted_langs[:5]]
    except Exception as e:
        logger.warning("GitHub languages fetch failed for %s/%s: %s", owner, repo, e)
    return []


async def _fetch_github_top_issues(owner: str, repo: str, n: int = 8) -> list[dict]:
    """Fetch top open issues sorted by reactions+comments."""
    headers = {
        "Accept": "application/vnd.github.v3+json",
        "User-Agent": "SideDoorResearchBot/2.0",
    }
    if settings.github_token:
        headers["Authorization"] = f"token {settings.github_token}"

    url = f"https://api.github.com/repos/{owner}/{repo}/issues"
    params = {"state": "open", "sort": "comments", "per_page": n}
    try:
        async with httpx.AsyncClient(timeout=10.0, headers=headers) as client:
            resp = await client.get(url, params=params)
            if resp.status_code == 200:
                issues = []
                for issue in resp.json():
                    if "pull_request" in issue:
                        continue
                    issues.append({
                        "title": issue.get("title", ""),
                        "body": (issue.get("body") or "")[:500],
                        "url": issue.get("html_url", ""),
                        "comments": issue.get("comments", 0),
                        "reactions": issue.get("reactions", {}).get("total_count", 0),
                        "created_at": issue.get("created_at", ""),
                    })
                return issues
    except Exception as e:
        logger.warning("GitHub issues fetch failed for %s/%s: %s", owner, repo, e)
    return []


def _parse_github_repo(url: str) -> tuple[str, str] | None:
    """Parse owner/repo from a GitHub URL."""
    if not url:
        return None
    match = re.search(r"github\.com[:/]([a-zA-Z0-9\-_.]+)/([a-zA-Z0-9\-_.]+)", url)
    if match:
        owner = match.group(1)
        repo = match.group(2).replace(".git", "")
        return owner, repo
    return None


# ===========================================================================
# MODULE 1: Company Identity
# ===========================================================================

async def research_company_identity(
    company_name: str,
    company_url: str,
    github_repo_url: str | None = None,
) -> dict:
    """
    Module 1: Determine what the company actually does, its tech stack,
    target customer, and business model — from real sources.

    Sources:
    - GitHub README (if repo known)
    - GitHub language stats
    - Tavily web search (homepage content + product descriptions)
    """
    raw_sources: list[str] = []
    raw_text_chunks: list[str] = []

    # --- Source A: GitHub README ---
    github_languages: list[str] = []
    if github_repo_url:
        parsed = _parse_github_repo(github_repo_url)
        if parsed:
            owner, repo = parsed
            readme_text, langs = await asyncio.gather(
                _fetch_github_readme(owner, repo),
                _fetch_github_languages(owner, repo),
            )
            if readme_text:
                raw_text_chunks.append(f"[GitHub README for {company_name}]\n{readme_text}")
                raw_sources.append(f"https://github.com/{owner}/{repo}")
            if langs:
                github_languages = langs

    # --- Source B: Tavily search for product description ---
    search_results = await _tavily_search(
        f'"{company_name}" what is product OR platform OR API -linkedin -crunchbase -pitchbook',
        days=365,
        max_results=3,
    )
    for r in search_results:
        raw_text_chunks.append(f"[Web: {r['title']}]\n{r['content'][:800]}")
        raw_sources.append(r["url"])

    if not raw_text_chunks:
        # Hard fallback — at least use company name context honestly
        return {
            "company_name": company_name,
            "plain_english_description": f"Insufficient public data found for {company_name}. Try scanning the company first to collect evidence.",
            "target_customer": "Unknown",
            "tech_stack": github_languages or [],
            "business_model": "Unknown",
            "sources_used": raw_sources,
            "data_confidence": "low",
        }

    # --- LLM: Extract structured identity ---
    combined_input = "\n\n".join(raw_text_chunks[:4])  # max 4 chunks to avoid token bloat

    system_prompt = (
        "You are a technical analyst extracting factual product intelligence. "
        "Return ONLY a valid JSON object with no extra commentary. Be precise and specific — "
        "never use vague language like 'technology company building digital products'. "
        "If unsure, say exactly what you know from the text."
    )
    user_prompt = f"""
Based ONLY on the following raw text about {company_name}, extract:

<evidence>
{combined_input}
</evidence>

Return a JSON object with these exact keys:
{{
  "plain_english_description": "2-3 sentences describing what the product actually does for its users, in plain English. Be specific — name the domain (billing, observability, CRM, etc.).",
  "target_customer": "Who buys this — e.g. 'B2B SaaS companies', 'Developer teams', 'Enterprise finance teams'",
  "tech_stack": ["list", "of", "real", "languages", "frameworks", "databases", "mentioned"],
  "business_model": "e.g. 'Open-source + managed cloud hosting', 'Usage-based SaaS subscription', 'Marketplace'",
  "key_features": ["top 3-4 core product features mentioned"]
}}

Rules:
- If a field cannot be determined from the text, use "Unknown" for strings or [] for arrays.
- tech_stack must only list things explicitly mentioned in the text.
- Do not invent or assume information not present in the evidence.
"""

    result = await _llm_call(system_prompt, user_prompt, max_tokens=600)

    if result and isinstance(result, dict):
        # Merge GitHub languages if LLM missed them
        existing_stack = result.get("tech_stack", [])
        for lang in github_languages:
            if lang not in existing_stack:
                existing_stack.append(lang)
        result["tech_stack"] = existing_stack
        result["company_name"] = company_name
        result["sources_used"] = raw_sources[:5]
        result["data_confidence"] = "high" if len(raw_text_chunks) >= 2 else "medium"
        return result

    # LLM failed — return best-effort from raw data
    return {
        "company_name": company_name,
        "plain_english_description": raw_text_chunks[0][:300] if raw_text_chunks else "No description found.",
        "target_customer": "Unknown",
        "tech_stack": github_languages,
        "business_model": "Unknown",
        "key_features": [],
        "sources_used": raw_sources,
        "data_confidence": "low",
    }


# ===========================================================================
# MODULE 2: Competitor Matrix
# ===========================================================================

async def research_competitor_matrix(
    company_name: str,
    product_category: str,
    company_key_features: list[str],
) -> dict:
    """
    Module 2: Find real competitors and surface a feature comparison matrix.

    Sources:
    - Tavily search for "alternative to X" and "X vs Y" discussions
    - Tavily search for churn signals ("switched from X", "moved away from X")
    """

    # --- Search: competitor mentions ---
    results_alt, results_switch = await asyncio.gather(
        _tavily_search(
            f'"{company_name}" alternative OR competitor OR "vs" site:reddit.com OR site:news.ycombinator.com',
            days=730, max_results=5,
        ),
        _tavily_search(
            f'"switched from {company_name}" OR "moved away from {company_name}" OR "why I left {company_name}"',
            days=730, max_results=4,
        ),
    )

    all_results = results_alt + results_switch
    raw_sources = list({r["url"] for r in all_results})

    if not all_results:
        return {
            "competitors_found": [],
            "matrix": [],
            "churn_signals": [],
            "sources_used": [],
            "data_confidence": "low",
            "note": "No competitor discussion found in public forums. This company may be very early-stage.",
        }

    combined_input = "\n\n".join(
        f"[{r['title']}] ({r['url']})\n{r['content'][:600]}" for r in all_results[:6]
    )

    system_prompt = (
        "You are a competitive intelligence analyst. "
        "Extract factual competitor information from the provided text. "
        "Return ONLY a valid JSON object. Do not invent competitors not mentioned in the text."
    )
    user_prompt = f"""
Company under analysis: {company_name}
Product category: {product_category}
Key features: {', '.join(company_key_features) if company_key_features else 'unknown'}

<evidence>
{combined_input}
</evidence>

Return a JSON object with these exact keys:
{{
  "competitors_found": ["list of competitor product names mentioned in the text"],
  "matrix": [
    {{
      "dimension": "a feature or capability dimension (e.g. 'Real-time credit burn widget', 'Open-source self-hosting')",
      "target_status": "one of: available | missing | partial | unknown",
      "target_note": "brief note on why (e.g. 'GitHub issue #1420 reports drop-outs' or 'explicitly mentioned in README')",
      "competitors_have_it": ["competitor names that clearly have this feature"]
    }}
  ],
  "churn_signals": [
    {{
      "quote": "exact quote from a user about why they left or switched",
      "source_url": "URL where this was found"
    }}
  ]
}}

Rules:
- matrix must have 3-5 rows covering the most impactful feature gaps.
- Only include churn_signals with actual quoted text. No paraphrasing — exact words.
- If no competitors are found, return empty arrays.
"""

    result = await _llm_call(system_prompt, user_prompt, max_tokens=900)

    if result and isinstance(result, dict):
        result["sources_used"] = raw_sources[:6]
        result["data_confidence"] = "high" if len(all_results) >= 4 else "medium"
        return result

    return {
        "competitors_found": [],
        "matrix": [],
        "churn_signals": [],
        "sources_used": raw_sources,
        "data_confidence": "low",
        "note": "Could not extract structured competitor data from search results.",
    }


# ===========================================================================
# MODULE 3: Market Complaints
# ===========================================================================

async def research_market_complaints(
    company_name: str,
    company_url: str,
    github_repo_url: str | None = None,
    existing_evidence: list[dict] | None = None,
) -> dict:
    """
    Module 3: Surface real market complaints with verifiable receipts.

    Sources:
    - Reddit threads
    - Hacker News discussions
    - GitHub issues (most reacted)
    - G2/Trustpilot reviews (via Tavily)
    - Existing evidence already in DB
    """
    raw_complaints: list[dict] = []

    # --- Source A: Existing DB evidence (already collected) ---
    if existing_evidence:
        for ev in existing_evidence[:10]:
            raw_complaints.append({
                "source": ev.get("source_type", "unknown"),
                "url": ev.get("source_url", ""),
                "text": ev.get("raw_text", "")[:600],
                "date": str(ev.get("posted_at", "")),
            })

    # --- Source B: Fresh Tavily searches ---
    reddit_results, hn_results, review_results = await asyncio.gather(
        _tavily_search(
            f'site:reddit.com "{company_name}" frustrated OR broken OR "doesn\'t work" OR "wish it had" OR bug',
            days=365, max_results=4,
        ),
        _tavily_search(
            f'site:news.ycombinator.com "{company_name}"',
            days=730, max_results=3,
        ),
        _tavily_search(
            f'"{company_name}" review site:g2.com OR site:trustpilot.com OR site:capterra.com',
            days=365, max_results=3,
        ),
    )

    for r in reddit_results + hn_results + review_results:
        raw_complaints.append({
            "source": "web_search",
            "url": r["url"],
            "text": r["content"][:600],
            "date": r.get("published_date", ""),
        })

    # --- Source C: GitHub Issues ---
    github_issues: list[dict] = []
    if github_repo_url:
        parsed = _parse_github_repo(github_repo_url)
        if parsed:
            owner, repo = parsed
            github_issues = await _fetch_github_top_issues(owner, repo, n=8)
            for issue in github_issues:
                raw_complaints.append({
                    "source": "github_issue",
                    "url": issue["url"],
                    "text": f"{issue['title']}\n{issue['body']}",
                    "date": issue["created_at"],
                    "engagement": issue["comments"] + issue["reactions"],
                })

    if not raw_complaints:
        return {
            "complaints": [],
            "total_signals_found": 0,
            "sources_used": [],
            "data_confidence": "none",
            "note": f"No public complaints or friction reports found for {company_name}. This is common for stealth or very new companies — see Module 4 for competitor gap analysis.",
        }

    # Sort by engagement (GitHub issues) then recency
    raw_complaints.sort(key=lambda x: x.get("engagement", 0), reverse=True)

    combined_input = "\n\n".join(
        f"[{c['source']}] ({c['url']})\nDate: {c['date']}\n{c['text']}"
        for c in raw_complaints[:10]
    )
    raw_sources = list({c["url"] for c in raw_complaints if c.get("url")})

    system_prompt = (
        "You are a product intelligence analyst identifying real user pain points. "
        "Extract actual complaints with exact quoted text — never paraphrase or invent. "
        "Return ONLY a valid JSON object."
    )
    user_prompt = f"""
Company: {company_name}

<evidence>
{combined_input}
</evidence>

Extract the 5 most significant user complaints from the above evidence. For each:
- Quote the user's exact words (not a summary)
- Identify the category of problem
- Note how many people seem affected

Return a JSON object:
{{
  "complaints": [
    {{
      "category": "one of: Performance | Missing Feature | Bug | DX Friction | Integration | Pricing | Documentation",
      "exact_quote": "The user's actual words verbatim from the evidence",
      "impact_description": "1 sentence on why this matters to users",
      "source_url": "The URL this came from",
      "source_type": "reddit | github_issue | hacker_news | g2_review | web_article",
      "date": "YYYY-MM-DD or empty if unknown",
      "engagement_count": number or 0
    }}
  ],
  "top_friction_area": "The single biggest category of pain across all complaints"
}}

Rules:
- exact_quote must be copied verbatim from the evidence text — it's the most important field.
- If a source has no quotable complaint, skip it.
- Prefer GitHub issues and Reddit threads over marketing pages.
"""

    result = await _llm_call(system_prompt, user_prompt, max_tokens=1200)

    if result and isinstance(result, dict):
        result["total_signals_found"] = len(raw_complaints)
        result["sources_used"] = raw_sources[:8]
        result["data_confidence"] = "high" if len(raw_complaints) >= 5 else "medium"
        return result

    # Fallback: return raw complaint list without LLM structuring
    return {
        "complaints": [
            {
                "category": "Unknown",
                "exact_quote": c["text"][:200],
                "source_url": c["url"],
                "source_type": c["source"],
                "date": c.get("date", ""),
                "engagement_count": c.get("engagement", 0),
                "impact_description": "See source for full context.",
            }
            for c in raw_complaints[:5]
        ],
        "top_friction_area": "Unknown",
        "total_signals_found": len(raw_complaints),
        "sources_used": raw_sources,
        "data_confidence": "low",
    }


# ===========================================================================
# MODULE 4: Stealth / Competitor Gap Analysis
# ===========================================================================

async def research_stealth_gap(
    company_name: str,
    product_category: str,
    competitors_found: list[str],
) -> dict:
    """
    Module 4: For early-stage or low-signal companies, analyze what category
    leaders have that the target company likely lacks.

    This is honest inference, not pretend research — always labeled as such.

    Sources:
    - Competitor GitHub READMEs
    - Competitor Product Hunt pages
    - Category leader feature searches
    """

    # Determine which competitors to analyze
    # If we have real competitors from Module 2, use them; else use known category defaults
    CATEGORY_DEFAULTS: dict[str, list[str]] = {
        "billing": ["Stripe Billing", "Metronome", "Chargebee"],
        "observability": ["Datadog", "PostHog", "Grafana"],
        "analytics": ["Mixpanel", "Amplitude", "PostHog"],
        "crm": ["Salesforce", "HubSpot", "Pipedrive"],
        "developer tools": ["Linear", "Jira", "GitHub Issues"],
        "ai": ["OpenAI", "Anthropic", "Google Vertex AI"],
        "infrastructure": ["AWS", "Vercel", "Railway"],
        "payments": ["Stripe", "Adyen", "Razorpay"],
        "communication": ["Twilio", "SendGrid", "Resend"],
    }

    # Pick competitors to analyze
    competitors_to_analyze = competitors_found[:2] if competitors_found else []
    if not competitors_to_analyze:
        cat_lower = product_category.lower()
        for key, defaults in CATEGORY_DEFAULTS.items():
            if key in cat_lower:
                competitors_to_analyze = defaults[:2]
                break
        if not competitors_to_analyze:
            competitors_to_analyze = ["industry leaders", "direct category competitors"]

    # Search for what each competitor offers that target may lack
    search_tasks = []
    for competitor in competitors_to_analyze[:2]:
        search_tasks.append(
            _tavily_search(
                f'"{competitor}" features OR product capabilities OR what can you do',
                days=365, max_results=3,
            )
        )

    competitor_results_list = await asyncio.gather(*search_tasks)
    raw_sources: list[str] = []
    competitor_context = ""

    for i, results in enumerate(competitor_results_list):
        comp_name = competitors_to_analyze[i]
        for r in results:
            raw_sources.append(r["url"])
            competitor_context += f"\n[{comp_name} — {r['title']}] ({r['url']})\n{r['content'][:600]}\n"

    system_prompt = (
        "You are a competitive product analyst. "
        "Identify specific product features that market leaders have which the target company likely hasn't shipped yet. "
        "Be specific and factual — base gaps only on evidence. "
        "Always be honest that this is inferred from competitor data. "
        "Return ONLY a valid JSON object."
    )
    user_prompt = f"""
Target company: {company_name}
Product category: {product_category}
Competitors analyzed: {', '.join(competitors_to_analyze)}

<competitor_evidence>
{competitor_context[:3000] if competitor_context else "No competitor data found."}
</competitor_evidence>

Based on what competitors offer, identify 3 specific product opportunities for {company_name}.

Return a JSON object:
{{
  "competitors_analyzed": ["list of competitors used in this analysis"],
  "gap_opportunities": [
    {{
      "gap_title": "Short name of the gap/opportunity",
      "what_competitors_have": "Specific feature or capability that competitors offer",
      "why_it_matters": "1-2 sentences on why users need this and how it affects them",
      "evidence_url": "URL from competitor evidence that shows they have this",
      "effort_estimate": "one of: 1-2 days | 3-5 days | 1-2 weeks"
    }}
  ],
  "analysis_type": "competitor_projection",
  "confidence_note": "This analysis is inferred from competitor capabilities, not direct {company_name} user complaints."
}}

Rules:
- Each gap must reference something a real competitor actually has (backed by evidence_url).
- Do not invent gaps — if competitor evidence is thin, note that.
- effort_estimate is rough and based on a solo developer.
"""

    result = await _llm_call(system_prompt, user_prompt, max_tokens=900)

    if result and isinstance(result, dict):
        result["sources_used"] = raw_sources[:6]
        return result

    return {
        "competitors_analyzed": competitors_to_analyze,
        "gap_opportunities": [],
        "analysis_type": "competitor_projection",
        "confidence_note": f"Insufficient competitor data found to produce gap analysis for {company_name}.",
        "sources_used": raw_sources,
    }


# ===========================================================================
# MODULE 5: Candidate Alignment
# ===========================================================================

async def research_candidate_alignment(
    company_name: str,
    complaints: list[dict],
    gap_opportunities: list[dict],
    candidate_skills: list[str],
    candidate_domains: list[str],
    candidate_project_summary: str,
) -> dict:
    """
    Module 5: Match the candidate's real skills against the real gaps found
    in Modules 3 and 4. No hardcoded stack suggestions.

    All analysis is done from the actual candidate profile in the DB.
    """
    if not candidate_skills:
        return {
            "match_summary": "No candidate profile found. Upload your resume first to get personalized alignment analysis.",
            "matched_skills": [],
            "gaps_to_learn": [],
            "opportunity_vectors": [],
            "skill_overlap_score": 0.0,
        }

    # Combine all gaps into one list for analysis
    all_gaps = []
    for c in complaints[:5]:
        all_gaps.append({
            "gap": c.get("category", "Unknown"),
            "description": c.get("impact_description", ""),
        })
    for g in gap_opportunities[:3]:
        all_gaps.append({
            "gap": g.get("gap_title", ""),
            "description": g.get("why_it_matters", ""),
        })

    if not all_gaps:
        return {
            "match_summary": f"No specific gaps identified for {company_name} yet. Run Modules 3 and 4 first.",
            "matched_skills": candidate_skills[:5],
            "gaps_to_learn": [],
            "opportunity_vectors": [],
            "skill_overlap_score": 0.5,
        }

    system_prompt = (
        "You are a career coach and technical mentor. "
        "Given a developer's skills and real product gaps at a company, "
        "determine how well they match and what specific opportunities exist. "
        "Be honest about skill gaps. Return ONLY a valid JSON object."
    )
    user_prompt = f"""
Company: {company_name}
Candidate skills: {', '.join(candidate_skills)}
Candidate domains: {', '.join(candidate_domains) if candidate_domains else 'not specified'}
Candidate project summary: {candidate_project_summary[:300]}

Real gaps at {company_name}:
{json.dumps(all_gaps, indent=2)}

Return a JSON object:
{{
  "skill_overlap_score": a float 0.0 to 1.0 representing how well the candidate's skills match the identified gaps,
  "match_summary": "2-3 sentences explaining specifically how the candidate's background connects to the gaps — be concrete, mention actual skills and gap names",
  "matched_skills": ["candidate skills directly relevant to identified gaps"],
  "gaps_to_learn": [
    {{
      "skill": "skill or technology the candidate would need",
      "reason": "which gap requires it",
      "learning_time": "e.g. '1-2 days of reading docs'"
    }}
  ],
  "opportunity_vectors": [
    {{
      "vector_type": "one of: Frontend/UI | Backend/Infrastructure | Integration/Ecosystem",
      "title": "Short descriptive title of what to build",
      "description": "2-3 sentences on what this would look like and why it addresses a real gap",
      "primary_skills_needed": ["skills from candidate's profile that apply"],
      "gap_addressed": "which gap from the list this targets"
    }}
  ]
}}

Rules:
- opportunity_vectors must have exactly 3 entries (one per vector type).
- Do NOT generate code or tell the candidate what to build in detail — give them the direction, not the solution.
- gaps_to_learn should be honest — if the candidate is well-matched, say so.
- opportunity_vectors must reference real gaps found at this company, not generic project ideas.
"""

    result = await _llm_call(system_prompt, user_prompt, max_tokens=1000)

    if result and isinstance(result, dict):
        result["company_name"] = company_name
        return result

    # Fallback: basic overlap calculation without LLM
    tech_keywords = {
        "react", "typescript", "javascript", "python", "fastapi", "go",
        "postgresql", "redis", "docker", "api", "backend", "frontend",
    }
    overlap = [s for s in candidate_skills if s.lower() in tech_keywords]
    score = min(len(overlap) / max(len(candidate_skills), 1), 1.0)

    return {
        "company_name": company_name,
        "skill_overlap_score": round(score, 2),
        "match_summary": f"Your skills ({', '.join(candidate_skills[:3])}) are relevant to {company_name}'s gaps. Review Modules 3 and 4 for specific opportunities.",
        "matched_skills": overlap[:5],
        "gaps_to_learn": [],
        "opportunity_vectors": [
            {
                "vector_type": "Frontend/UI",
                "title": f"User-facing dashboard improvement for {company_name}",
                "description": "Build a UI component addressing the top friction identified in Module 3.",
                "primary_skills_needed": [s for s in candidate_skills if s.lower() in {"react", "typescript", "javascript", "vue", "svelte"}][:3],
                "gap_addressed": all_gaps[0]["gap"] if all_gaps else "Product Friction",
            },
            {
                "vector_type": "Backend/Infrastructure",
                "title": f"Pipeline or API tool for {company_name}",
                "description": "Build a backend service that addresses the performance or reliability gap identified.",
                "primary_skills_needed": [s for s in candidate_skills if s.lower() in {"python", "go", "fastapi", "postgresql", "redis"}][:3],
                "gap_addressed": all_gaps[1]["gap"] if len(all_gaps) > 1 else "Performance",
            },
            {
                "vector_type": "Integration/Ecosystem",
                "title": f"Third-party integration or connector for {company_name}",
                "description": "Build a lightweight integration or webhook handler that connects an existing tool to the product.",
                "primary_skills_needed": [s for s in candidate_skills if s.lower() in {"api", "webhooks", "node", "python", "rest"}][:3],
                "gap_addressed": all_gaps[2]["gap"] if len(all_gaps) > 2 else "Integration",
            },
        ],
    }
