"""
SideDoor backend — FastAPI application entry point.

Mounts the API router and initializes services on startup.
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.api.routes import api_router
from app.config import settings
from app.services.embedder import get_embedder

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan: startup and shutdown logic."""
    # We deliberately DO NOT pre-load the embedding model here because 
    # PyTorch + SentenceTransformers uses ~400MB RAM, which can cause
    # an Out-Of-Memory (OOM) kill on Render's 512MB Free Tier during startup.
    # It will load lazily on the first request instead.
    logger.info("Application starting up (ML models will load lazily).")

    yield

    # Shutdown: nothing to clean up for now
    logger.info("Shutting down.")


from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    title="SideDoor Backend",
    description=(
        "Backend pipeline for SideDoor — finds evidenced, buildable opportunities "
        "at target companies for job-seekers."
    ),
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)


@app.get("/health")
async def health_check():
    """Basic health check endpoint."""
    return {"status": "ok"}
