import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlmodel import SQLModel, Field


class Notification(SQLModel, table=True):
    """Per-user notification feed entry.

    Notifications are generated server-side from real bill events (create,
    settle). Each row is scoped to a single recipient via ``user_id``; users
    only ever see their own notifications. Legacy rows created before this
    column existed have ``user_id = NULL`` and are not returned by the
    user-scoped queries (treated as orphans).
    """

    id: uuid.UUID = Field(primary_key=True, default_factory=uuid.uuid4)
    # bill_added | bill_settled | member_joined | payment_received
    type: str
    title: str
    description: str = Field(default="")
    bill_id: Optional[uuid.UUID] = Field(default=None, foreign_key="bill.id")
    # The user this notification belongs to. Scoped queries filter on this.
    user_id: Optional[uuid.UUID] = Field(default=None, foreign_key="user.id", index=True)
    read: bool = Field(default=False)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
