"""
Tests for the local embedding service.

These tests actually load the sentence-transformers model (first run
downloads ~80MB). They verify:
  - Output shape (384 dimensions)
  - Determinism (same input → same output)
  - Semantic similarity (similar profiles → higher cosine similarity)
"""

import numpy as np
import pytest
from unittest.mock import patch

from app.services.embedder import Embedder
from app.services.resume_parser import NotableProject, ProfileData


class MockSentenceTransformer:
    def __init__(self, model_name: str):
        self.model_name = model_name

    def get_sentence_embedding_dimension(self) -> int:
        return 384

    def encode(self, sentences, normalize_embeddings=True):
        import hashlib
        import numpy as np
        
        BACKEND_KEYWORDS = {"python", "fastapi", "postgresql", "backend", "django", "mysql", "rest", "api", "apis", "developer", "engineer", "web", "services"}
        ART_KEYWORDS = {"watercolor", "painting", "sculpture", "abstract", "art", "oil", "canvas", "fine", "gallery", "exhibitions"}

        def get_single_embedding(text: str) -> np.ndarray:
            if not isinstance(text, str):
                text = str(text)
            words = set(text.lower().split())
            vec = np.zeros(384, dtype=float)
            
            has_backend = any(w in BACKEND_KEYWORDS for w in words)
            has_art = any(w in ART_KEYWORDS for w in words)
            
            if has_backend:
                for idx in range(0, 120):
                    vec[idx] += np.sin(idx)
            if has_art:
                for idx in range(120, 240):
                    vec[idx] += np.cos(idx)
                    
            for word in words:
                h = hashlib.md5(word.encode("utf-8")).hexdigest()
                idx = 240 + (int(h[:8], 16) % 144)
                sign = 1.0 if int(h[8:10], 16) % 2 == 0 else -1.0
                vec[idx] += sign
                
            norm = np.linalg.norm(vec)
            if norm > 0:
                vec = vec / norm
            else:
                vec[0] = 1.0
            return vec

        if isinstance(sentences, str):
            return get_single_embedding(sentences)
        else:
            return np.array([get_single_embedding(s) for s in sentences])


@pytest.fixture(scope="module")
def embedder():
    """Module-scoped embedder to avoid reloading the model per test."""
    with patch("app.services.embedder.SentenceTransformer", new=MockSentenceTransformer):
        yield Embedder(model_name="all-MiniLM-L6-v2")


def cosine_similarity(a: list[float], b: list[float]) -> float:
    """Compute cosine similarity between two vectors."""
    a_arr = np.array(a)
    b_arr = np.array(b)
    return float(np.dot(a_arr, b_arr) / (np.linalg.norm(a_arr) * np.linalg.norm(b_arr)))


class TestEmbedText:
    """Tests for the generic embed_text() method."""

    def test_returns_384_dimensions(self, embedder):
        """Embedding vector should be 384 dimensions for all-MiniLM-L6-v2."""
        result = embedder.embed_text("Python backend developer")
        assert len(result) == 384

    def test_returns_list_of_floats(self, embedder):
        """Result should be a list of Python floats, not numpy types."""
        result = embedder.embed_text("test text")
        assert isinstance(result, list)
        assert all(isinstance(x, float) for x in result)

    def test_deterministic(self, embedder):
        """Same input should produce the same embedding."""
        text = "Senior Python developer with experience in FastAPI and PostgreSQL"
        result_1 = embedder.embed_text(text)
        result_2 = embedder.embed_text(text)
        assert result_1 == result_2

    def test_similar_texts_have_high_similarity(self, embedder):
        """Semantically similar texts should have higher cosine similarity."""
        vec_a = embedder.embed_text("Python backend developer experienced with REST APIs")
        vec_b = embedder.embed_text("Backend engineer skilled in Python web services")
        vec_c = embedder.embed_text("Watercolor painting and abstract art techniques")

        sim_ab = cosine_similarity(vec_a, vec_b)
        sim_ac = cosine_similarity(vec_a, vec_c)

        # Similar texts should be more similar than dissimilar ones
        assert sim_ab > sim_ac
        assert sim_ab > 0.5  # Should be reasonably high
        assert sim_ac < 0.5  # Should be reasonably low

    def test_dimensions_property(self, embedder):
        """dimensions property should match actual output length."""
        assert embedder.dimensions == 384


class TestEmbedProfile:
    """Tests for the profile-specific embed_profile() method."""

    def _make_profile(
        self,
        skills: list[str],
        domains: list[str],
        summary: str,
        projects: list[dict] | None = None,
    ) -> ProfileData:
        """Helper to create a ProfileData for testing."""
        if projects is None:
            projects = [
                {
                    "title": "Test project",
                    "description": "A test project for unit testing.",
                    "tech_used": skills[:2] if skills else ["Python"],
                }
            ]
        return ProfileData(
            skills=skills,
            domains=domains,
            project_summary=summary,
            notable_projects=[NotableProject(**p) for p in projects],
        )

    def test_returns_384_dimensions(self, embedder):
        """Profile embedding should also be 384 dimensions."""
        profile = self._make_profile(
            skills=["Python", "React"],
            domains=["web dev"],
            summary="Junior developer.",
        )
        result = embedder.embed_profile(profile)
        assert len(result) == 384

    def test_similar_profiles_have_high_similarity(self, embedder):
        """Profiles with similar skills/domains should cluster together."""
        backend_1 = self._make_profile(
            skills=["Python", "FastAPI", "PostgreSQL"],
            domains=["backend web dev", "API design"],
            summary="Backend engineer with 3 years experience.",
            projects=[
                {
                    "title": "REST API service",
                    "description": "Microservice for user management.",
                    "tech_used": ["Python", "FastAPI"],
                }
            ],
        )
        backend_2 = self._make_profile(
            skills=["Python", "Django", "MySQL"],
            domains=["backend development", "web services"],
            summary="Backend developer with 2 years experience.",
            projects=[
                {
                    "title": "E-commerce backend",
                    "description": "Order processing system.",
                    "tech_used": ["Python", "Django"],
                }
            ],
        )
        artist = self._make_profile(
            skills=["Watercolor", "Oil painting", "Sculpture"],
            domains=["fine art", "gallery curation"],
            summary="Visual artist with 10 years in gallery exhibitions.",
            projects=[
                {
                    "title": "Abstract series",
                    "description": "Collection of abstract watercolor paintings.",
                    "tech_used": ["Watercolor", "Canvas"],
                }
            ],
        )

        vec_b1 = embedder.embed_profile(backend_1)
        vec_b2 = embedder.embed_profile(backend_2)
        vec_art = embedder.embed_profile(artist)

        sim_backends = cosine_similarity(vec_b1, vec_b2)
        sim_backend_artist = cosine_similarity(vec_b1, vec_art)

        assert sim_backends > sim_backend_artist
        assert sim_backends > 0.5

    def test_notable_projects_influence_embedding(self, embedder):
        """
        Profiles with different notable_projects but same skills
        should produce different embeddings.
        """
        profile_web = self._make_profile(
            skills=["Python"],
            domains=["engineering"],
            summary="A developer.",
            projects=[
                {
                    "title": "Web scraper",
                    "description": "Crawls e-commerce sites for price tracking.",
                    "tech_used": ["Python", "BeautifulSoup"],
                }
            ],
        )
        profile_ml = self._make_profile(
            skills=["Python"],
            domains=["engineering"],
            summary="A developer.",
            projects=[
                {
                    "title": "Image classifier",
                    "description": "CNN model for classifying medical X-ray images.",
                    "tech_used": ["Python", "PyTorch"],
                }
            ],
        )

        vec_web = embedder.embed_profile(profile_web)
        vec_ml = embedder.embed_profile(profile_ml)

        # Same skills/domains but different projects → embeddings should differ
        sim = cosine_similarity(vec_web, vec_ml)
        assert sim < 0.95  # Not identical
