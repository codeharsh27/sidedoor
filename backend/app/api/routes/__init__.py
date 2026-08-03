"""API route registration."""

from fastapi import APIRouter

from app.api.routes.profile import router as profile_router
from app.api.routes.company import router as company_router

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(profile_router)
api_router.include_router(company_router)
