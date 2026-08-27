"""add_accelerator_tables

Revision ID: a473a3346f31
Revises: 8a2f3c3a9d3e
Create Date: 2026-08-27 02:35:34.231802
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


# revision identifiers
revision: str = 'a473a3346f31'
down_revision: Union[str, None] = '8a2f3c3a9d3e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. pm_company_feed — curated seed table, no user FK, no RLS needed
    op.create_table(
        "pm_company_feed",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("company_name", sa.Text(), nullable=False),
        sa.Column("company_url", sa.Text(), nullable=False),
        sa.Column("role_title", sa.Text(), nullable=False),
        sa.Column("apply_url", sa.Text(), nullable=True),
        sa.Column("feed_type", sa.Text(), nullable=False),
        sa.Column("source", sa.Text(), nullable=False),
        sa.Column("vc_backed", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("vc_name", sa.Text(), nullable=True),
        sa.Column("india_remote", sa.Text(), nullable=False, server_default=sa.text("'india'")),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("added_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("idx_feed_active_type", "pm_company_feed", ["is_active", "feed_type"])

    # 2. accelerator_progress — per-user daily state, FK to existing public.users
    op.create_table(
        "accelerator_progress",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", sa.dialects.postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("day_number", sa.Integer(), nullable=False),
        sa.Column("phase", sa.Text(), nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("blocks_required", sa.dialects.postgresql.ARRAY(sa.Text()), nullable=False),
        sa.Column("blocks_done", sa.dialects.postgresql.ARRAY(sa.Text()), nullable=False, server_default=sa.text("ARRAY[]::text[]")),
        sa.Column("streak_count", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("streak_broken", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("eod_submitted", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("eod_reflection", sa.Text(), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("user_id", "day_number", name="uq_acc_progress_user_day"),
    )
    op.create_index("idx_acc_progress_user_day", "accelerator_progress", ["user_id", "day_number"])
    op.create_index("idx_acc_progress_user_date", "accelerator_progress", ["user_id", "date"])

    # 3. accelerator_block_logs — individual block start/complete records
    op.create_table(
        "accelerator_block_logs",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", sa.dialects.postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("day_number", sa.Integer(), nullable=False),
        sa.Column("block_type", sa.Text(), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("submitted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("time_spent_sec", sa.Integer(), nullable=True),
        sa.Column("answer_text", sa.Text(), nullable=True),
        sa.Column("self_score", sa.Integer(), nullable=True),
        sa.Column("rubric_feedback", sa.Text(), nullable=True),
        sa.Column("was_late", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.UniqueConstraint("user_id", "day_number", "block_type", name="uq_block_log_user_day_block"),
    )
    op.create_index("idx_acc_block_user_day", "accelerator_block_logs", ["user_id", "day_number"])

    # 4. accelerator_network_log
    op.create_table(
        "accelerator_network_log",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", sa.dialects.postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("day_number", sa.Integer(), nullable=False),
        sa.Column("action_index", sa.Integer(), nullable=False),
        sa.Column("action_type", sa.Text(), nullable=False),
        sa.Column("target_name", sa.Text(), nullable=True),
        sa.Column("target_url", sa.Text(), nullable=True),
        sa.Column("completed", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
    )

    # 5. accelerator_apply_log
    op.create_table(
        "accelerator_apply_log",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", sa.dialects.postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("day_number", sa.Integer(), nullable=False),
        sa.Column("company_feed_id", sa.dialects.postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("company_name", sa.Text(), nullable=False),
        sa.Column("apply_type", sa.Text(), nullable=False),
        sa.Column("portal_url", sa.Text(), nullable=True),
        sa.Column("applied", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("applied_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
    )

    # RLS — separate policies for INSERT and SELECT/UPDATE/DELETE
    user_tables = [
        "accelerator_progress",
        "accelerator_block_logs",
        "accelerator_network_log",
        "accelerator_apply_log",
    ]
    for t in user_tables:
        op.execute(f"ALTER TABLE public.{t} ENABLE ROW LEVEL SECURITY;")
        op.execute(f"""
            DO $$
            BEGIN
                IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'auth') THEN
                    EXECUTE 'CREATE POLICY "{t}_select" ON public.{t} FOR SELECT USING (auth.uid() = user_id);';
                    EXECUTE 'CREATE POLICY "{t}_insert" ON public.{t} FOR INSERT WITH CHECK (auth.uid() = user_id);';
                    EXECUTE 'CREATE POLICY "{t}_update" ON public.{t} FOR UPDATE USING (auth.uid() = user_id);';
                    EXECUTE 'CREATE POLICY "{t}_delete" ON public.{t} FOR DELETE USING (auth.uid() = user_id);';
                END IF;
            END $$;
        """)


def downgrade() -> None:
    user_tables = [
        "accelerator_apply_log",
        "accelerator_network_log",
        "accelerator_block_logs",
        "accelerator_progress",
    ]
    for t in user_tables:
        for policy in ["_select", "_insert", "_update", "_delete"]:
            op.execute(f"""
                DO $$ BEGIN
                    IF EXISTS (SELECT FROM pg_policies WHERE tablename='{t}' AND policyname='{t}{policy}') THEN
                        EXECUTE 'DROP POLICY IF EXISTS "{t}{policy}" ON public.{t}';
                    END IF;
                END $$;
            """)
    op.drop_table("accelerator_apply_log")
    op.drop_table("accelerator_network_log")
    op.drop_table("accelerator_block_logs")
    op.drop_table("accelerator_progress")
    op.drop_index("idx_feed_active_type", table_name="pm_company_feed")
    op.drop_table("pm_company_feed")
