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

    # Stage 3 Clusterer — tunable without code changes
    # Cosine similarity threshold to assign an evidence item to an existing cluster.
    # Below this value a new cluster is created. Range: 0.0–1.0 (higher = tighter clusters)
    clustering_similarity_threshold: float = 0.65
    # Maximum number of clusters that can be created per company scan.
    # Guards against pathological inputs producing hundreds of micro-clusters.
    clustering_max_clusters: int = 50

    # Stage 3 Ranker — formula weights (must sum to 1.0)
    ranker_weight_evidence_count: float = 0.40
    ranker_weight_recency: float = 0.35
    ranker_weight_source_credibility: float = 0.25
    # How many days until a source contribution to recency_score decays to zero
    ranker_recency_decay_days: int = 180

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
