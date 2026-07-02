"""add hyper_id and account_type to user

Revision ID: f1a2c3d4e5f6
Revises: baebb5e7ca8c
Create Date: 2026-06-30 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel


# revision identifiers, used by Alembic.
revision: str = "f1a2c3d4e5f6"
down_revision: Union[str, Sequence[str], None] = "baebb5e7ca8c"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column("user", sa.Column("hyper_id", sqlmodel.sql.sqltypes.AutoString(), nullable=True))
    op.add_column("user", sa.Column("account_type", sqlmodel.sql.sqltypes.AutoString(), nullable=True))
    op.create_unique_constraint("uq_user_email", "user", ["email"])
    op.create_index("ix_user_hyper_id", "user", ["hyper_id"], unique=True)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index("ix_user_hyper_id", table_name="user")
    op.drop_constraint("uq_user_email", "user", type_="unique")
    op.drop_column("user", "account_type")
    op.drop_column("user", "hyper_id")
