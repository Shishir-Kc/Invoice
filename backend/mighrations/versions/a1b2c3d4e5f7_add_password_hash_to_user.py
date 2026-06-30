"""add password_hash to user for unofficial member logins

Revision ID: a1b2c3d4e5f7
Revises: d1a1b2c3d4e5
Create Date: 2026-06-30 14:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel


# revision identifiers, used by Alembic.
revision: str = "a1b2c3d4e5f7"
down_revision: Union[str, Sequence[str], None] = "d1a1b2c3d4e5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        "user",
        sa.Column("password_hash", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("user", "password_hash")
