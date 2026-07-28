"""Add Stage 4 tables (fixability_flags, role_matches, cards)

Revision ID: 0005
Revises: 0004
Create Date: 2026-07-28
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers
revision: str = "0005"
down_revision: Union[str, None] = "0004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create fixability_flags table
    op.create_table(
        "fixability_flags",
        sa.Column(
            "id",
            sa.UUID(),
            nullable=False,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("gap_cluster_id", sa.UUID(), nullable=False),
        sa.Column("company_id", sa.UUID(), nullable=False),
        sa.Column("has_public_repo", sa.Boolean(), nullable=False),
        sa.Column("has_public_api", sa.Boolean(), nullable=False),
        sa.Column("has_ui_surface", sa.Boolean(), nullable=False),
        sa.Column("is_buildable", sa.Boolean(), nullable=False),
        sa.Column(
            "computed_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.ForeignKeyConstraint(
            ["gap_cluster_id"], ["gap_clusters.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["company_id"], ["companies.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("gap_cluster_id", name="uq_fixability_flags_gap_cluster_id"),
    )

    # 2. Create role_matches table
    op.create_table(
        "role_matches",
        sa.Column(
            "id",
            sa.UUID(),
            nullable=False,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("gap_cluster_id", sa.UUID(), nullable=False),
        sa.Column("job_posting_id", sa.UUID(), nullable=False),
        sa.Column("match_score", sa.Float(), nullable=False),
        sa.Column("match_reason", sa.Text(), nullable=False),
        sa.ForeignKeyConstraint(
            ["gap_cluster_id"], ["gap_clusters.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["job_posting_id"], ["job_postings.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "gap_cluster_id", "job_posting_id", name="uq_role_matches_cluster_job"
        ),
    )

    # 3. Create cards table
    op.create_table(
        "cards",
        sa.Column(
            "id",
            sa.UUID(),
            nullable=False,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("gap_cluster_id", sa.UUID(), nullable=False),
        sa.Column("company_id", sa.UUID(), nullable=False),
        sa.Column("profile_match_score", sa.Float(), nullable=False),
        sa.Column("fixability_flag_id", sa.UUID(), nullable=True),
        sa.Column("role_match_id", sa.UUID(), nullable=True),
        sa.Column("shown_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("status", sa.Text(), nullable=False, server_default="new"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["gap_cluster_id"], ["gap_clusters.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["company_id"], ["companies.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["fixability_flag_id"], ["fixability_flags.id"], ondelete="SET NULL"
        ),
        sa.ForeignKeyConstraint(
            ["role_match_id"], ["role_matches.id"], ondelete="SET NULL"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "gap_cluster_id", name="uq_cards_user_cluster"),
    )

    # Indexes for cards table
    op.create_index("ix_cards_user_id", "cards", ["user_id"])
    op.create_index("ix_cards_company_id", "cards", ["company_id"])
    op.create_index("ix_cards_status", "cards", ["status"])
    op.create_index("ix_cards_profile_match_score", "cards", ["profile_match_score"])


def downgrade() -> None:
    op.drop_index("ix_cards_profile_match_score", table_name="cards")
    op.drop_index("ix_cards_status", table_name="cards")
    op.drop_index("ix_cards_company_id", table_name="cards")
    op.drop_index("ix_cards_user_id", table_name="cards")
    op.drop_table("cards")
    op.drop_table("role_matches")
    op.drop_table("fixability_flags")
