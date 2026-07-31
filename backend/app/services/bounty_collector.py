"""
Bounty & Solo Hackathon Collector Service.

Reads backend/data/seed_bounties.json and provides curated paid opportunities for product engineers.
"""

import json
import logging
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

SEED_BOUNTIES_PATH = Path(__file__).parent.parent.parent / "data" / "seed_bounties.json"


def get_curated_bounties(bounty_type: str | None = None, tech_stack: str | None = None) -> list[dict[str, Any]]:
    """Retrieve list of curated product engineering bounties & solo hackathons."""
    if not SEED_BOUNTIES_PATH.exists():
        logger.warning("Seed bounties file not found at %s", SEED_BOUNTIES_PATH)
        return []

    try:
        with open(SEED_BOUNTIES_PATH, "r", encoding="utf-8") as f:
            items = json.load(f)
    except Exception as e:
        logger.error("Failed to read seed bounties: %s", e)
        return []

    filtered = items

    if bounty_type and bounty_type != "all":
        filtered = [b for b in filtered if b.get("type") == bounty_type]

    if tech_stack:
        t_lower = tech_stack.lower()
        filtered = [
            b for b in filtered
            if any(t_lower in s.lower() for s in b.get("tech_stack", []))
        ]

    return filtered
