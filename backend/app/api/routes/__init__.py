"""API route registration."""

from fastapi import APIRouter

from app.api.routes.profile import router as profile_router
from app.api.routes.company import router as company_router
from app.api.routes.root import router as root_router
from app.api.routes.auth import router as auth_router
from app.api.routes.feed import router as feed_router
from app.api.routes.tracker import router as tracker_router

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(profile_router)
api_router.include_router(company_router)
api_router.include_router(root_router)
api_router.include_router(auth_router)
api_router.include_router(feed_router)
api_router.include_router(tracker_router)
