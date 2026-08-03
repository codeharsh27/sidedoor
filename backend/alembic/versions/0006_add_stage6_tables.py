"""Add Stage 6 tables (contacts, outreach_drafts)

Revision ID: 0006
Revises: 0005
Create Date: 2026-07-28
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers
revision: str = "0006"
down_revision: Union[str, None] = "0005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create contacts table
    op.create_table(
        "contacts",
        sa.Column(
            "id",
            sa.UUID(),
            nullable=False,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("company_id", sa.UUID(), nullable=False),
        sa.Column("name", sa.Text(), nullable=True),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column("source_url", sa.Text(), nullable=False),
        sa.Column("contact_type", sa.Text(), nullable=False),
        sa.Column(
            "scraped_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.ForeignKeyConstraint(
            ["company_id"], ["companies.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "company_id", "source_url", name="uq_contacts_company_source_url"
        ),
    )

    op.create_index("ix_contacts_company_id", "contacts", ["company_id"])
    op.create_index("ix_contacts_contact_type", "contacts", ["contact_type"])

    # 2. Create outreach_drafts table
    op.create_table(
        "outreach_drafts",
        sa.Column(
            "id",
            sa.UUID(),
            nullable=False,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("card_id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("draft_text", sa.Text(), nullable=False),
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
            ["card_id"], ["cards.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "card_id", "user_id", name="uq_outreach_drafts_card_user"
        ),
    )

    op.create_index("ix_outreach_drafts_card_id", "outreach_drafts", ["card_id"])
    op.create_index("ix_outreach_drafts_user_id", "outreach_drafts", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_outreach_drafts_user_id", table_name="outreach_drafts")
    op.drop_index("ix_outreach_drafts_card_id", table_name="outreach_drafts")
    op.drop_table("outreach_drafts")

    op.drop_index("ix_contacts_contact_type", table_name="contacts")
    op.drop_index("ix_contacts_company_id", table_name="contacts")
    op.drop_table("contacts")
