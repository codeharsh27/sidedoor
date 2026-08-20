"""Stage 2.1 — Query generation for Tavily search."""


def generate_queries(
    company_name: str,
    company_url: str | None = None,
    is_b2b_saas: bool = False,
    has_github: bool = False,
    skip_hiring: bool = False,
) -> list[tuple[str, str, int]]:
    """
    Generate a targeted set of search queries for a company's general scan.
    Returns a list of tuples: (query_string, category, days_recency).
    """
    if not company_name or not company_name.strip():
        return []

    c_name = company_name.strip()

    queries = [
        (f'"{c_name}" complaints OR frustrated site:reddit.com', "pain_point", 180),
        (f'"{c_name}" feature request OR "wish it had"', "pain_point", 180),
        (f'"switched from {c_name}" OR "alternative to {c_name}" OR "moved away from {c_name}"', "competitor_switch", 180),
        (f'"{c_name}" "pain" OR "issue" OR "broken" OR "slow"', "product_pain", 180),
        (f'"{c_name}" "wish" OR "if only" OR "missing feature"', "feature_wish", 180),
        (f'"Show HN" "{c_name}"', "recent_activity", 60),
        (f'"{c_name}" changelog', "recent_activity", 60),
        (f'"{c_name}" founder twitter OR "building"', "founder_voice", 60),
    ]

    if not skip_hiring:
        queries.append((f'"{c_name}" hiring OR "we\'re looking for"', "hiring_signal", 180))

    if has_github:
        queries.append((f'"{c_name}" issues site:github.com', "pain_point", 180))

    if is_b2b_saas:
        queries.append((f'"{c_name}" review site:g2.com', "pain_point", 180))

    return queries


def generate_deep_research_queries(
    company_name: str,
    category: str | None = None,
) -> list[tuple[str, str, int]]:
    """
    Generate a deeper, more targeted set of search queries specifically
    for the deep research dossier engine.

    These queries go beyond pain-point scanning to capture:
    - Competitor and alternative discovery
    - Raw user voice from multiple platforms
    - Product roadmap and engineering signals
    - JD decoding signals (what the company is building internally)

    Returns: list of (query_string, category, days_recency)
    """
    if not company_name or not company_name.strip():
        return []

    c_name = company_name.strip()

    queries = [
        # Competitor discovery (no recency limit — competitor context is evergreen)
        (f'"{c_name}" alternative OR competitor', "competitor_discovery", 730),
        (f'"switched from {c_name}" OR "why I left {c_name}" OR "moved away from {c_name}"', "churn_signal", 730),
        (f'"{c_name}" vs site:reddit.com OR site:news.ycombinator.com', "comparison_discussion", 365),

        # Raw user voice — exact platform targeting
        (f'site:reddit.com "{c_name}" frustrated OR broken OR "wish it had" OR bug OR "doesn\'t work"', "raw_complaint_reddit", 180),
        (f'site:news.ycombinator.com "{c_name}"', "hn_discussion", 365),
        (f'"{c_name}" review site:g2.com OR site:capterra.com OR site:trustpilot.com', "review_signal", 365),

        # Engineering and roadmap signals
        (f'"{c_name}" site:github.com issues OR "bug report" OR "feature request"', "github_signal", 90),
        (f'"{c_name}" changelog OR "what\'s new" OR "product update" OR "release notes"', "roadmap_signal", 90),

        # JD signal — decode what the company is building internally
        (f'"{c_name}" hiring engineer OR "backend engineer" OR "fullstack" OR "software engineer"', "jd_signal", 90),
        (f'"{c_name}" "we are looking for" OR "join our team" engineer', "jd_signal", 90),

        # Founder/eng voice — often reveals internal priorities
        (f'"{c_name}" site:twitter.com OR site:x.com founder OR CTO OR engineering', "founder_signal", 60),
    ]

    return queries
