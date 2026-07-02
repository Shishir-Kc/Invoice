"""add access control fields, invite and session tables

Revision ID: d1a1b2c3d4e5
Revises: c0ffee123456
Create Date: 2026-06-30 13:00:00.000000

"""
from typing import Sequence, Union

import sqlmodel
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "d1a1b2c3d4e5"
down_revision: Union[str, Sequence[str], None] = "c0ffee123456"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Access control on user (unofficial members).
    op.add_column(
        "user",
        sa.Column("access_expires_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "user",
        sa.Column("is_kicked", sa.Boolean(), nullable=False, server_default=sa.false()),
    )

    op.create_table(
        "invite",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("token", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("created_by", sa.Uuid(), nullable=False),
        sa.Column("access_duration_seconds", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("use_count", sa.Integer(), nullable=False, server_default="0"),
        sa.ForeignKeyConstraint(["created_by"], ["user.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_invite_token", "invite", ["token"], unique=True)

    op.create_table(
        "session",
        sa.Column("token", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["user.id"]),
        sa.PrimaryKeyConstraint("token"),
    )
    op.create_index("ix_session_user_id", "session", ["user_id"])


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index("ix_session_user_id", table_name="session")
    op.drop_table("session")
    op.drop_index("ix_invite_token", table_name="invite")
    op.drop_table("invite")
    op.drop_column("user", "is_kicked")
    op.drop_column("user", "access_expires_at")
