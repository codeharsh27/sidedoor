"""
Local embedding service — no external API, no per-call cost.

Uses sentence-transformers (all-MiniLM-L6-v2 by default) to produce
384-dim embedding vectors. Loaded once at startup as a singleton.

This same embedder is used by:
  - Stage 1 (this stage): embed user profile at signup
  - Stage 3 (future): embed evidence_items for clustering
  - Stage 7 (future): embed gap_clusters for profile-match filtering
"""

import logging
from functools import lru_cache



from app.services.resume_parser import ProfileData

logger = logging.getLogger(__name__)


class Embedder:
    """
    Local embedding model wrapper.

    Provides both a generic embed_text() for arbitrary strings
    and a profile-specific embed_profile() that knows how to
    concatenate ProfileData fields into optimal embedding input.
    """

    def __init__(self, model_name: str = "all-MiniLM-L6-v2"):
        logger.info("Loading embedding model: %s", model_name)
        self._model = SentenceTransformer(model_name)
        self._dimensions = self._model.get_sentence_embedding_dimension()
        logger.info(
            "Embedding model loaded: %d dimensions", self._dimensions
        )

    @property
    def dimensions(self) -> int:
        """Number of dimensions in the embedding vector."""
        return self._dimensions

    def embed_text(self, text: str) -> list[float]:
        """
        Embed arbitrary text into a vector.

        This is the generic interface that later stages (clusterer,
        profile-matcher) will use. Keep it simple — one string in,
        one vector out.

        Args:
            text: The text to embed.

        Returns:
            List of floats representing the embedding vector.
        """
        embedding = self._model.encode(text, normalize_embeddings=True)
        return embedding.tolist()

    def embed_profile(self, parsed: ProfileData) -> list[float]:
        """
        Embed a parsed user profile into a vector.

        Concatenates all semantically meaningful fields into a single
        text block before embedding. The order and format matter:
        skills and domains provide broad matching signal, project
        details provide specific matching signal.

        Args:
            parsed: Structured profile data from the LLM resume parser.

        Returns:
            384-dim embedding vector as a list of floats.
        """
        parts: list[str] = []

        # Skills and domains — broad matching signal
        if parsed.skills:
            parts.append("Skills: " + ", ".join(parsed.skills))
        if parsed.domains:
            parts.append("Domains: " + ", ".join(parsed.domains))

        # Project summary — seniority and career context
        if parsed.project_summary:
            parts.append("Summary: " + parsed.project_summary)

        # Notable projects — the strongest matching signal
        for project in parsed.notable_projects:
            project_text = (
                f"Project: {project.title}. {project.description} "
                f"Tech: {', '.join(project.tech_used)}"
            )
            parts.append(project_text)

        combined = "\n".join(parts)
        logger.debug("Embedding profile text (%d chars)", len(combined))
        return self.embed_text(combined)


@lru_cache(maxsize=1)
def get_embedder(model_name: str = "all-MiniLM-L6-v2") -> Embedder:
    """
    Get or create the singleton Embedder instance.

    Cached so the model is loaded only once, regardless of how many
    times this function is called.
    """
    return Embedder(model_name=model_name)
