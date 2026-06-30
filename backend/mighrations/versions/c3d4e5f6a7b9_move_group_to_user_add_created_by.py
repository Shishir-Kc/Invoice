"""move group from bill to user/invite, add created_by to bill

Revision ID: c3d4e5f6a7b9
Revises: b2c3d4e5f6a8
Create Date: 2026-06-30 15:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel


# revision identifiers, used by Alembic.
revision: str = "c3d4e5f6a7b9"
down_revision: Union[str, Sequence[str], None] = "b2c3d4e5f6a8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Member visibility group (was previously on bill — moved to the member).
    op.add_column(
        "user",
        sa.Column("group", sqlmodel.sql.sqltypes.AutoString(), nullable=False, server_default="unofficial"),
    )
    op.add_column(
        "invite",
        sa.Column("group", sqlmodel.sql.sqltypes.AutoString(), nullable=False, server_default="unofficial"),
    )
    # Track who created each bill (for "hyper" group visibility).
    op.add_column(
        "bill",
        sa.Column("created_by", sa.Uuid(), nullable=True),
    )
    op.create_foreign_key("fk_bill_created_by_user", "bill", "user", ["created_by"], ["id"])
    # The bill-level group column is no longer used.
    op.drop_column("bill", "group")


def downgrade() -> None:
    """Downgrade schema."""
    op.add_column(
        "bill",
        sa.Column("group", sqlmodel.sql.sqltypes.AutoString(), nullable=False, server_default="unofficial"),
    )
    op.drop_constraint("fk_bill_created_by_user", "bill", type_="foreignkey")
    op.drop_column("bill", "created_by")
    op.drop_column("invite", "group")
    op.drop_column("user", "group")
