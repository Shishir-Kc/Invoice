from fastapi import APIRouter, Depends
from sqlmodel import Session

from dependency.db import get_session
from dependency.current_user import current_user_dep
from Schema.bill import User
from Schema.settings import UserSetting
from Schema.api import ApiResponse, UserSettingOut, UserSettingUpdate

routers = APIRouter()


@routers.get("", response_model=ApiResponse)
def get_settings(
    user: current_user_dep,  # type: ignore[valid-type]
    session: Session = Depends(get_session),
):
    s = session.get(UserSetting, user.id)
    if not s:
        s = UserSetting(user_id=user.id, default_currency="NPR")
    return ApiResponse(
        success=True,
        data=UserSettingOut(defaultCurrency=s.default_currency).model_dump(),
        message="Settings",
    )


@routers.put("", response_model=ApiResponse)
def update_settings(
    req: UserSettingUpdate,
    user: current_user_dep,  # type: ignore[valid-type]
    session: Session = Depends(get_session),
):
    s = session.get(UserSetting, user.id)
    if not s:
        s = UserSetting(user_id=user.id, default_currency=req.defaultCurrency)
    else:
        s.default_currency = req.defaultCurrency
    session.add(s)
    session.commit()
    session.refresh(s)
    return ApiResponse(
        success=True,
        data=UserSettingOut(defaultCurrency=s.default_currency).model_dump(),
        message="Settings saved",
    )
