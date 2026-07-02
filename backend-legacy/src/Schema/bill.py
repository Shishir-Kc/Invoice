import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional, List
from sqlmodel import SQLModel, Field, Relationship


class User(SQLModel, table=True):
    id: uuid.UUID = Field(primary_key=True, default_factory=uuid.uuid4)
    name: str
    email: str = Field(unique=True, index=True)
    # HYPER (Arcademia) account linkage. Saved on first successful HYPER login.
    # A user with a hyper_id is "official" (admin): permanent access and the
    # only ones who can manage other members.
    hyper_id: Optional[str] = Field(default=None, unique=True, index=True)
    account_type: Optional[str] = Field(default=None)

    # Access control for unofficial (invite-joined) members.
    # access_expires_at = None means permanent access. is_kicked (a ban)
    # revokes access without deleting the account. Official (hyper_id) users always
    # have access regardless of these fields.
    access_expires_at: Optional[datetime] = Field(default=None)
    is_kicked: bool = Field(default=False)
    # Local password for unofficial (invite-joined) members so they can log
    # back in via the dedicated unofficial login endpoint. Official (HYPER)
    # members never set this — they authenticate via HYPER. Stored as a
    # self-describing scrypt hash, never plaintext.
    password_hash: Optional[str] = Field(default=None)
    # Visibility group assigned to an unofficial member when they're added.
    # Controls which bills they can see:
    #  - "hyper":      all bills created by official members
    #  - "unofficial": bills that include at least one unofficial member
    #  - "private":    only bills they are a member of
    # Official members always see every bill regardless of this field.
    group: str = Field(default="unofficial")

    bill_members: List["BillMember"] = Relationship(back_populates="user")
    expenses_paid: List["Expense"] = Relationship(back_populates="paid_by_user")



class Bill(SQLModel, table=True):
    id: uuid.UUID = Field(primary_key=True, default_factory=uuid.uuid4)
    title: str
    description: str = Field(default="")
    status: str = Field(default="open")
    # Who created the bill. Used by visibility: unofficial members in the
    # "hyper" group see bills created by officials.
    created_by: Optional[uuid.UUID] = Field(default=None, foreign_key="user.id")
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    
    bill_members: List["BillMember"] = Relationship(back_populates="bill")
    expenses: List["Expense"] = Relationship(back_populates="bill")




class BillMember(SQLModel, table=True):
    id: uuid.UUID = Field(primary_key=True, default_factory=uuid.uuid4)

    bill_id: uuid.UUID = Field(foreign_key="bill.id")
    user_id: uuid.UUID = Field(foreign_key="user.id")


    bill: "Bill" = Relationship(back_populates="bill_members")
    user: "User" = Relationship(back_populates="bill_members")

    expenses_paid: List["Expense"] = Relationship(back_populates="paid_by_member")



class Expense(SQLModel, table=True):
    id: uuid.UUID = Field(primary_key=True, default_factory=uuid.uuid4)
    description: str
    amount: Decimal = Field(default=Decimal("0.01"), decimal_places=2, max_digits=12)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    bill_id: uuid.UUID = Field(foreign_key="bill.id")
    paid_by_member_id: uuid.UUID = Field(foreign_key="billmember.id")

    paid_by_user_id: uuid.UUID = Field(foreign_key="user.id")

    bill: "Bill" = Relationship(back_populates="expenses")
    paid_by_member: "BillMember" = Relationship(back_populates="expenses_paid")
    paid_by_user: "User" = Relationship(back_populates="expenses_paid")
