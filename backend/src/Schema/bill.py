import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional, List
from sqlmodel import SQLModel, Field, Relationship


class User(SQLModel, table=True):
    id: uuid.UUID = Field(primary_key=True, default_factory=uuid.uuid4)
    name: str
    email: str

    bill_members: List["BillMember"] = Relationship(back_populates="user")
    expenses_paid: List["Expense"] = Relationship(back_populates="paid_by_user")



class Bill(SQLModel, table=True):
    id: uuid.UUID = Field(primary_key=True, default_factory=uuid.uuid4)
    title: str
    description: str = Field(default="")
    status: str = Field(default="open")
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
