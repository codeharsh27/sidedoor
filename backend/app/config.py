"""SideDoor backend application configuration."""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings, read from environment variables or .env file."""

    # Database
    database_url: str = "postgresql+asyncpg://sidedoor:sidedoor@localhost:5432/sidedoor"

    # LLM provider for resume parsing (the one deliberate LLM call)
    llm_provider: str = "gemini"
    gemini_api_key: str = ""

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

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
