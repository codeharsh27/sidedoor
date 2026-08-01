"""
SQLAlchemy models for SideDoor.

Schema source: ARCHITECTURE.md §2.
Tables are added in stage order; do not introduce new tables without
checking ARCHITECTURE.md first.
"""

import uuid
from datetime import datetime, timezone

from pgvector.sqlalchemy import Vector
from sqlalchemy import Boolean, DateTime, ForeignKey, Text, text, UniqueConstraint
from sqlalchemy import Float, Integer
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
    name: Mapped[str | None] = mapped_column(Text, nullable=True)
    password_hash: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=text("now()"),
    )

    # Extended fields
    location: Mapped[str | None] = mapped_column(Text, nullable=True)
    years_experience: Mapped[str | None] = mapped_column(Text, nullable=True)
    current_role: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Relationships
    profile: Mapped["UserProfile | None"] = relationship(
        back_populates="user", uselist=False, lazy="selectin"
    )
    skills: Mapped[list["UserSkill"]] = relationship(
        back_populates="user", cascade="all, delete-orphan", passive_deletes=True
    )
    projects: Mapped[list["UserProject"]] = relationship(
        back_populates="user", cascade="all, delete-orphan", passive_deletes=True
    )
    preferences: Mapped["UserPreference | None"] = relationship(
        back_populates="user", uselist=False, cascade="all, delete-orphan", passive_deletes=True
    )
    signals: Mapped[list["UserSignal"]] = relationship(
        back_populates="user", cascade="all, delete-orphan", passive_deletes=True
    )
    cards: Mapped[list["Card"]] = relationship(
        back_populates="user", cascade="all, delete-orphan", passive_deletes=True
    )


class UserSkill(Base):
    """
    user_skills table — Resume-extracted or user-stated skills.
    """

    __tablename__ = "user_skills"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=text("gen_random_uuid()"),
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    skill: Mapped[str] = mapped_column(Text, nullable=False)
    source: Mapped[str] = mapped_column(
        Text, nullable=False, default="resume"
    )  # 'resume' | 'stated'
    confidence: Mapped[float] = mapped_column(Float, nullable=False, default=1.0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=text("now()"),
    )

    user: Mapped["User"] = relationship(back_populates="skills")


class UserProject(Base):
    """
    user_projects table — Projects extracted from resume or added during onboarding.
    """

    __tablename__ = "user_projects"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=text("gen_random_uuid()"),
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    name: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    stack: Mapped[list[str]] = mapped_column(
        ARRAY(Text), nullable=False, default=list, server_default=text("'{}'")
    )
    status: Mapped[str] = mapped_column(
        Text, nullable=False, default="built"
    )  # 'built' | 'in_progress' | 'planned'
    is_production: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default=text("false")
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=text("now()"),
    )

    user: Mapped["User"] = relationship(back_populates="projects")


class UserPreference(Base):
    """
    user_preferences table — Frequently updated job search preferences.
    """

    __tablename__ = "user_preferences"

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
    target_roles: Mapped[list[str]] = mapped_column(
        ARRAY(Text), nullable=False, default=list, server_default=text("'{}'")
    )  # e.g. ['Product Engineer', 'Backend / Systems']
    company_stage: Mapped[list[str]] = mapped_column(
        ARRAY(Text), nullable=False, default=list, server_default=text("'{}'")
    )  # e.g. ['seed', 'series-a', 'yc-backed']
    industries: Mapped[list[str]] = mapped_column(
        ARRAY(Text), nullable=False, default=list, server_default=text("'{}'")
    )  # e.g. ['fintech', 'ai-native']
    location_pref: Mapped[list[str]] = mapped_column(
        ARRAY(Text), nullable=False, default=list, server_default=text("'{}'")
    )  # e.g. ['remote', 'india', 'onsite_india']
    comp_floor: Mapped[str | None] = mapped_column(Text, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=text("now()"),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    user: Mapped["User"] = relationship(back_populates="preferences")


class UserSignal(Base):
    """
    user_signals table — Learned or inferred signals from user interactions.
    """

    __tablename__ = "user_signals"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=text("gen_random_uuid()"),
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    signal: Mapped[str] = mapped_column(Text, nullable=False)
    weight: Mapped[float] = mapped_column(Float, nullable=False, default=1.0)
    source_event_id: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=text("now()"),
    )

    user: Mapped["User"] = relationship(back_populates="signals")


class UserProfile(Base):
    """
    user_profiles table — ARCHITECTURE.md §2 + sanctioned notable_projects addition.
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
    embedding_vector = mapped_column(ARRAY(Float), nullable=False)
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

    # Phase 2: VC Feed Metadata
    funding_stage: Mapped[str | None] = mapped_column(Text, nullable=True)  # "seed" | "series_a" | "series_b" | "growth"
    investor_tags: Mapped[list[str]] = mapped_column(
        ARRAY(Text), nullable=False, default=list, server_default=text("'{}'")
    )  # e.g. ["yc", "a16z", "peak_xv", "blume", "accel_india"]
    employee_count_approx: Mapped[int | None] = mapped_column(Integer, nullable=True)
    tech_stack_tags: Mapped[list[str]] = mapped_column(
        ARRAY(Text), nullable=False, default=list, server_default=text("'{}'")
    )  # e.g. ["typescript", "python", "go"]
    is_seed_list: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default=text("false")
    )
    seed_list_source: Mapped[str | None] = mapped_column(Text, nullable=True)  # e.g. "yc_w24", "a16z_portfolio"

    # Relationships
    evidence_items: Mapped[list["EvidenceItem"]] = relationship(
        back_populates="company", cascade="all, delete-orphan", passive_deletes=True
    )
    job_postings: Mapped[list["JobPosting"]] = relationship(
        back_populates="company", cascade="all, delete-orphan", passive_deletes=True
    )
    gap_clusters: Mapped[list["GapCluster"]] = relationship(
        back_populates="company", cascade="all, delete-orphan", passive_deletes=True
    )
    fixability_flags: Mapped[list["FixabilityFlag"]] = relationship(
        back_populates="company", cascade="all, delete-orphan", passive_deletes=True
    )
    cards: Mapped[list["Card"]] = relationship(
        back_populates="company", cascade="all, delete-orphan", passive_deletes=True
    )
    contacts: Mapped[list["Contact"]] = relationship(
        back_populates="company", cascade="all, delete-orphan", passive_deletes=True
    )
    health_signal: Mapped["CompanyHealthSignal | None"] = relationship(
        back_populates="company", uselist=False, cascade="all, delete-orphan", passive_deletes=True
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
    source_url: Mapped[str] = mapped_column(Text, nullable=False)
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

    __table_args__ = (
        UniqueConstraint("company_id", "source_url", name="uq_evidence_items_company_id_source_url"),
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


class GapCluster(Base):
    """
    gap_clusters table — ARCHITECTURE.md §2.

    One row per semantically-distinct complaint/request cluster found across
    a company's evidence items. Populated by Stage 3 (Clusterer + Ranker).

    Fields:
      - label: short human-readable label extracted by TF-IDF, e.g. "slow auth"
      - embedding_vector: centroid of all member evidence_item vectors (384-dim)
      - evidence_item_ids: UUIDs of all EvidenceItems in the cluster
      - evidence_count: len(evidence_item_ids); denormalised for fast ranking queries
      - recency_score: mean per-item recency decay score [0.0, 1.0]
      - rank_score: final formula-based score used for card ordering
    """

    __tablename__ = "gap_clusters"

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
    label: Mapped[str] = mapped_column(Text, nullable=False)
    embedding_vector = mapped_column(ARRAY(Float), nullable=False)
    evidence_item_ids: Mapped[list] = mapped_column(
        ARRAY(UUID(as_uuid=True)), nullable=False, default=list
    )
    evidence_count: Mapped[int] = mapped_column(
        Integer, nullable=False, default=1
    )
    recency_score: Mapped[float] = mapped_column(
        Float, nullable=False, default=0.0
    )
    rank_score: Mapped[float] = mapped_column(
        Float, nullable=False, default=0.0
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=text("now()"),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=text("now()"),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    # Relationships
    company: Mapped["Company"] = relationship(back_populates="gap_clusters")
    fixability_flag: Mapped["FixabilityFlag"] = relationship(
        back_populates="gap_cluster", uselist=False, cascade="all, delete-orphan", passive_deletes=True
    )
    role_matches: Mapped[list["RoleMatch"]] = relationship(
        back_populates="gap_cluster", cascade="all, delete-orphan", passive_deletes=True
    )
    cards: Mapped[list["Card"]] = relationship(
        back_populates="gap_cluster", cascade="all, delete-orphan", passive_deletes=True
    )


class FixabilityFlag(Base):
    """
    fixability_flags table — ARCHITECTURE.md §2.
    """

    __tablename__ = "fixability_flags"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=text("gen_random_uuid()"),
    )
    gap_cluster_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("gap_clusters.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )
    company_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("companies.id", ondelete="CASCADE"),
        nullable=False,
    )
    has_public_repo: Mapped[bool] = mapped_column(nullable=False, default=False)
    has_public_api: Mapped[bool] = mapped_column(nullable=False, default=False)
    has_ui_surface: Mapped[bool] = mapped_column(nullable=False, default=True)
    is_buildable: Mapped[bool] = mapped_column(nullable=False, default=True)
    computed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=text("now()"),
    )

    # Relationships
    gap_cluster: Mapped["GapCluster"] = relationship(back_populates="fixability_flag")
    company: Mapped["Company"] = relationship(back_populates="fixability_flags")
    cards: Mapped[list["Card"]] = relationship(
        back_populates="fixability_flag", cascade="all, delete-orphan", passive_deletes=True
    )


class RoleMatch(Base):
    """
    role_matches table — ARCHITECTURE.md §2.
    """

    __tablename__ = "role_matches"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=text("gen_random_uuid()"),
    )
    gap_cluster_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("gap_clusters.id", ondelete="CASCADE"),
        nullable=False,
    )
    job_posting_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("job_postings.id", ondelete="CASCADE"),
        nullable=False,
    )
    match_score: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    match_reason: Mapped[str] = mapped_column(Text, nullable=False, default="")

    __table_args__ = (
        UniqueConstraint(
            "gap_cluster_id", "job_posting_id", name="uq_role_matches_cluster_job"
        ),
    )

    # Relationships
    gap_cluster: Mapped["GapCluster"] = relationship(back_populates="role_matches")
    job_posting: Mapped["JobPosting"] = relationship()
    cards: Mapped[list["Card"]] = relationship(
        back_populates="role_match", cascade="all, delete-orphan", passive_deletes=True
    )


class Card(Base):
    """
    cards table — ARCHITECTURE.md §2.
    """

    __tablename__ = "cards"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=text("gen_random_uuid()"),
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    gap_cluster_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("gap_clusters.id", ondelete="CASCADE"),
        nullable=False,
    )
    company_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("companies.id", ondelete="CASCADE"),
        nullable=False,
    )
    profile_match_score: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    fixability_flag_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("fixability_flags.id", ondelete="SET NULL"),
        nullable=True,
    )
    role_match_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("role_matches.id", ondelete="SET NULL"),
        nullable=True,
    )
    shown_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    status: Mapped[str] = mapped_column(
        Text, nullable=False, default="new", server_default=text("'new'")
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=text("now()"),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=text("now()"),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    __table_args__ = (
        UniqueConstraint("user_id", "gap_cluster_id", name="uq_cards_user_cluster"),
    )

    # Relationships
    user: Mapped["User"] = relationship(back_populates="cards")
    gap_cluster: Mapped["GapCluster"] = relationship(back_populates="cards")
    company: Mapped["Company"] = relationship(back_populates="cards")
    fixability_flag: Mapped["FixabilityFlag"] = relationship(back_populates="cards")
    role_match: Mapped["RoleMatch"] = relationship(back_populates="cards")
    outreach_drafts: Mapped[list["OutreachDraft"]] = relationship(
        back_populates="card", cascade="all, delete-orphan", passive_deletes=True
    )


class Contact(Base):
    """
    contacts table — ARCHITECTURE.md §2.

    One row per discovered contact at a company. Source types:
      - "github_profile": a public GitHub contributor profile URL
      - "linkedin_search": a generated LinkedIn search URL (never fetched)
      - "team_page": extracted from the company's own public /team or /about page

    Invariant: source_url is ALWAYS set. No contact row may exist without one.
    """

    __tablename__ = "contacts"

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
    name: Mapped[str | None] = mapped_column(Text, nullable=True)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    source_url: Mapped[str] = mapped_column(Text, nullable=False)
    contact_type: Mapped[str] = mapped_column(
        Text, nullable=False
    )  # "github_profile" | "linkedin_search" | "team_page"
    scraped_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=text("now()"),
    )

    __table_args__ = (
        UniqueConstraint(
            "company_id", "source_url", name="uq_contacts_company_source_url"
        ),
    )

    # Relationships
    company: Mapped["Company"] = relationship(back_populates="contacts")


class OutreachDraft(Base):
    """
    outreach_drafts table — Stage 6.

    Persists the scaffold outreach message for a (card, user) pair.
    The draft is a template with [TODO:] markers the user must fill in.
    Upserted on repeated calls — never creates duplicate rows.
    """

    __tablename__ = "outreach_drafts"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=text("gen_random_uuid()"),
    )
    card_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("cards.id", ondelete="CASCADE"),
        nullable=False,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    draft_text: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=text("now()"),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=text("now()"),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    __table_args__ = (
        UniqueConstraint(
            "card_id", "user_id", name="uq_outreach_drafts_card_user"
        ),
    )

    # Relationships
    card: Mapped["Card"] = relationship(back_populates="outreach_drafts")
    user: Mapped["User"] = relationship()


class CompanyHealthSignal(Base):
    """
    company_health_signals table — Phase 3 Scam & Health Vetting.
    """

    __tablename__ = "company_health_signals"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=text("gen_random_uuid()"),
    )
    company_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("companies.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )
    employee_count_linkedin: Mapped[int | None] = mapped_column(Integer, nullable=True)
    funding_disclosed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default=text("false"))
    funding_amount_usd: Mapped[int | None] = mapped_column(Integer, nullable=True)
    funding_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    lead_investor: Mapped[str | None] = mapped_column(Text, nullable=True)
    glassdoor_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    has_salary_in_job_postings: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default=text("false"))
    red_flag_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    green_flag_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    verdict: Mapped[str] = mapped_column(Text, nullable=False, default="limited_info")  # "verified_safe" | "high_risk" | "limited_info"
    green_flags: Mapped[list[str]] = mapped_column(ARRAY(Text), nullable=False, default=list, server_default=text("'{}'"))
    red_flags: Mapped[list[str]] = mapped_column(ARRAY(Text), nullable=False, default=list, server_default=text("'{}'"))
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    health_computed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=text("now()"),
    )

    # Relationships
    company: Mapped["Company"] = relationship(back_populates="health_signal")


class Application(Base):
    """
    applications table — Phase 5 Application Tracker.
    """

    __tablename__ = "applications"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=text("gen_random_uuid()"),
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    company_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("companies.id", ondelete="CASCADE"),
        nullable=False,
    )
    card_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("cards.id", ondelete="SET NULL"),
        nullable=True,
    )
    status: Mapped[str] = mapped_column(
        Text, nullable=False, default="researching"
    )  # "researching" | "building" | "reached_out" | "replied" | "interviewing" | "closed"
    demo_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    outreach_sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_reply_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=text("now()"),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=text("now()"),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    __table_args__ = (
        UniqueConstraint("user_id", "company_id", name="uq_user_company_application"),
    )

    # Relationships
    company: Mapped["Company"] = relationship()
    card: Mapped["Card | None"] = relationship()
    events: Mapped[list["ApplicationEvent"]] = relationship(
        back_populates="application", cascade="all, delete-orphan"
    )


class ApplicationEvent(Base):
    """
    application_events table — tracks timeline events for applications.
    """

    __tablename__ = "application_events"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=text("gen_random_uuid()"),
    )
    application_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("applications.id", ondelete="CASCADE"),
        nullable=False,
    )
    event_type: Mapped[str] = mapped_column(
        Text, nullable=False
    )  # "status_changed" | "demo_deployed" | "outreach_sent" | "reply_received" | "follow_up_sent"
    event_data: Mapped[dict | None] = mapped_column(JSONB, nullable=True, default=dict)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=text("now()"),
    )

    # Relationships
    application: Mapped["Application"] = relationship(back_populates="events")


