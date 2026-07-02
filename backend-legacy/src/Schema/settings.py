import uuid

from sqlmodel import SQLModel, Field


class UserSetting(SQLModel, table=True):
    """Per-user local preferences (e.g. default currency).

    Identity (name/email) stays with HYPER; only app preferences live here.
    """

    user_id: uuid.UUID = Field(primary_key=True, foreign_key="user.id")
    default_currency: str = Field(default="NPR")
