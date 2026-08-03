"""Stage 1: create users and user_profiles tables

Revision ID: 0001
Revises: None
Create Date: 2026-07-23
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from pgvector.sqlalchemy import Vector

# revision identifiers
revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Enable pgvector extension
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    # Create users table — minimal shape for stage 1 (FK integrity only)
    op.create_table(
        "users",
        sa.Column(
            "id",
            sa.dialects.postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("email", sa.Text(), unique=True, nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )

    # Create user_profiles table — ARCHITECTURE.md §2 + notable_projects
    op.create_table(
        "user_profiles",
        sa.Column(
            "id",
            sa.dialects.postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "user_id",
            sa.dialects.postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            unique=True,
            nullable=False,
        ),
        sa.Column("raw_resume_text", sa.Text(), nullable=False),
        sa.Column(
            "parsed_skills",
            sa.dialects.postgresql.ARRAY(sa.Text()),
            nullable=False,
        ),
        sa.Column(
            "parsed_domains",
            sa.dialects.postgresql.ARRAY(sa.Text()),
            nullable=False,
        ),
        sa.Column("parsed_project_summary", sa.Text(), nullable=False),
        sa.Column(
            "notable_projects",
            sa.dialects.postgresql.JSONB(),
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
        sa.Column("embedding_vector", Vector(384), nullable=False),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )


def downgrade() -> None:
    op.drop_table("user_profiles")
    op.drop_table("users")
    op.execute("DROP EXTENSION IF EXISTS vector")
