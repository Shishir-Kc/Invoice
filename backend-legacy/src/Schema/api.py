from datetime import datetime
from decimal import Decimal
from typing import Optional
from pydantic import BaseModel, EmailStr, Field


class ApiResponse(BaseModel):
    success: bool
    data: object | None = None
    message: str = ""


class PaginatedResponse(BaseModel):
    data: list
    total: int
    page: int
    pageSize: int
    totalPages: int


class MemberIn(BaseModel):
    id: str
    name: str
    email: EmailStr


class ExpenseIn(BaseModel):
    description: str = Field(max_length=200)
    amount: Decimal = Field(ge=0, max_digits=12, decimal_places=2)
    paidBy: str
    date: str = ""


class CreateBillRequest(BaseModel):
    title: str
    description: str = ""
    members: list[MemberIn]
    expenses: list[ExpenseIn]


class UpdateBillRequest(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    members: Optional[list[MemberIn]] = None
    expenses: Optional[list[ExpenseIn]] = None


class MemberOut(BaseModel):
    id: str
    name: str
    email: str = ""


class ExpenseOut(BaseModel):
    id: str
    description: str
    amount: float
    paidBy: str
    date: str = ""


class BillOut(BaseModel):
    id: str
    title: str
    description: str
    members: list[MemberOut]
    expenses: list[ExpenseOut]
    status: str
    createdAt: str
    updatedAt: str


# --- Members ---------------------------------------------------------------


class MemberCreate(BaseModel):
    name: str
    email: EmailStr
    group: str = "unofficial"  # hyper | unofficial | private


class MemberWithStatsOut(BaseModel):
    id: str
    name: str
    email: str = ""
    billCount: int = 0
    totalPaid: float = 0.0
    # Access management fields
    isOfficial: bool = False
    isKicked: bool = False
    accessExpiresAt: Optional[str] = None  # ISO datetime or null = permanent
    accessStatus: str = "active"  # active | expired | banned | permanent
    # Visibility group this unofficial member belongs to.
    group: str = "unofficial"  # hyper | unofficial | private


# --- Invite / join ---------------------------------------------------------


class DurationUnit(str):
    """One of: hour | day | week | year."""


class Duration(BaseModel):
    amount: int
    unit: str  # hour | day | week | year


class InviteResponse(BaseModel):
    token: str
    link: str
    accessDurationSeconds: int
    createdAt: str


class InviteCreateRequest(BaseModel):
    """Body for creating an invite link."""
    amount: int = Field(ge=1, le=100)
    unit: str  # hour | day | week | year
    group: str = "unofficial"  # hyper | unofficial | private (assigned to joiners)
    # Optional caps. If omitted, safe defaults are applied at creation
    # (expires in 7 days, single use). Set expiresInSeconds=null and
    # maxUses=null together to create an unlimited, non-expiring invite
    # (officials only; discouraged).
    expiresInSeconds: Optional[int] = Field(default=7 * 86400, ge=1, le=365 * 86400)
    maxUses: Optional[int] = Field(default=1, ge=1, le=1000)


class JoinRequest(BaseModel):
    token: str
    name: str = Field(min_length=1, max_length=100)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class JoinResponse(BaseModel):
    token: str  # local session token to use as Bearer
    user: dict


class UnofficialLoginRequest(BaseModel):
    """Credentials for an unofficial (invite-joined) member to log back in."""
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


# --- Notifications ---------------------------------------------------------


class NotificationOut(BaseModel):
    id: str
    type: str
    title: str
    description: str
    billId: Optional[str] = None
    read: bool
    createdAt: str


class NotificationUpdate(BaseModel):
    read: bool


class NotificationCreate(BaseModel):
    type: str
    title: str
    description: str = ""
    billId: Optional[str] = None


# --- User settings ---------------------------------------------------------


class UserSettingOut(BaseModel):
    defaultCurrency: str


class UserSettingUpdate(BaseModel):
    defaultCurrency: str
