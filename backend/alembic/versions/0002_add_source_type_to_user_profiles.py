"""Add source_type to user_profiles

Revision ID: 0002
Revises: 0001
Create Date: 2026-07-26
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers
revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "user_profiles",
        sa.Column(
            "source_type",
            sa.Text(),
            nullable=False,
            server_default=sa.text("'text'"),
        ),
    )


def downgrade() -> None:
    op.drop_column("user_profiles", "source_type")
