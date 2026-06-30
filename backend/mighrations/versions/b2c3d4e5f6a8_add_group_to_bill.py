"""add group column to bill for unofficial member visibility

Revision ID: b2c3d4e5f6a8
Revises: a1b2c3d4e5f7
Create Date: 2026-06-30 15:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel


# revision identifiers, used by Alembic.
revision: str = "b2c3d4e5f6a8"
down_revision: Union[str, Sequence[str], None] = "a1b2c3d4e5f7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        "bill",
        sa.Column(
            "group",
            sqlmodel.sql.sqltypes.AutoString(),
            nullable=False,
            server_default="unofficial",
        ),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("bill", "group")
