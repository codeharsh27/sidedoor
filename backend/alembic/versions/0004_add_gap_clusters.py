"""Add gap_clusters table (Stage 3 — Clusterer + Ranker)

Revision ID: 0004
Revises: 0003
Create Date: 2026-07-28
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
# from pgvector.sqlalchemy import Vector

# revision identifiers
revision: str = "0004"
down_revision: Union[str, None] = "0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Ensure pgvector extension is available (idempotent)
    # op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    op.create_table(
        "gap_clusters",
        sa.Column(
            "id",
            sa.UUID(),
            nullable=False,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("company_id", sa.UUID(), nullable=False),
        sa.Column("label", sa.Text(), nullable=False),
        # 384-dim centroid vector — same dimension as all-MiniLM-L6-v2
        sa.Column("embedding_vector", sa.ARRAY(sa.Float()), nullable=False),
        # PostgreSQL UUID[] array — list of EvidenceItem IDs in this cluster
        sa.Column(
            "evidence_item_ids",
            sa.ARRAY(sa.UUID()),
            nullable=False,
            server_default=sa.text("'{}'::uuid[]"),
        ),
        sa.Column(
            "evidence_count",
            sa.Integer(),
            nullable=False,
            server_default="1",
        ),
        sa.Column(
            "recency_score",
            sa.Float(),
            nullable=False,
            server_default="0.0",
        ),
        sa.Column(
            "rank_score",
            sa.Float(),
            nullable=False,
            server_default="0.0",
        ),
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
            ["company_id"], ["companies.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    # Index for fast company-scoped lookups (most common query pattern)
    op.create_index(
        "ix_gap_clusters_company_id",
        "gap_clusters",
        ["company_id"],
    )

    # Index for ordering cards by rank_score (Stage 4+)
    op.create_index(
        "ix_gap_clusters_rank_score",
        "gap_clusters",
        ["rank_score"],
    )


def downgrade() -> None:
    op.drop_index("ix_gap_clusters_rank_score", table_name="gap_clusters")
    op.drop_index("ix_gap_clusters_company_id", table_name="gap_clusters")
    op.drop_table("gap_clusters")
