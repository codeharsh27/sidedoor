"""
Stage 6 Outreach Drafter Service — zero-LLM scaffold template generation.

Generates a ready-to-adapt outreach message scaffold for a given (card, user) pair.

Design rules (non-negotiable):
  - Zero LLM calls. All text is produced by string substitution into fixed templates.
  - [TODO:] placeholders are NEVER pre-filled by this service. They are intentionally
    left for the user to complete — this upholds the "never complete the job for the
    user" principle from PRD §9 and AGENTS.md.
  - Every evidence source that appears in the draft is a real, clickable URL from
    the evidence_items table.
  - Upsert semantics: calling this service twice for the same (card_id, user_id) updates
    updated_at and refreshes draft_text, but returns the same draft_id.

Template variants:
  - Variant A ("I built something") — used when card.status == "selected".
    Includes placeholders for a live demo link and a Loom walkthrough URL.
  - Variant B ("I spotted something") — used for all other card statuses.
    Focuses on the gap observation and a proposed investigation.
"""

import logging
import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import (
    Card,
    Company,
    EvidenceItem,
    GapCluster,
    JobPosting,
    OutreachDraft,
    RoleMatch,
    UserProfile,
)
from app.services.prompt_generator import get_matching_skill_and_domain

logger = logging.getLogger(__name__)

# -----------------------------------------------------------------
# Template definitions
# -----------------------------------------------------------------
# IMPORTANT: Do NOT pre-fill any [TODO:] section. They are deliberate.

_TEMPLATE_A = """\
Subject: [TODO: fill in — keep it \u226460 chars]

Hi [TODO: contact name or "team"],

I\u2019ve been using {company_name} and noticed that \u201c{cluster_label}\u201d keeps coming up as a pain point in the community.

I built a small proof-of-concept that addresses this:
  [TODO: paste your live demo / GitHub link here]

Here\u2019s a 2-minute walkthrough:
  [TODO: paste Loom URL here]

I\u2019m targeting {role_title} roles and would love 15 minutes to show you what I learned building this. Happy to elaborate on any technical detail.

[TODO: your name]
[TODO: your GitHub / portfolio link]

---
Research Summary:
- Total Evidence Items: {evidence_count}
- Channels Analyzed: {source_channels}
- Date Range: {date_range}
- Top Quote: "{top_evidence_quote_truncated}"

Evidence sources:
{evidence_source_list}"""

_TEMPLATE_B = """\
Subject: [TODO: fill in — keep it \u226460 chars]

Hi [TODO: contact name or "team"],

I\u2019ve been researching {company_name} seriously \u2014 looking at where users are running into friction. One theme keeps appearing: \u201c{cluster_label}.\u201d

I\u2019m planning to build a small proof-of-concept this week to demonstrate a possible fix. Before I do, I\u2019d love a 10-minute call to validate I\u2019m solving the right thing.

I\u2019m targeting {role_title} roles and have relevant experience in {top_matching_skill}.

[TODO: your name]
[TODO: your GitHub / portfolio link]

---
Research Summary:
- Total Evidence Items: {evidence_count}
- Channels Analyzed: {source_channels}
- Date Range: {date_range}
- Top Quote: "{top_evidence_quote_truncated}"

Evidence sources:
{evidence_source_list}"""


# -----------------------------------------------------------------
# Public API
# -----------------------------------------------------------------
async def generate_outreach_draft(
    card_id: uuid.UUID,
    user_id: uuid.UUID,
    db: AsyncSession,
) -> OutreachDraft:
    """
    Generate (or regenerate) the outreach draft scaffold for a card.

    The returned OutreachDraft is upserted — calling this twice with the same
    (card_id, user_id) returns the same draft_id with a refreshed updated_at.

    Args:
        card_id: UUID of the selected card.
        user_id: UUID of the requesting user.
        db: Active async SQLAlchemy session.

    Returns:
        The persisted OutreachDraft ORM object.

    Raises:
        ValueError: If the card does not exist / does not belong to user_id,
                    or if the user profile is missing.
    """
    # 1. Load card — verify ownership
    stmt_card = select(Card).where(Card.id == card_id)
    card = (await db.execute(stmt_card)).scalar_one_or_none()
    if not card:
        raise ValueError(f"Card {card_id} not found")
    if card.user_id != user_id:
        raise ValueError(f"Card {card_id} does not belong to user {user_id}")

    # 2. Load UserProfile
    stmt_profile = select(UserProfile).where(UserProfile.user_id == user_id)
    profile = (await db.execute(stmt_profile)).scalar_one_or_none()
    if not profile:
        raise ValueError(f"User profile for user {user_id} not found")

    # 3. Load GapCluster
    stmt_cluster = select(GapCluster).where(GapCluster.id == card.gap_cluster_id)
    cluster = (await db.execute(stmt_cluster)).scalar_one_or_none()
    if not cluster:
        raise ValueError(f"Gap cluster {card.gap_cluster_id} not found")

    # 4. Load Company
    stmt_company = select(Company.name).where(Company.id == card.company_id)
    company_name = (await db.execute(stmt_company)).scalar_one_or_none()
    if not company_name:
        raise ValueError(f"Company {card.company_id} not found")

    # 5. Load top 3 evidence items
    evidence_items: list[EvidenceItem] = []
    if cluster.evidence_item_ids:
        stmt_ev = select(EvidenceItem).where(
            EvidenceItem.id.in_(cluster.evidence_item_ids)
        ).limit(3)
        evidence_items = list((await db.execute(stmt_ev)).scalars().all())

    # 6. Determine top_evidence_quote (first item, truncated)
    top_evidence_quote = ""
    if evidence_items:
        raw = evidence_items[0].raw_text
        top_evidence_quote = raw[:120] + ("\u2026" if len(raw) > 120 else "")

    # 7. Build evidence source bullet list (real, clickable URLs)
    evidence_source_list = "\n".join(
        f"- {item.source_url}" for item in evidence_items
    )
    if not evidence_source_list:
        evidence_source_list = "- (no evidence sources available)"

    # 8. Resolve best role title
    role_title = "engineering"
    stmt_role = (
        select(RoleMatch)
        .where(RoleMatch.gap_cluster_id == cluster.id)
        .order_by(RoleMatch.match_score.desc())
        .limit(1)
    )
    role_match = (await db.execute(stmt_role)).scalar_one_or_none()
    if role_match:
        stmt_job = select(JobPosting.title).where(
            JobPosting.id == role_match.job_posting_id
        )
        job_title = (await db.execute(stmt_job)).scalar_one_or_none()
        if job_title:
            role_title = job_title

    # 9. Resolve top matching skill via shared helper (no duplication)
    evidence_text = " ".join(item.raw_text for item in evidence_items)
    top_matching_skill, _ = get_matching_skill_and_domain(
        profile.parsed_skills,
        profile.parsed_domains,
        evidence_text or cluster.label,
        cluster.label,
    )

    # 10. Choose template variant
    template = _TEMPLATE_A if card.status == "selected" else _TEMPLATE_B

    evidence_count = getattr(cluster, 'evidence_count', len(cluster.evidence_item_ids) if cluster.evidence_item_ids else 0)
    
    source_channels = "N/A"
    date_range = "N/A"
    
    if evidence_items:
        channels = set(item.source_type for item in evidence_items if item.source_type)
        if channels:
            source_channels = ", ".join(sorted(channels))
        
        dates = sorted([str(item.posted_at)[:10] for item in evidence_items if item.posted_at])
        if dates:
            if len(dates) > 1:
                date_range = f"{dates[0]} to {dates[-1]}"
            else:
                date_range = dates[0]

    # 11. Fill template variables
    draft_text = template.format(
        company_name=company_name,
        cluster_label=cluster.label,
        top_evidence_quote_truncated=top_evidence_quote,
        role_title=role_title,
        top_matching_skill=top_matching_skill,
        evidence_source_list=evidence_source_list,
        evidence_count=evidence_count,
        source_channels=source_channels,
        date_range=date_range
    )

    # 12. Upsert outreach_drafts row
    now = datetime.now(timezone.utc)
    
    stmt = pg_insert(OutreachDraft).values(
        card_id=card_id,
        user_id=user_id,
        draft_text=draft_text,
        created_at=now,
        updated_at=now,
    ).on_conflict_do_update(
        index_elements=["card_id", "user_id"],
        set_={"draft_text": draft_text, "updated_at": now}
    ).returning(OutreachDraft)
    
    result = await db.execute(stmt)
    await db.flush()
    return result.scalar_one()
