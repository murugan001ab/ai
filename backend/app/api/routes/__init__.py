from fastapi import APIRouter

from app.api.routes.auth import router as auth_router
from app.api.routes.users import router as users_router
# from app.api.routes.roles import router as roles_router
from app.api.routes.zones import router as zones_router
from app.api.routes.cameras import router as cameras_router
from app.api.routes.events import router as events_router
from app.api.routes.dashboard import router as dashboard_router
from app.api.routes.ppe_compliance import router as ppe_compliance_router
from app.api.routes.worker import router as worker_image
from app.api.routes.reports import router as reports_router

api_router = APIRouter()

api_router.include_router(auth_router)
api_router.include_router(users_router)
# api_router.include_router(roles_router)
api_router.include_router(zones_router)
api_router.include_router(cameras_router)
api_router.include_router(events_router)
api_router.include_router(dashboard_router)
api_router.include_router(ppe_compliance_router)
api_router.include_router(worker_image)
api_router.include_router(reports_router)
