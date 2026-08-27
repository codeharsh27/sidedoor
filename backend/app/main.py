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

    # Run Alembic migrations and seed database programmatically (skipped in test mode)
    import sys
    if "pytest" not in sys.modules:
        logger.info("Running pending database migrations...")
        try:
            import asyncio
            from alembic.config import Config
            from alembic import command
            
            def upgrade_db():
                alembic_cfg = Config("alembic.ini")
                command.upgrade(alembic_cfg, "head")
                
            await asyncio.to_thread(upgrade_db)
            logger.info("Database migrations complete.")
        except Exception as e:
            logger.error(f"Failed to run database migrations: {e}")

        # Seed the database if the curated PM company feed is empty
        try:
            from sqlalchemy import select, func, text
            from app.db.session import async_session_factory
            from app.db.models import PMCompanyFeed
            import os
            
            async with async_session_factory() as session:
                count_res = await session.execute(select(func.count()).select_from(PMCompanyFeed))
                count = count_res.scalar()
                if count == 0:
                    logger.info("pm_company_feed table is empty. Seeding...")
                    base_dir = os.path.dirname(os.path.abspath(__file__))
                    sql_path = os.path.join(base_dir, "data", "pm_company_feed_seed.sql")
                    if os.path.exists(sql_path):
                        with open(sql_path, "r", encoding="utf-8") as f:
                            sql = f.read()
                        await session.execute(text(sql))
                        await session.commit()
                        logger.info("Successfully seeded pm_company_feed table.")
                    else:
                        logger.warning(f"Seed SQL file not found at {sql_path}")
                else:
                    logger.info(f"pm_company_feed table already has {count} rows.")
        except Exception as e:
            logger.error(f"Failed to seed database during startup: {e}")

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
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)


@app.get("/health")
async def health_check():
    """Basic health check endpoint."""
    return {"status": "ok"}
