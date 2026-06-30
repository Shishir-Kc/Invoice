import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlmodel import SQLModel, Field


class Notification(SQLModel, table=True):
    """Global notification feed entry.

    Notifications are generated server-side from real bill events (create,
    settle). They are currently global rather than per-user, mirroring the
    existing bills model where all bills are visible to every authenticated
    user. Once bills become user-scoped, this should gain a `user_id` and be
    filtered by the current user.
    """

    id: uuid.UUID = Field(primary_key=True, default_factory=uuid.uuid4)
    # bill_added | bill_settled | member_joined | payment_received
    type: str
    title: str
    description: str = Field(default="")
    bill_id: Optional[uuid.UUID] = Field(default=None, foreign_key="bill.id")
    read: bool = Field(default=False)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
