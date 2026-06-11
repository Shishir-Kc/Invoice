import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from sqlmodel import Session, select, func

from dependency.db import session_dep
from Schema.bill import Bill, User, BillMember, Expense
from Schema.api import (
    ApiResponse,
    PaginatedResponse,
    CreateBillRequest,
    UpdateBillRequest,
    BillOut,
    MemberOut,
    ExpenseOut,
)

routers = APIRouter()


def _bill_to_out(bill: Bill) -> BillOut:
    members_out = []
    for bm in bill.bill_members:
        members_out.append(
            MemberOut(id=str(bm.id), name=bm.user.name, email=bm.user.email)
        )
    expenses_out = []
    for e in bill.expenses:
        expenses_out.append(
            ExpenseOut(
                id=str(e.id),
                description=e.description,
                amount=float(e.amount),
                paidBy=str(e.paid_by_member_id),
                date=e.created_at.strftime("%Y-%m-%d"),
            )
        )
    return BillOut(
        id=str(bill.id),
        title=bill.title,
        description=bill.description,
        members=members_out,
        expenses=expenses_out,
        status=bill.status,
        createdAt=bill.created_at.isoformat() if bill.created_at else "",
        updatedAt=bill.updated_at.isoformat() if bill.updated_at else "",
    )


@routers.post("", response_model=ApiResponse)
def create_bill(req: CreateBillRequest, session: session_dep):
    bill = Bill(title=req.title, description=req.description)
    session.add(bill)
    session.flush()

    client_id_to_bm_id: dict[str, uuid.UUID] = {}
    client_id_to_user_id: dict[str, uuid.UUID] = {}

    for m in req.members:
        user = session.exec(select(User).where(User.email == m.email)).first()
        if not user:
            user = User(name=m.name, email=m.email)
            session.add(user)
            session.flush()

        bm = BillMember(bill_id=bill.id, user_id=user.id)
        session.add(bm)
        session.flush()

        client_id_to_bm_id[m.id] = bm.id
        client_id_to_user_id[m.id] = user.id

    for e in req.expenses:
        bm_id = client_id_to_bm_id.get(e.paidBy)
        user_id = client_id_to_user_id.get(e.paidBy)
        if not bm_id or not user_id:
            raise HTTPException(status_code=400, detail=f"Unknown member id {e.paidBy} in expense")
        expense = Expense(
            description=e.description,
            amount=e.amount,
            bill_id=bill.id,
            paid_by_member_id=bm_id,
            paid_by_user_id=user_id,
            created_at=datetime.fromisoformat(e.date) if e.date else datetime.now(timezone.utc),
        )
        session.add(expense)

    session.commit()
    session.refresh(bill)

    return ApiResponse(success=True, data=_bill_to_out(bill).model_dump(), message="Bill created")


@routers.get("")
def list_bills(
    session: session_dep,
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    pageSize: int = Query(10, ge=1, le=100),
):
    query = select(Bill)
    if search:
        query = query.where(Bill.title.ilike(f"%{search}%"))
    query = query.order_by(Bill.created_at.desc())

    total = session.exec(select(func.count()).select_from(query.subquery())).one()
    total_pages = max(1, (total + pageSize - 1) // pageSize)

    bills = session.exec(query.offset((page - 1) * pageSize).limit(pageSize)).all()

    data = [_bill_to_out(b).model_dump() for b in bills]
    return PaginatedResponse(
        data=data, total=total, page=page, pageSize=pageSize, totalPages=total_pages
    )


@routers.get("/{bill_id}")
def get_bill(bill_id: uuid.UUID, session: session_dep):
    bill = session.get(Bill, bill_id)
    if not bill:
        raise HTTPException(status_code=404, detail="Bill not found")
    return _bill_to_out(bill).model_dump()


@routers.patch("/{bill_id}", response_model=ApiResponse)
def update_bill(bill_id: uuid.UUID, req: UpdateBillRequest, session: session_dep):
    bill = session.get(Bill, bill_id)
    if not bill:
        raise HTTPException(status_code=404, detail="Bill not found")

    if req.title is not None:
        bill.title = req.title
    if req.description is not None:
        bill.description = req.description
    if req.status is not None:
        bill.status = req.status

    if req.members is not None and req.expenses is not None:
        for e in bill.expenses:
            session.delete(e)
        for bm in bill.bill_members:
            session.delete(bm)
        session.flush()
        session.expire_all()

        client_id_to_bm_id: dict[str, uuid.UUID] = {}
        client_id_to_user_id: dict[str, uuid.UUID] = {}

        for m in req.members:
            user = session.exec(select(User).where(User.email == m.email)).first()
            if not user:
                user = User(name=m.name, email=m.email)
                session.add(user)
                session.flush()

            bm = BillMember(bill_id=bill.id, user_id=user.id)
            session.add(bm)
            session.flush()

            client_id_to_bm_id[m.id] = bm.id
            client_id_to_user_id[m.id] = user.id

        for e in req.expenses:
            bm_id = client_id_to_bm_id.get(e.paidBy)
            user_id = client_id_to_user_id.get(e.paidBy)
            if not bm_id or not user_id:
                raise HTTPException(status_code=400, detail=f"Unknown member id {e.paidBy} in expense")
            expense = Expense(
                description=e.description,
                amount=e.amount,
                bill_id=bill.id,
                paid_by_member_id=bm_id,
                paid_by_user_id=user_id,
                created_at=datetime.fromisoformat(e.date) if e.date else datetime.now(timezone.utc),
            )
            session.add(expense)

    bill.updated_at = datetime.now(timezone.utc)
    session.commit()
    session.refresh(bill)

    return ApiResponse(success=True, data=_bill_to_out(bill).model_dump(), message="Bill updated")


@routers.delete("/{bill_id}", response_model=ApiResponse)
def delete_bill(bill_id: uuid.UUID, session: session_dep):
    bill = session.get(Bill, bill_id)
    if not bill:
        raise HTTPException(status_code=404, detail="Bill not found")

    for e in bill.expenses:
        session.delete(e)
    for bm in bill.bill_members:
        session.delete(bm)
    session.delete(bill)
    session.commit()

    return ApiResponse(success=True, data=None, message="Bill deleted")


@routers.post("/{bill_id}/settle", response_model=ApiResponse)
def settle_bill(bill_id: uuid.UUID, session: session_dep):
    bill = session.get(Bill, bill_id)
    if not bill:
        raise HTTPException(status_code=404, detail="Bill not found")

    bill.status = "settled"
    bill.updated_at = datetime.now(timezone.utc)
    session.add(bill)
    session.commit()
    session.refresh(bill)

    return ApiResponse(success=True, data=_bill_to_out(bill).model_dump(), message="Bill settled")
