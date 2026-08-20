"""Stage 2.1 — Query generation for Tavily search."""

def generate_queries(
    company_name: str, 
    company_url: str | None = None, 
    is_b2b_saas: bool = False, 
    has_github: bool = False,
    skip_hiring: bool = False
) -> list[tuple[str, str, int]]:
    """
    Generate a targeted set of search queries for a company.
    Returns a list of tuples: (query_string, category, days_recency).
    """
    if not company_name or not company_name.strip():
        return []

    # Sanitize the company name to remove weird characters, though search engines handle them okay
    c_name = company_name.strip()
    
    # Core queries with per-category recency constraints
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
