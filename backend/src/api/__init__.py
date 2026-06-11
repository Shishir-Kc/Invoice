from fastapi import APIRouter
from .v1.workflow import routers as auth_routers
from .v1.bills import routers as bills_routers

router = APIRouter(prefix='/invoicely')
router.include_router(auth_routers)
router.include_router(bills_routers, prefix='/bills')
