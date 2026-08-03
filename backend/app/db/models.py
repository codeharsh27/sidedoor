"""
SQLAlchemy models for SideDoor.

Schema source: ARCHITECTURE.md §2.
Only tables needed for stage 1 (resume parsing) are defined here.
Later stages will add their own tables to this file as they're built.
"""

import uuid
from datetime import datetime, timezone

from pgvector.sqlalchemy import Vector
from sqlalchemy import DateTime, ForeignKey, Text, text
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    """Base class for all SQLAlchemy models."""

    pass


class User(Base):
    """
    users table — ARCHITECTURE.md §2.

    Minimal shape for stage 1: just enough for FK integrity.
    Auth fields (password hash, OAuth tokens, etc.) are added when
    the auth flow is built (frontend/integration territory, not backend-pipeline).
    """

    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=text("gen_random_uuid()"),
    )
    email: Mapped[str] = mapped_column(Text, unique=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=text("now()"),
    )

    # Relationships
    profile: Mapped["UserProfile"] = relationship(
        back_populates="user", uselist=False, lazy="selectin"
    )


class UserProfile(Base):
    """
    user_profiles table — ARCHITECTURE.md §2 + sanctioned notable_projects addition.

    Fields:
      - raw_resume_text: the full extracted text from the uploaded resume/portfolio
      - parsed_skills: flat list of skills ["Python", "React", "PostgreSQL"]
      - parsed_domains: flat list of domains ["backend web dev", "data pipelines"]
      - parsed_project_summary: 2-3 sentence summary including seniority signal
      - notable_projects: structured list of 2-4 projects
            [{"title": "...", "description": "...", "tech_used": ["..."]}]
      - embedding_vector: 384-dim vector from all-MiniLM-L6-v2
    """

    __tablename__ = "user_profiles"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=text("gen_random_uuid()"),
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )
    raw_resume_text: Mapped[str] = mapped_column(Text, nullable=False)
    parsed_skills: Mapped[list[str]] = mapped_column(
        ARRAY(Text), nullable=False, default=list
    )
    parsed_domains: Mapped[list[str]] = mapped_column(
        ARRAY(Text), nullable=False, default=list
    )
    parsed_project_summary: Mapped[str] = mapped_column(Text, nullable=False)
    notable_projects: Mapped[dict] = mapped_column(JSONB, nullable=False, default=list)
    source_type: Mapped[str] = mapped_column(
        Text, nullable=False, default="text"
    )  # "pdf" | "docx" | "url" | "text" — how the profile was ingested
    embedding_vector = mapped_column(Vector(384), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=text("now()"),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    # Relationships
    user: Mapped["User"] = relationship(back_populates="profile")


class Company(Base):
    """
    companies table — ARCHITECTURE.md §2.
    """

    __tablename__ = "companies"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=text("gen_random_uuid()"),
    )
    name: Mapped[str] = mapped_column(Text, nullable=False)
    url: Mapped[str] = mapped_column(Text, nullable=False)
    github_repo_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    careers_page_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    ats_slug: Mapped[str | None] = mapped_column(Text, nullable=True)
    last_scanned_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    scan_status: Mapped[str] = mapped_column(
        Text, nullable=False, default="pending"
    )  # "pending" | "scanning" | "done" | "insufficient_signal"

    # Relationships
    evidence_items: Mapped[list["EvidenceItem"]] = relationship(
        back_populates="company", cascade="all, delete-orphan", passive_deletes=True
    )
    job_postings: Mapped[list["JobPosting"]] = relationship(
        back_populates="company", cascade="all, delete-orphan", passive_deletes=True
    )


class EvidenceItem(Base):
    """
    evidence_items table — ARCHITECTURE.md §2.
    """

    __tablename__ = "evidence_items"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=text("gen_random_uuid()"),
    )
    company_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("companies.id", ondelete="CASCADE"),
        nullable=False,
    )
    source_type: Mapped[str] = mapped_column(Text, nullable=False)  # "hacker_news" | "reddit" | "github_issue" | "x_post" | "job_posting"
    source_url: Mapped[str] = mapped_column(Text, unique=True, nullable=False)
    raw_text: Mapped[str] = mapped_column(Text, nullable=False)
    author_handle: Mapped[str | None] = mapped_column(Text, nullable=True)
    posted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    fetched_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=text("now()"),
    )

    # Relationships
    company: Mapped["Company"] = relationship(back_populates="evidence_items")


class JobPosting(Base):
    """
    job_postings table — ARCHITECTURE.md §2.
    """

    __tablename__ = "job_postings"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=text("gen_random_uuid()"),
    )
    company_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("companies.id", ondelete="CASCADE"),
        nullable=False,
    )
    title: Mapped[str] = mapped_column(Text, nullable=False)
    raw_text: Mapped[str] = mapped_column(Text, nullable=False)
    posted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    is_open: Mapped[bool] = mapped_column(
        nullable=False, default=True, server_default=text("true")
    )

    # Relationships
    company: Mapped["Company"] = relationship(back_populates="job_postings")
