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
    # Startup: pre-load the embedding model so the first request isn't slow
    logger.info("Loading embedding model on startup...")
    get_embedder(settings.embedding_model)
    logger.info("Embedding model ready.")

    yield

    # Shutdown: nothing to clean up for now
    logger.info("Shutting down.")


app = FastAPI(
    title="SideDoor Backend",
    description=(
        "Backend pipeline for SideDoor — finds evidenced, buildable opportunities "
        "at target companies for job-seekers."
    ),
    version="0.1.0",
    lifespan=lifespan,
)

app.include_router(api_router)


@app.get("/health")
async def health_check():
    """Basic health check endpoint."""
    return {"status": "ok"}
