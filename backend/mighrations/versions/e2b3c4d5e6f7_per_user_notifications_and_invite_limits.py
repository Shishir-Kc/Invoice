"""per-user notifications + invite expiry/max_uses

Revision ID: e2b3c4d5e6f7
Revises: c3d4e5f6a7b9
Create Date: 2026-06-30 15:00:00.000000

Security migration:
  - notification.user_id: scope notifications per user (fixes cross-user
    read/delete IDOR). Existing rows get NULL and are intentionally not
    returned by the user-scoped queries.
  - invite.expires_at: when the invite link itself becomes invalid.
  - invite.max_uses: cap on how many times a link may be used.
"""
from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "e2b3c4d5e6f7"
down_revision: Union[str, Sequence[str], None] = "c3d4e5f6a7b9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Per-user notifications.
    op.add_column(
        "notification",
        sa.Column("user_id", sa.Uuid(), nullable=True),
    )
    op.create_index(
        "ix_notification_user_id", "notification", ["user_id"], unique=False
    )
    op.create_foreign_key(
        "fk_notification_user_id_user",
        "notification",
        "user",
        ["user_id"],
        ["id"],
    )

    # Invite expiry + max uses.
    op.add_column(
        "invite",
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "invite",
        sa.Column("max_uses", sa.Integer(), nullable=True),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("invite", "max_uses")
    op.drop_column("invite", "expires_at")

    op.drop_constraint(
        "fk_notification_user_id_user", "notification", type_="foreignkey"
    )
    op.drop_index("ix_notification_user_id", table_name="notification")
    op.drop_column("notification", "user_id")
