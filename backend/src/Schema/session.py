import uuid
from datetime import datetime, timezone

from sqlmodel import SQLModel, Field


class Session(SQLModel, table=True):
    """Local session token for unofficial (invite-joined) members.

    Official members authenticate with their HYPER JWT; unofficial members
    authenticate with an opaque token stored here. Access is validated on
    every request against the user's `access_expires_at` / `is_kicked`.
    """

    token: str = Field(primary_key=True)
    user_id: uuid.UUID = Field(foreign_key="user.id", index=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
