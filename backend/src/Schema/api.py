from datetime import datetime
from decimal import Decimal
from typing import Optional
from pydantic import BaseModel


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
    email: str = ""


class ExpenseIn(BaseModel):
    description: str
    amount: Decimal
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
