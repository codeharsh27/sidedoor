"""
Stage 4 Fixability Classifier — categorises each gap cluster into one of three types.

fixability_type values:
  - 'direct_surface': The company exposes a public API, repo, or UI others can extend.
  - 'stated_pain_point': A real, specific pain is documented publicly; a standalone tool
      addressing the same domain is buildable without touching company internals.
  - 'too_vague': Pain is too generic or internal to produce a concrete buildable opportunity.

Passes to profile matching:
  - 'direct_surface' and 'stated_pain_point' -> is_buildable = True (surfaced as cards)
  - 'too_vague'                               -> is_buildable = False (dropped, logged)

Every decision is logged with a human-readable fixability_reason so debugging
requires zero DB queries.
"""

import json
import logging
import uuid
from datetime import datetime, timezone

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db.models import Company, GapCluster, FixabilityFlag

logger = logging.getLogger(__name__)

FIXABILITY_SYSTEM_PROMPT = """\
You are a technical opportunity classifier for SideDoor. Your job is to classify \
a gap cluster into one of exactly three fixability categories.

## Categories

### direct_surface
The company exposes a public API, open-source repository, SDK, webhook system, \
or an extensible UI that a third-party developer can build on top of. \
The gap involves limitations or missing features in that public surface. \
Example: "Stripe's API doesn't support multi-currency split payouts" \
— Stripe has a public API; a developer could build this as an extension.

### stated_pain_point
No public API or repo of the company's own is exposed, but the company or its users \
have publicly documented a specific, concrete problem. The problem is specific enough \
that a standalone tool (operating independently of the company's own systems) \
directly addresses it.

**Real worked example (calibrate your judgement against this):**
Stripe users have publicly documented that Stripe Radar blocks legitimate transactions \
from specific regions and industries, and there is no built-in explainability tool to \
diagnose why a charge was blocked. Stripe does not expose its Radar model internals, \
but the pain point is specific enough that a standalone pre-charge validation tool \
(using Stripe's public test-charge API) could reproduce and explain blockage patterns \
before a customer even hits checkout. Classification: stated_pain_point \u2014 not too_vague \
(it names a specific mechanism: Radar false positives), not direct_surface \
(Stripe's Radar model itself is not open).

The test: could you build a product that solves this exact problem without \
touching the company's own private codebase or model? If yes -> stated_pain_point.

### too_vague
CLASSIFY AS `too_vague` IF ANY OF THE FOLLOWING ARE TRUE:
1. **Pure Corporate Metadata**: The evidence contains ONLY generic directory listings, \
employee headcounts, founder bios, funding press releases, or high-level 'About Us' descriptions \
WITHOUT any technical details, trade-offs, or user pain points.
2. **Too Generic**: The problem is too vague ("users complain about pricing", "people find it slow").
3. **Too Internal**: The problem requires access to the company's private internal systems to solve.

**IMPORTANT DISTINCTION**:
If evidence includes technical blog posts, documentation, or changelogs that describe \
specific architectural trade-offs, rate-limiting constraints, performance struggles, \
or missing feature extensions (e.g., "Leaving serverless due to latency", \
"Rate limit configuration challenges"), do NOT mark it as `too_vague` simply because \
it comes from company-authored blogs/docs. If a specific technical gap is described, \
classify it as `direct_surface` or `stated_pain_point`.

## Instructions
- Return ONLY a JSON object with exactly four keys: "fixability_type", "fixability_reason", "has_public_api", "has_ui_surface".
- "fixability_type" must be one of: "direct_surface", "stated_pain_point", "too_vague"
- "fixability_reason" must be 1-2 sentences explaining the classification decision.
- "has_public_api" must be boolean (true/false) based on whether evidence implies a public API exists.
- "has_ui_surface" must be boolean (true/false) based on whether evidence implies a UI surface exists.
- Do not include any other text, markdown, or explanation outside the JSON.
"""


async def _classify_cluster_llm(
    cluster_label: str,
    evidence_snippets: list[str],
    has_github: bool,
) -> tuple[str, str, bool, bool]:
    """
    Ask the LLM to classify a cluster's fixability type.
    Returns (fixability_type, fixability_reason, has_public_api, has_ui_surface).
    Falls back to 'too_vague' on any error.
    """
    if not settings.openrouter_api_key:
        logger.warning("OPENROUTER_API_KEY missing — defaulting fixability_type to 'too_vague'")
        return "too_vague", "No LLM API key configured; defaulted to too_vague.", False, False

    has_github_note = (
        "Note: This company has a public GitHub repository — this is a direct_surface signal."
        if has_github else ""
    )
    snippets_text = "\n\n".join(
        f"<evidence>{s[:400]}</evidence>" for s in evidence_snippets[:5]
    )
    user_content = (
        f"Cluster label: {cluster_label}\n\n"
        f"{has_github_note}\n\n"
        f"Evidence snippets:\n{snippets_text}\n\n"
        "Classify this cluster into one of: direct_surface, stated_pain_point, too_vague.\n"
        "Return JSON only."
    )

    payload = {
        "model": "openai/gpt-4o-mini",
        "messages": [
            {"role": "system", "content": FIXABILITY_SYSTEM_PROMPT},
            {"role": "user", "content": user_content},
        ],
        "temperature": 0.0,
        "max_tokens": 256,
    }

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                "https://openrouter.ai/api/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {settings.openrouter_api_key}",
                    "Content-Type": "application/json",
                },
                json=payload,
            )
            if resp.status_code != 200:
                logger.warning(
                    "LLM fixability failed with HTTP %d: %s",
                    resp.status_code, resp.text[:300]
                )
                return "too_vague", f"LLM returned HTTP {resp.status_code}; defaulted to too_vague.", False, False

            data = resp.json()
            content = data["choices"][0]["message"]["content"].strip()
            
            # Strip markdown json fences if present
            if content.startswith("```"):
                lines = content.splitlines()
                if lines[0].startswith("```"):
                    lines = lines[1:]
                if lines and lines[-1].startswith("```"):
                    lines = lines[:-1]
                content = "\n".join(lines).strip()

            parsed = json.loads(content)

            ftype = parsed.get("fixability_type", "too_vague")
            freason = parsed.get("fixability_reason", "No reason provided.")
            has_api = bool(parsed.get("has_public_api", False))
            has_ui = bool(parsed.get("has_ui_surface", False))

            if ftype not in ("direct_surface", "stated_pain_point", "too_vague"):
                logger.warning("LLM returned invalid fixability_type '%s' — defaulting", ftype)
                return "too_vague", f"LLM returned invalid type '{ftype}'; defaulted.", False, False

            return ftype, freason, has_api, has_ui

    except Exception as e:
        logger.error("LLM fixability exception for cluster '%s': %s", cluster_label, e)
        return "too_vague", f"Classification error: {e}; defaulted to too_vague.", False, False


async def compute_fixability(
    company_id: uuid.UUID,
    db: AsyncSession,
) -> list[uuid.UUID]:
    """
    Compute and persist fixability classifications for all gap clusters of a company.

    Each cluster gets:
      - fixability_type: 'direct_surface' | 'stated_pain_point' | 'too_vague'
      - fixability_reason: human-readable explanation
      - is_buildable: True for direct_surface and stated_pain_point, False for too_vague

    Returns:
        List of UUIDs of all persisted FixabilityFlag rows.
    """
    from app.db.models import EvidenceItem

    stmt_company = select(Company).where(Company.id == company_id)
    company = (await db.execute(stmt_company)).scalar_one_or_none()
    if not company:
        logger.error("Company %s not found for fixability check", company_id)
        return []

    has_github = bool(company.github_repo_url and company.github_repo_url.strip())

    stmt_clusters = select(GapCluster).where(GapCluster.company_id == company_id)
    clusters = (await db.execute(stmt_clusters)).scalars().all()

    if not clusters:
        logger.info("No gap clusters found for company %s", company.name)
        return []

    logger.info(
        "Computing fixability for %d clusters in company '%s'",
        len(clusters), company.name
    )

    persisted_ids: list[uuid.UUID] = []
    buildable_count = 0

    for cluster in clusters:
        try:
            evidence_snippets: list[str] = []
            if cluster.evidence_item_ids:
                stmt_ev = select(EvidenceItem).where(
                    EvidenceItem.id.in_(cluster.evidence_item_ids)
                ).limit(5)
                ev_rows = (await db.execute(stmt_ev)).scalars().all()
                evidence_snippets = [ev.raw_text[:500] for ev in ev_rows if ev.raw_text]

            fixability_type, fixability_reason, has_api, has_ui = await _classify_cluster_llm(
                cluster_label=cluster.label,
                evidence_snippets=evidence_snippets,
                has_github=has_github,
            )

            is_buildable = fixability_type in ("direct_surface", "stated_pain_point")
            if is_buildable:
                buildable_count += 1

            # Inline drop-reason log — no DB query needed to audit decisions
            logger.info(
                "FIXABILITY [%s] cluster='%s' company='%s' is_buildable=%s | %s",
                fixability_type.upper(),
                cluster.label,
                company.name,
                is_buildable,
                fixability_reason,
            )

            async with db.begin_nested():
                stmt_flag = select(FixabilityFlag).where(
                    FixabilityFlag.gap_cluster_id == cluster.id
                )
                flag = (await db.execute(stmt_flag)).scalar_one_or_none()

                if flag:
                    flag.has_public_repo = has_github
                    flag.has_public_api = has_api
                    flag.has_ui_surface = has_ui
                    flag.is_buildable = is_buildable
                    flag.fixability_type = fixability_type
                    flag.fixability_reason = fixability_reason
                    flag.computed_at = datetime.now(timezone.utc)
                else:
                    flag = FixabilityFlag(
                        gap_cluster_id=cluster.id,
                        company_id=company_id,
                        has_public_repo=has_github,
                        has_public_api=has_api,
                        has_ui_surface=has_ui,
                        is_buildable=is_buildable,
                        fixability_type=fixability_type,
                        fixability_reason=fixability_reason,
                        computed_at=datetime.now(timezone.utc),
                    )
                    db.add(flag)

                await db.flush()
                persisted_ids.append(flag.id)

        except Exception as e:
            logger.error(
                "Failed fixability for cluster '%s' (company %s): %s",
                cluster.label, company.name, e
            )

    logger.info(
        "FIXABILITY SUMMARY company='%s': %d clusters, %d buildable, %d too_vague",
        company.name, len(clusters), buildable_count, len(clusters) - buildable_count,
    )
    return persisted_ids


