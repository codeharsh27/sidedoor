"""Base classes and schemas for Stage 2 collectors."""

from dataclasses import dataclass
from datetime import datetime
from typing import Protocol


@dataclass
class EvidenceItemCreate:
    """Data required to create a new EvidenceItem."""

    source_type: str  # "hacker_news" | "reddit" | "github_issue" | "x_post"
    source_url: str
    raw_text: str
    author_handle: str | None = None
    posted_at: datetime | None = None


@dataclass
class JobPostingCreate:
    """Data required to create a new JobPosting."""

    title: str
    raw_text: str
    posted_at: datetime | None = None


class CollectorProtocol(Protocol):
    """Protocol that all evidence/data collectors must implement."""

    @property
    def source_type(self) -> str:
        """The source type identifier (e.g. 'reddit', 'hacker_news')."""
        ...

    async def collect(self, company_name: str, company_url: str, github_repo_url: str | None = None, careers_page_url: str | None = None) -> list[EvidenceItemCreate]:
        """Collect raw evidence data for a given company."""
        ...
