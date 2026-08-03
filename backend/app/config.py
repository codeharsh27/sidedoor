"""SideDoor backend application configuration."""

from pydantic import field_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings, read from environment variables or .env file."""

    # Database
    database_url: str = "postgresql+asyncpg://sidedoor:sidedoor@localhost:5432/sidedoor"

    @field_validator("database_url", mode="before")
    @classmethod
    def assemble_db_connection(cls, v: str) -> str:
        if isinstance(v, str):
            if v.startswith("postgres://"):
                return v.replace("postgres://", "postgresql+asyncpg://", 1)
            elif v.startswith("postgresql://") and not v.startswith("postgresql+"):
                return v.replace("postgresql://", "postgresql+asyncpg://", 1)
        return v

    # LLM provider for resume parsing (the one deliberate LLM call)
    llm_provider: str = "gemini"
    gemini_api_key: str = ""
    openrouter_api_key: str = ""

    # Embedding model (local, no API key needed)
    embedding_model: str = "all-MiniLM-L6-v2"

    # Security & limits
    max_file_size_mb: int = 10  # Max uploaded file size in MB
    url_fetch_timeout: int = 30  # Max seconds for portfolio URL fetching

    # Stage 2 Collectors
    github_token: str = ""
    twitter_bearer_token: str = ""
    reddit_client_id: str = ""
    reddit_client_secret: str = ""

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8", "extra": "ignore"}


settings = Settings()
