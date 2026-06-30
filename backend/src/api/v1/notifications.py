import uuid
from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from sqlmodel import Session, select

from dependency.db import session_dep
from dependency.current_user import current_user_dep
from Schema.notification import Notification
from Schema.api import ApiResponse, NotificationOut, NotificationUpdate

routers = APIRouter()


def _to_out(n: Notification) -> NotificationOut:
    return NotificationOut(
        id=str(n.id),
        type=n.type,
        title=n.title,
        description=n.description,
        billId=str(n.bill_id) if n.bill_id else None,
        read=n.read,
        createdAt=n.created_at.isoformat() if n.created_at else "",
    )


def push_notification(
    session: Session,
    *,
    user_ids: "list[uuid.UUID] | None",
    type: str,
    title: str,
    description: str,
    bill_id: Optional[uuid.UUID] = None,
) -> list[Notification]:
    """Create one notification row per recipient and flush them.

    ``user_ids`` is the explicit list of users who should receive this
    notification. Notifications are strictly per-user: each user only ever
    sees rows whose ``user_id`` matches their own. The caller is responsible
    for committing alongside its own changes.
    """
    rows: list[Notification] = []
    seen: set[uuid.UUID] = set()
    for uid in user_ids or []:
        if uid is None or uid in seen:
            continue
        seen.add(uid)
        n = Notification(
            type=type,
            title=title,
            description=description,
            bill_id=bill_id,
            user_id=uid,
        )
        session.add(n)
        session.flush()
        rows.append(n)
    return rows


@routers.get("", response_model=ApiResponse)
def list_notifications(
    session: session_dep,
    user: current_user_dep,
    unread: Optional[bool] = Query(None),
):
    # Scope to the current user only. Legacy rows with user_id = NULL are
    # intentionally excluded (they predate per-user scoping).
    query = select(Notification).where(Notification.user_id == user.id)
    if unread is True:
        query = query.where(Notification.read == False)  # noqa: E712
    query = query.order_by(Notification.created_at.desc())
    rows = session.exec(query).all()
    return ApiResponse(
        success=True,
        data=[_to_out(n).model_dump() for n in rows],
        message="Notifications",
    )


@routers.post("/mark-all-read", response_model=ApiResponse)
def mark_all_read(session: session_dep, user: current_user_dep):
    rows = session.exec(
        select(Notification)
        .where(Notification.user_id == user.id, Notification.read == False)  # noqa: E712
    ).all()
    for n in rows:
        n.read = True
        session.add(n)
    session.commit()
    return ApiResponse(success=True, data=None, message="All notifications marked read")


@routers.patch("/{notification_id}", response_model=ApiResponse)
def update_notification(
    notification_id: uuid.UUID,
    req: NotificationUpdate,
    session: session_dep,
    user: current_user_dep,
):
    n = session.get(Notification, notification_id)
    if not n or n.user_id != user.id:
        # Don't reveal whether the id exists for another user.
        raise HTTPException(status_code=404, detail="Notification not found")
    n.read = req.read
    session.add(n)
    session.commit()
    session.refresh(n)
    return ApiResponse(
        success=True, data=_to_out(n).model_dump(), message="Notification updated"
    )


@routers.delete("/{notification_id}", response_model=ApiResponse)
def delete_notification(
    notification_id: uuid.UUID,
    session: session_dep,
    user: current_user_dep,
):
    n = session.get(Notification, notification_id)
    if not n or n.user_id != user.id:
        raise HTTPException(status_code=404, detail="Notification not found")
    session.delete(n)
    session.commit()
    return ApiResponse(success=True, data=None, message="Notification deleted")


@routers.delete("", response_model=ApiResponse)
def clear_all_notifications(session: session_dep, user: current_user_dep):
    rows = session.exec(
        select(Notification).where(Notification.user_id == user.id)
    ).all()
    for n in rows:
        session.delete(n)
    session.commit()
    return ApiResponse(success=True, data=None, message="All notifications cleared")
