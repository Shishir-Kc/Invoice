import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from sqlmodel import Session, select, func

from dependency.db import session_dep
from dependency.current_user import current_user_dep
from dependency.access import is_official
from Schema.bill import Bill, User, BillMember, Expense
from Schema.notification import Notification
from Schema.api import (
    ApiResponse,
    PaginatedResponse,
    CreateBillRequest,
    UpdateBillRequest,
    BillOut,
    MemberOut,
    ExpenseOut,
)
from api.v1.notifications import push_notification

routers = APIRouter()


def _can_mutate_bill(bill: Bill, user: User) -> bool:
    """Only the bill's creator (or any official) may edit/delete/settle it."""
    if is_official(user):
        return True
    return bill.created_by is not None and bill.created_by == user.id


def _bill_recipient_ids(bill: Bill) -> list:
    """Distinct user ids that should be notified about a bill event."""
    ids = {bm.user_id for bm in bill.bill_members}
    if bill.created_by is not None:
        ids.add(bill.created_by)
    return list(ids)


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
def create_bill(req: CreateBillRequest, session: session_dep, user: current_user_dep):
    bill = Bill(title=req.title, description=req.description, created_by=user.id)
    session.add(bill)
    session.flush()

    client_id_to_bm_id: dict[str, uuid.UUID] = {}
    client_id_to_user_id: dict[str, uuid.UUID] = {}

    for m in req.members:
        member_user = session.exec(select(User).where(User.email == m.email)).first()
        if not member_user:
            # Only official members may mint new User rows (prevents any
            # authenticated user from pre-claiming arbitrary emails / polluting
            # the member directory / shadow-creating accounts). Unofficial
            # members must reference users that already exist.
            if not is_official(user):
                raise HTTPException(
                    status_code=400,
                    detail=f"No member with email {m.email}. Ask an administrator to add them first.",
                )
            member_user = User(name=m.name, email=m.email)
            session.add(member_user)
            session.flush()

        bm = BillMember(bill_id=bill.id, user_id=member_user.id)
        session.add(bm)
        session.flush()

        client_id_to_bm_id[m.id] = bm.id
        client_id_to_user_id[m.id] = member_user.id

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

    # Real per-recipient notification: a bill was created.
    total = sum(float(e.amount) for e in req.expenses)
    push_notification(
        session,
        user_ids=_bill_recipient_ids(bill),
        type="bill_added",
        title="New Bill Created",
        description=f'"{bill.title}" created — NPR {total:.2f} total.',
        bill_id=bill.id,
    )
    session.commit()

    return ApiResponse(success=True, data=_bill_to_out(bill).model_dump(), message="Bill created")


@routers.get("")
def list_bills(
    session: session_dep,
    user: current_user_dep,
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    pageSize: int = Query(10, ge=1, le=100),
):
    query = select(Bill)
    if search:
        query = query.where(Bill.title.ilike(f"%{search}%"))

    # Visibility filtering for unofficial members, based on THEIR group.
    # Officials see everything.
    #   hyper      -> bills created by official members
    #   unofficial -> bills that include at least one unofficial member
    #   private    -> only bills the viewer is a member of
    if not is_official(user):
        g = (user.group or "unofficial")
        if g == "private":
            query = query.where(
                Bill.id.in_(select(BillMember.bill_id).where(BillMember.user_id == user.id))
            )
        elif g == "hyper":
            official_ids = select(User.id).where(User.hyper_id.is_not(None))
            query = query.where(Bill.created_by.in_(official_ids))
        else:  # unofficial
            unofficial_member_bills = (
                select(BillMember.bill_id)
                .join(User, BillMember.user_id == User.id)
                .where(User.hyper_id.is_(None))
            )
            query = query.where(Bill.id.in_(unofficial_member_bills))

    query = query.order_by(Bill.created_at.desc())

    total = session.exec(select(func.count()).select_from(query.subquery())).one()
    total_pages = max(1, (total + pageSize - 1) // pageSize)

    bills = session.exec(query.offset((page - 1) * pageSize).limit(pageSize)).all()

    data = [_bill_to_out(b).model_dump() for b in bills]
    return PaginatedResponse(
        data=data, total=total, page=page, pageSize=pageSize, totalPages=total_pages
    )


@routers.get("/{bill_id}")
def get_bill(bill_id: uuid.UUID, session: session_dep, user: current_user_dep):
    bill = session.get(Bill, bill_id)
    if not bill:
        raise HTTPException(status_code=404, detail="Bill not found")
    # Unofficial members may only open bills their group allows. Officials see all.
    if not is_official(user):
        g = (user.group or "unofficial")
        is_member = any(bm.user_id == user.id for bm in bill.bill_members)
        creator = session.get(User, bill.created_by) if bill.created_by else None
        creator_official = bool(creator and creator.hyper_id)
        has_unofficial_member = any(not bm.user.hyper_id for bm in bill.bill_members)
        allowed = (
            (g == "hyper" and creator_official)
            or (g == "unofficial" and has_unofficial_member)
            or (g == "private" and is_member)
        )
        if not allowed:
            raise HTTPException(status_code=403, detail="You don't have access to this bill")
    return _bill_to_out(bill).model_dump()


@routers.patch("/{bill_id}", response_model=ApiResponse)
def update_bill(bill_id: uuid.UUID, req: UpdateBillRequest, session: session_dep, user: current_user_dep):
    bill = session.get(Bill, bill_id)
    if not bill:
        raise HTTPException(status_code=404, detail="Bill not found")
    if not _can_mutate_bill(bill, user):
        raise HTTPException(status_code=403, detail="You don't have permission to edit this bill")

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
                if not is_official(user):
                    raise HTTPException(
                        status_code=400,
                        detail=f"No member with email {m.email}. Ask an administrator to add them first.",
                    )
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
def delete_bill(bill_id: uuid.UUID, session: session_dep, user: current_user_dep):
    bill = session.get(Bill, bill_id)
    if not bill:
        raise HTTPException(status_code=404, detail="Bill not found")
    if not _can_mutate_bill(bill, user):
        raise HTTPException(status_code=403, detail="You don't have permission to delete this bill")

    for e in bill.expenses:
        session.delete(e)
    for bm in bill.bill_members:
        session.delete(bm)
    # Remove notifications referencing this bill (no FK cascade configured).
    for n in session.exec(select(Notification).where(Notification.bill_id == bill.id)).all():
        session.delete(n)
    session.delete(bill)
    session.commit()

    return ApiResponse(success=True, data=None, message="Bill deleted")


@routers.post("/{bill_id}/settle", response_model=ApiResponse)
def settle_bill(bill_id: uuid.UUID, session: session_dep, user: current_user_dep):
    bill = session.get(Bill, bill_id)
    if not bill:
        raise HTTPException(status_code=404, detail="Bill not found")
    if not _can_mutate_bill(bill, user):
        raise HTTPException(status_code=403, detail="You don't have permission to settle this bill")

    bill.status = "settled"
    bill.updated_at = datetime.now(timezone.utc)
    session.add(bill)
    session.commit()
    session.refresh(bill)

    # Real per-recipient notification: a bill was settled.
    push_notification(
        session,
        user_ids=_bill_recipient_ids(bill),
        type="bill_settled",
        title="Bill Settled",
        description=f'"{bill.title}" has been fully settled. Everyone is paid up.',
        bill_id=bill.id,
    )
    session.commit()

    return ApiResponse(success=True, data=_bill_to_out(bill).model_dump(), message="Bill settled")
