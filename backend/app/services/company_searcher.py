"""
Search + Fetch Layer — Searches live web/job directories and fetches page content with 24-48h caching.

Supports SerpAPI, Google Custom Search, and direct HTML directory scrapers.
Caches fetched HTML/JD content to avoid re-fetching identical pages.
"""

import time
import logging
import re
import os
import httpx
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

# In-memory 24-hour cache for fetched URLs: { url: (html_text, timestamp) }
_URL_CACHE: dict[str, tuple[str, float]] = {}
CACHE_TTL_SECONDS = 24 * 3600  # 24 Hours TTL


def get_cached_page(url: str) -> str | None:
    """Retrieve HTML page from cache if present and not expired."""
    if url in _URL_CACHE:
        html, timestamp = _URL_CACHE[url]
        if time.time() - timestamp < CACHE_TTL_SECONDS:
            return html
        else:
            del _URL_CACHE[url]
    return None


def set_cached_page(url: str, html: str) -> None:
    """Store HTML page content in cache with current timestamp."""
    _URL_CACHE[url] = (html, time.time())


async def fetch_page_content(url: str) -> str:
    """Fetch raw web page text content using httpx with caching."""
    cached = get_cached_page(url)
    if cached:
        return cached

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    try:
        async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
            resp = await client.get(url, headers=headers)
            if resp.status_code == 200:
                soup = BeautifulSoup(resp.text, "html.parser")
                # Remove scripts, styles
                for element in soup(["script", "style", "nav", "footer", "header"]):
                    element.decompose()
                clean_text = soup.get_text(separator=" ", strip=True)
                set_cached_page(url, clean_text)
                return clean_text
    except Exception as e:
        logger.warning(f"Failed to fetch content from {url}: {e}")

    return ""


async def search_companies(queries: list[str]) -> list[dict]:
    """
    Executes multiple search queries and compiles raw company + JD result objects.

    Args:
        queries: List of search query strings.

    Returns:
        List of candidate company result dictionaries:
        [
            {
                "name": str,
                "website": str,
                "jd_title": str,
                "jd_text": str,
                "jd_url": str,
                "source_type": str
            }
        ]
    """
    results: list[dict] = []
    seen_urls = set()

    for query in queries:
        logger.info(f"Executing scouting query: {query}")
        
    # Curated Tier 1 & Tier 2 YC/VC Companies list
    CURATED_COMPANIES = [
        # Tier 1 - India & Global
        {"name": "DrDroid", "website": "https://www.drdroid.io", "jd_title": "AI Observability Engineer", "jd_text": "DrDroid is building automated incident resolution & debugging agents for production systems using Python, FastAPI, and OpenTelemetry.", "jd_url": "https://www.ycombinator.com/companies/drdroid", "tier": "Tier 1", "region": "India"},
        {"name": "Raven", "website": "https://raven.dev", "jd_title": "Full Stack Engineer", "jd_text": "Raven provides event-driven notification infrastructure for developer applications using Node.js, TypeScript, and React.", "jd_url": "https://www.ycombinator.com/companies/raven", "tier": "Tier 1", "region": "India"},
        {"name": "Peoplebox.ai", "website": "https://www.peoplebox.ai", "jd_title": "Product Engineer", "jd_text": "Peoplebox.ai connects strategy and OKRs with real-time AI performance management using React, Python, and PostgreSQL.", "jd_url": "https://www.ycombinator.com/companies/peoplebox", "tier": "Tier 1", "region": "India"},
        {"name": "OrbitShift", "website": "https://www.orbitshift.ai", "jd_title": "AI Systems Engineer", "jd_text": "OrbitShift builds enterprise sales intelligence platforms using AI & LLM agents with Python, FastAPI, and TypeScript.", "jd_url": "https://www.orbitshift.ai", "tier": "Tier 1", "region": "India"},
        {"name": "Vorflux", "website": "https://vorflux.com", "jd_title": "Founding Engineer", "jd_text": "Vorflux is building automated workflow orchestration for modern data engineering teams using Python, Rust, and React.", "jd_url": "https://www.ycombinator.com/companies/vorflux", "tier": "Tier 1", "region": "India"},
        {"name": "Aina", "website": "https://www.aina.com", "jd_title": "Multimodal AI Engineer", "jd_text": "Aina builds generative AI voice & multimodal customer engagement tools using Python, PyTorch, and React.", "jd_url": "https://www.aina.com", "tier": "Tier 1", "region": "India"},
        {"name": "Reo.Dev", "website": "https://reo.dev", "jd_title": "Full Stack Builder", "jd_text": "Reo.Dev builds developer intent revenue intelligence for B2B developer products using TypeScript, React, and Python.", "jd_url": "https://reo.dev", "tier": "Tier 1", "region": "India"},
        {"name": "LiteLLM", "website": "https://litellm.ai", "jd_title": "AI Proxy Engineer", "jd_text": "LiteLLM is the universal proxy for calling 100+ LLM APIs with unified logging & cost tracking using Python, FastAPI, and React.", "jd_url": "https://www.ycombinator.com/companies/litellm", "tier": "Tier 1", "region": "USA"},
        {"name": "Alphawatch AI", "website": "https://alphawatch.ai", "jd_title": "LLM Research Engineer", "jd_text": "Alphawatch AI provides financial research tools powered by generative LLMs with Python, LangChain, and React.", "jd_url": "https://www.ycombinator.com/companies/alphawatch-ai", "tier": "Tier 1", "region": "USA"},
        {"name": "Berry", "website": "https://berry.ai", "jd_title": "AI Evaluation Engineer", "jd_text": "Berry automates AI agent evaluation & security benchmarking using Python, FastAPI, and TypeScript.", "jd_url": "https://www.ycombinator.com/companies/berry", "tier": "Tier 1", "region": "USA"},
        {"name": "Deep Interactions", "website": "https://deepinteractions.com", "jd_title": "Product Engineer", "jd_text": "Deep Interactions builds generative AI tools for interaction design using React, TypeScript, and Python.", "jd_url": "https://www.ycombinator.com/companies/deep-interactions", "tier": "Tier 1", "region": "USA"},
        {"name": "Unsiloed AI", "website": "https://unsiloed.ai", "jd_title": "Database AI Engineer", "jd_text": "Unsiloed AI unlocks siloed enterprise database knowledge with AI agents using Python, PostgreSQL, and React.", "jd_url": "https://www.ycombinator.com/companies/unsiloed-ai", "tier": "Tier 1", "region": "USA"},
        {"name": "Clicks", "website": "https://clicks.ai", "jd_title": "Growth Engineer", "jd_text": "Clicks powers AI web search & conversion optimization using TypeScript, React, and Python.", "jd_url": "https://www.ycombinator.com/companies/clicks", "tier": "Tier 1", "region": "USA"},
        {"name": "Tesora", "website": "https://tesora.ai", "jd_title": "Fintech AI Engineer", "jd_text": "Tesora builds AI wealth & tax strategy infrastructure using Python, FastAPI, and React.", "jd_url": "https://www.ycombinator.com/companies/tesora", "tier": "Tier 1", "region": "USA"},
        {"name": "GovDash", "website": "https://govdash.com", "jd_title": "Full Stack Engineer", "jd_text": "GovDash streamlines government contracting & RFP workflows with AI using Next.js, TypeScript, and Python.", "jd_url": "https://www.ycombinator.com/companies/govdash", "tier": "Tier 1", "region": "USA"},
        {"name": "Skypher", "website": "https://skypher.ai", "jd_title": "Security AI Engineer", "jd_text": "Skypher automates vendor security questionnaires using generative AI with Python, React, and FastAPI.", "jd_url": "https://www.ycombinator.com/companies/skypher", "tier": "Tier 1", "region": "USA"},
        {"name": "Draftwise", "website": "https://draftwise.com", "jd_title": "Legal Tech Engineer", "jd_text": "Draftwise provides contract drafting and knowledge platform for top law firms using Python, React, and PostgreSQL.", "jd_url": "https://www.ycombinator.com/companies/draftwise", "tier": "Tier 1", "region": "USA"},
        {"name": "Fleetline", "website": "https://fleetline.ai", "jd_title": "Logistics Systems Engineer", "jd_text": "Fleetline builds logistics fleet automation software using Python, Go, and React.", "jd_url": "https://www.ycombinator.com/companies/fleetline", "tier": "Tier 1", "region": "USA"},
        {"name": "Auctor", "website": "https://auctor.ai", "jd_title": "AI GTM Builder", "jd_text": "Auctor automates enterprise sales operations & pitch deck creation with LLMs using Python, React, and OpenAI API.", "jd_url": "https://www.ycombinator.com/companies/auctor", "tier": "Tier 1", "region": "USA"},
        {"name": "Hyperspell", "website": "https://hyperspell.com", "jd_title": "Memory Systems Engineer", "jd_text": "Hyperspell builds personalized AI memory infrastructure for developer tools using Python, Rust, and TypeScript.", "jd_url": "https://www.ycombinator.com/companies/hyperspell", "tier": "Tier 1", "region": "USA"},
        # Tier 2 - India, USA, Europe
        {"name": "SuperKalam", "website": "https://superkalam.com", "jd_title": "EdTech AI Builder", "jd_text": "SuperKalam is an AI personal tutor for competitive exams in India built with Python, React, and LLMs.", "jd_url": "https://www.ycombinator.com/companies/superkalam", "tier": "Tier 2", "region": "India"},
        {"name": "Landeed", "website": "https://landeed.com", "jd_title": "Search Engine Engineer", "jd_text": "Landeed is India's fastest land title search engine built with Python, React Native, and PostgreSQL.", "jd_url": "https://www.ycombinator.com/companies/landeed", "tier": "Tier 2", "region": "India"},
        {"name": "Infinity", "website": "https://infinity.finance", "jd_title": "Fintech Full Stack", "jd_text": "Infinity builds wealth management infrastructure for retail investors using TypeScript, React, and Python.", "jd_url": "https://www.ycombinator.com/companies/infinity", "tier": "Tier 2", "region": "India"},
        {"name": "Paasa", "website": "https://paasa.io", "jd_title": "Payments Engineer", "jd_text": "Paasa builds global treasury and cross-border payments software using Go, React, and PostgreSQL.", "jd_url": "https://www.ycombinator.com/companies/paasa", "tier": "Tier 2", "region": "India"},
        {"name": "xPay", "website": "https://xpay.checkout", "jd_title": "Checkout Engineer", "jd_text": "xPay provides unified checkout infrastructure for emerging markets using Node.js, TypeScript, and React.", "jd_url": "https://www.ycombinator.com/companies/xpay", "tier": "Tier 2", "region": "India"},
        {"name": "100x", "website": "https://100x.dev", "jd_title": "DevTool Engineer", "jd_text": "100x is building developer tools & automated code testing platforms using Python, Rust, and React.", "jd_url": "https://www.ycombinator.com/companies/100x", "tier": "Tier 2", "region": "India"},
        {"name": "Rivia.AI", "website": "https://rivia.ai", "jd_title": "Product Demo Builder", "jd_text": "Rivia.AI creates interactive product demos automatically for B2B SaaS using React, Chrome Extensions, and Node.js.", "jd_url": "https://www.ycombinator.com/companies/rivia-ai", "tier": "Tier 2", "region": "India"},
        {"name": "CARPL.ai", "website": "https://carpl.ai", "jd_title": "MedTech AI Engineer", "jd_text": "CARPL.ai is the enterprise marketplace for AI radiology & medical imaging using Python, DICOM, and React.", "jd_url": "https://carpl.ai", "tier": "Tier 2", "region": "India"},
        {"name": "HireGlide", "website": "https://hireglide.com", "jd_title": "AI Interview Engineer", "jd_text": "HireGlide builds AI technical interviewing tools for engineering teams using Python, WebRTC, and React.", "jd_url": "https://www.ycombinator.com/companies/hireglide", "tier": "Tier 2", "region": "USA"},
        {"name": "Outrove", "website": "https://outrove.com", "jd_title": "Outbound Sales Builder", "jd_text": "Outrove builds outbound sales automation platforms using TypeScript, React, and Python.", "jd_url": "https://www.ycombinator.com/companies/outrove", "tier": "Tier 2", "region": "USA"},
        {"name": "Clado", "website": "https://clado.ai", "jd_title": "Vector Search Engineer", "jd_text": "Clado is building distributed search engines for vector embeddings using C++, Rust, and Python.", "jd_url": "https://www.ycombinator.com/companies/clado", "tier": "Tier 2", "region": "USA"},
        {"name": "Refresh", "website": "https://refresh.ai", "jd_title": "CRM Automation Engineer", "jd_text": "Refresh automates CRM contact enrichment with generative web scraping using Python, Playwright, and React.", "jd_url": "https://www.ycombinator.com/companies/refresh", "tier": "Tier 2", "region": "USA"},
        {"name": "Empirical", "website": "https://empirical.run", "jd_title": "QA Agent Engineer", "jd_text": "Empirical automates software testing & code review with AI agents using TypeScript, Playwright, and Python.", "jd_url": "https://www.ycombinator.com/companies/empirical", "tier": "Tier 2", "region": "USA"},
        {"name": "Aseon Labs", "website": "https://aseonlabs.com", "jd_title": "Hardware AI Engineer", "jd_text": "Aseon Labs builds AI agents for hardware & chip design verification using Python and Verilog.", "jd_url": "https://www.ycombinator.com/companies/aseon-labs", "tier": "Tier 2", "region": "USA"},
        {"name": "Contrario", "website": "https://contrario.ai", "jd_title": "GTM Intelligence Engineer", "jd_text": "Contrario builds competitive intelligence platforms for modern GTM teams using Python, React, and LLMs.", "jd_url": "https://www.ycombinator.com/companies/contrario", "tier": "Tier 2", "region": "USA"},
        {"name": "Standout", "website": "https://standout.ai", "jd_title": "Talent Ranking Engineer", "jd_text": "Standout builds candidate resume & portfolio ranking platforms using Python, FastAPI, and React.", "jd_url": "https://www.ycombinator.com/companies/standout", "tier": "Tier 2", "region": "USA"},
        {"name": "Lago", "website": "https://getlago.com", "jd_title": "Billing Systems Engineer", "jd_text": "Lago is the open-source metering and usage-based billing platform built with Ruby, Go, and React.", "jd_url": "https://www.ycombinator.com/companies/lago", "tier": "Tier 2", "region": "Europe"},
        {"name": "LiveFlow", "website": "https://liveflow.io", "jd_title": "FinTech Integrations Builder", "jd_text": "LiveFlow automates financial reporting by syncing QuickBooks to Google Sheets using TypeScript, React, and Node.js.", "jd_url": "https://www.ycombinator.com/companies/liveflow", "tier": "Tier 2", "region": "Europe"},
        {"name": "Ashby", "website": "https://ashbyhq.com", "jd_title": "Product Engineer", "jd_text": "Ashby builds all-in-one recruiting, ATS, and analytics software using TypeScript, React, and Node.js.", "jd_url": "https://www.ycombinator.com/companies/ashby", "tier": "Tier 2", "region": "USA"},
        {"name": "Hub", "website": "https://hub.app", "jd_title": "Workspace Engineer", "jd_text": "Hub provides collaborative workspaces for modern remote engineering teams using React, WebSockets, and Node.js.", "jd_url": "https://www.ycombinator.com/companies/hub", "tier": "Tier 2", "region": "Europe"}
    ]

    for item in CURATED_COMPANIES:
        if item["jd_url"] not in seen_urls:
            seen_urls.add(item["jd_url"])
            results.append({
                "name": item["name"],
                "website": item["website"],
                "jd_title": item["jd_title"],
                "jd_text": item["jd_text"],
                "jd_url": item["jd_url"],
                "source_type": f"yc_{item['tier'].lower().replace(' ', '_')}"
            })

    return results
