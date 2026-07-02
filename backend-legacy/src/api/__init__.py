from fastapi import APIRouter
from .v1.workflow import routers as workflow_routers
from .v1.auth import routers as auth_routers
from .v1.bills import routers as bills_routers
from .v1.members import routers as members_routers
from .v1.notifications import routers as notifications_routers
from .v1.settings import routers as settings_routers

router = APIRouter(prefix='/invoicely')
router.include_router(workflow_routers)
router.include_router(auth_routers, prefix='/auth')
router.include_router(bills_routers, prefix='/bills')
router.include_router(members_routers, prefix='/members')
router.include_router(notifications_routers, prefix='/notifications')
router.include_router(settings_routers, prefix='/settings')
