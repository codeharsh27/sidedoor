"""
Phase 3 Company Vetter Service — rule-based health & scam risk assessment.

Analyzes company metadata, investor backing, team scale, public codebase presence,
and job posting transparency to compute green/red flags and safety verdict.

Zero LLM calls — 100% deterministic rules.
"""

import logging
import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Company, CompanyHealthSignal, JobPosting

logger = logging.getLogger(__name__)

RECOGNIZED_VCS = {
    "yc", "a16z", "sequoia", "peak_xv", "blume", "accel", "accel_india",
    "lightspeed", "founders_fund", "bessemer", "index", "insight", "general_catalyst"
}


async def evaluate_company_health(
    company_id: uuid.UUID,
    db: AsyncSession,
) -> CompanyHealthSignal:
    """
    Evaluates or updates health signals for a company and persists the result.
    """
    # 1. Fetch Company & Job Postings
    stmt_comp = select(Company).where(Company.id == company_id)
    comp = (await db.execute(stmt_comp)).scalar_one_or_none()
    if not comp:
        raise ValueError(f"Company {company_id} not found")

    stmt_jobs = select(JobPosting).where(JobPosting.company_id == company_id)
    jobs = list((await db.execute(stmt_jobs)).scalars().all())

    green_flags: list[str] = []
    red_flags: list[str] = []

    # --- Green Flag Checks ---
    # 1. Institutional VC Backing
    inv_tags = [t.lower() for t in (comp.investor_tags or [])]
    has_vc_backing = bool(comp.funding_stage) or any(t in RECOGNIZED_VCS for t in inv_tags)
    if has_vc_backing:
        inv_str = f" ({', '.join(inv_tags[:2]).upper()})" if inv_tags else ""
        green_flags.append(f"Institutional VC Backing{inv_str}")

    # 2. Team Scale
    emp_count = comp.employee_count_approx or 0
    if emp_count >= 10:
        green_flags.append(f"Established Team ({emp_count}+ team members)")

    # 3. Public Engineering Footprint
    if comp.github_repo_url and len(comp.github_repo_url.strip()) > 0:
        green_flags.append("Public Open-Source / Engineering Codebase")

    # 4. Verified Hiring Pipeline
    if len(jobs) > 0:
        green_flags.append(f"Active Job Postings ({len(jobs)} open role{'s' if len(jobs) > 1 else ''})")

    # --- Red Flag Checks ---
    # 1. Extremely Small / 2-Person Risk
    if 0 < emp_count < 3:
        red_flags.append(f"Tiny Team ({emp_count} members — high risk of unpaid/scam labor)")
    
    # 2. Unfunded & Small Scale
    if not has_vc_backing and emp_count < 5:
        red_flags.append("No Disclosed VC Backing & Small Team (<5 members)")

    # 3. No Public GitHub / Engineering Footprint
    if not comp.github_repo_url:
        red_flags.append("No Public GitHub Org or Verified Code Repository")

    # 4. Job Posting Compensation Ambiguity
    equity_only_jobs = [j for j in jobs if "equity only" in j.raw_text.lower() or "unpaid" in j.raw_text.lower()]
    if len(equity_only_jobs) > 0:
        red_flags.append("Job Postings List Equity-Only or Unpaid Compensation")

    # --- Verdict Computation ---
    green_count = len(green_flags)
    red_count = len(red_flags)

    if green_count >= 2 and red_count == 0:
        verdict = "verified_safe"
        summary = f"Verified VC-backed startup with {green_count} green trust signals and 0 red flags."
    elif red_count >= 2:
        verdict = "high_risk"
        summary = f"Exercise caution — identified {red_count} potential risk signals (e.g. team size, funding)."
    else:
        verdict = "limited_info"
        summary = f"Limited public signals available ({green_count} green, {red_count} red flags). Perform due diligence."

    # --- Persist / Upsert Signal ---
    stmt_signal = select(CompanyHealthSignal).where(CompanyHealthSignal.company_id == company_id)
    signal = (await db.execute(stmt_signal)).scalar_one_or_none()

    now = datetime.now(timezone.utc)

    if signal:
        signal.employee_count_linkedin = emp_count or signal.employee_count_linkedin
        signal.funding_disclosed = has_vc_backing
        signal.lead_investor = inv_tags[0].upper() if inv_tags else signal.lead_investor
        signal.has_salary_in_job_postings = len(jobs) > 0 and len(equity_only_jobs) == 0
        signal.red_flag_count = red_count
        signal.green_flag_count = green_count
        signal.verdict = verdict
        signal.green_flags = green_flags
        signal.red_flags = red_flags
        signal.summary = summary
        signal.health_computed_at = now
    else:
        signal = CompanyHealthSignal(
            company_id=company_id,
            employee_count_linkedin=emp_count,
            funding_disclosed=has_vc_backing,
            lead_investor=inv_tags[0].upper() if inv_tags else None,
            has_salary_in_job_postings=len(jobs) > 0 and len(equity_only_jobs) == 0,
            red_flag_count=red_count,
            green_flag_count=green_count,
            verdict=verdict,
            green_flags=green_flags,
            red_flags=red_flags,
            summary=summary,
            health_computed_at=now,
        )
        db.add(signal)

    await db.commit()
    await db.refresh(signal)
    logger.info("Computed company health for %s: verdict=%s (green=%d, red=%d)", comp.name, verdict, green_count, red_count)
    return signal
