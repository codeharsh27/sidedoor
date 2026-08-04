"""enable_rls_on_public_tables

Revision ID: 8a2f3c3a9d3e
Revises: 373c38625ac4
Create Date: 2026-08-05 04:20:00.000000
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


# revision identifiers
revision: str = '8a2f3c3a9d3e'
down_revision: Union[str, None] = '373c38625ac4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Enable Row Level Security (RLS) on all public tables to satisfy Supabase security requirements.
    # The backend uses a server-side DB connection (like postgres or service_role) that bypasses RLS,
    # so enabling this will secure the tables from public API access without breaking the app.
    
    tables_to_secure = [
        "alembic_version",
        "users",
        "user_profiles",
        "companies",
        "evidence_items",
        "job_postings",
        "gap_clusters",
        "opportunity_cards",
        "outreach_drafts",
        "health_checks",
        "url_check_results",
        "fixability_flags"
    ]
    
    # Safely enable RLS if the table exists
    for table in tables_to_secure:
        op.execute(f"""
            DO $$
            BEGIN
                IF EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_schema = 'public' 
                    AND table_name = '{table}'
                ) THEN
                    EXECUTE 'ALTER TABLE public.{table} ENABLE ROW LEVEL SECURITY;';
                END IF;
            END $$;
        """)


def downgrade() -> None:
    tables_to_secure = [
        "alembic_version",
        "users",
        "user_profiles",
        "companies",
        "evidence_items",
        "job_postings",
        "gap_clusters",
        "opportunity_cards",
        "outreach_drafts",
        "health_checks",
        "url_check_results",
        "fixability_flags"
    ]
    
    for table in tables_to_secure:
        op.execute(f"""
            DO $$
            BEGIN
                IF EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_schema = 'public' 
                    AND table_name = '{table}'
                ) THEN
                    EXECUTE 'ALTER TABLE public.{table} DISABLE ROW LEVEL SECURITY;';
                END IF;
            END $$;
        """)
