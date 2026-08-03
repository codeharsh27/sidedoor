"""Add name and password_hash to users

Revision ID: 0007
Revises: 0006
Create Date: 2026-07-29
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers
revision: str = "0007"
down_revision: Union[str, None] = "0006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "name",
            sa.Text(),
            nullable=True,
        ),
    )
    op.add_column(
        "users",
        sa.Column(
            "password_hash",
            sa.Text(),
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_column("users", "password_hash")
    op.drop_column("users", "name")
