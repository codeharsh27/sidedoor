"""
Stage 4 Role Matcher — cross-references gap clusters against open job postings.

Uses in-process TF-IDF cosine similarity to score matches between the cluster's
aggregate text (all evidence items combined) and each open job posting.

No external libraries (like scikit-learn) required. Fully deterministic.
"""

import logging
import math
import re
import uuid
from collections import Counter

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db.models import EvidenceItem, GapCluster, JobPosting, RoleMatch

logger = logging.getLogger(__name__)

# Compact stopword list for TF-IDF tokenisation
_STOPWORDS = frozenset(
    {
        "a", "about", "above", "after", "again", "against", "all", "am", "an",
        "and", "any", "are", "arent", "as", "at", "be", "because", "been",
        "before", "being", "below", "between", "both", "but", "by", "cant",
        "cannot", "could", "couldnt", "did", "didnt", "do", "does", "doesnt",
        "doing", "dont", "down", "during", "each", "few", "for", "from",
        "further", "had", "hadnt", "has", "hasnt", "have", "havent", "having",
        "he", "hed", "hell", "hes", "her", "here", "heres", "hers", "herself",
        "him", "himself", "his", "how", "hows", "i", "id", "ill", "im",
        "ive", "if", "in", "into", "is", "isnt", "it", "its", "itself",
        "lets", "me", "more", "most", "mustnt", "my", "myself", "no", "nor",
        "not", "of", "off", "on", "once", "only", "or", "other", "ought",
        "our", "ours", "ourselves", "out", "over", "own", "same", "shant",
        "she", "shed", "shell", "shes", "should", "shouldnt", "so", "some",
        "such", "than", "that", "thats", "the", "their", "theirs", "them",
        "themselves", "then", "there", "theres", "these", "they", "theyd",
        "theyll", "theyre", "theyve", "this", "those", "through", "to",
        "too", "under", "until", "up", "very", "was", "wasnt", "we", "wed",
        "well", "were", "weve", "werent", "what", "whats", "when", "whens",
        "where", "wheres", "which", "while", "who", "whos", "whom", "why",
        "whys", "with", "wont", "would", "wouldnt", "you", "youd", "youll",
        "youre", "youve", "your", "yours", "yourself", "yourselves",
        "get", "use", "using", "like", "make", "want", "needs", "need", "job",
        "role", "team", "work", "experience", "skills", "looking", "software",
        "engineer", "developer", "development",
    }
)


def _tokenize(text: str) -> list[str]:
    """Tokenise text, removing punctuation and stopwords, keeping words >= 3 chars."""
    if not text:
        return []
    # Replace non-alphanumeric chars with space
    clean = re.sub(r"[^a-zA-Z0-9\s]", " ", text.lower())
    tokens = clean.split()
    return [t for t in tokens if len(t) >= 3 and t not in _STOPWORDS]


async def match_roles(
    company_id: uuid.UUID,
    db: AsyncSession,
) -> list[uuid.UUID]:
    """
    Match open jobs against gap clusters using TF-IDF cosine similarity.

    Args:
        company_id: The UUID of the company.
        db: Active async DB session.

    Returns:
        List of UUIDs of upserted RoleMatch rows.
    """
    # 1. Fetch all gap clusters for this company
    stmt_clusters = select(GapCluster).where(GapCluster.company_id == company_id)
    res_clusters = await db.execute(stmt_clusters)
    clusters = res_clusters.scalars().all()

    # 2. Fetch all open job postings for this company
    stmt_jobs = select(JobPosting).where(
        JobPosting.company_id == company_id, JobPosting.is_open == True
    )
    res_jobs = await db.execute(stmt_jobs)
    jobs = res_jobs.scalars().all()

    if not clusters or not jobs:
        logger.info(
            "Skipping role matching for company %s (clusters: %d, open jobs: %d)",
            company_id,
            len(clusters),
            len(jobs),
        )
        return []

    logger.info(
        "Matching %d clusters against %d open jobs for company %s",
        len(clusters),
        len(jobs),
        company_id,
    )

    # 3. Gather evidence item texts for clusters to form aggregate text per cluster
    cluster_texts: dict[uuid.UUID, str] = {}
    for cluster in clusters:
        if cluster.evidence_item_ids:
            stmt_items = select(EvidenceItem.raw_text).where(
                EvidenceItem.id.in_(cluster.evidence_item_ids)
            )
            res_items = await db.execute(stmt_items)
            texts = res_items.scalars().all()
            cluster_texts[cluster.id] = " ".join(texts)
        else:
            cluster_texts[cluster.id] = cluster.label

    # 4. TF-IDF setup
    # Corpus: all job postings + all cluster aggregate texts
    corpus_tokens: list[list[str]] = []
    job_tokens: dict[uuid.UUID, list[str]] = {}
    c_tokens: dict[uuid.UUID, list[str]] = {}

    for job in jobs:
        tokens = _tokenize(job.raw_text + " " + job.title)
        job_tokens[job.id] = tokens
        corpus_tokens.append(tokens)

    for cluster in clusters:
        tokens = _tokenize(cluster_texts[cluster.id] + " " + cluster.label)
        c_tokens[cluster.id] = tokens
        corpus_tokens.append(tokens)

    total_docs = len(corpus_tokens)

    # Compute Document Frequency (DF) for each term in the corpus
    df_counts: Counter = Counter()
    for tokens in corpus_tokens:
        unique_tokens = set(tokens)
        for t in unique_tokens:
            df_counts[t] += 1

    # IDF function helper
    def idf(term: str) -> float:
        df = df_counts.get(term, 0)
        # Bounded IDF formula
        return math.log(1.0 + total_docs / (1.0 + df))

    # Helper to build TF-IDF vector
    def get_tfidf_vector(tokens: list[str]) -> dict[str, float]:
        if not tokens:
            return {}
        counts = Counter(tokens)
        total = float(len(tokens))
        vec = {}
        for term, cnt in counts.items():
            tf = cnt / total
            vec[term] = tf * idf(term)
        return vec

    # Compute vectors
    job_vectors = {job.id: get_tfidf_vector(job_tokens[job.id]) for job in jobs}
    cluster_vectors = {
        cluster.id: get_tfidf_vector(c_tokens[cluster.id]) for cluster in clusters
    }

    persisted_ids: list[uuid.UUID] = []

    # 5. Compute cosine similarity for each pair
    for cluster in clusters:
        c_vec = cluster_vectors[cluster.id]
        if not c_vec:
            continue

        c_norm = math.sqrt(sum(val**2 for val in c_vec.values()))
        if c_norm == 0.0:
            continue

        for job in jobs:
            j_vec = job_vectors[job.id]
            if not j_vec:
                continue

            j_norm = math.sqrt(sum(val**2 for val in j_vec.values()))
            if j_norm == 0.0:
                continue

            # Dot product & identify overlapping terms for match reason
            dot_product = 0.0
            term_contributions = []

            for term, c_val in c_vec.items():
                if term in j_vec:
                    contrib = c_val * j_vec[term]
                    dot_product += contrib
                    term_contributions.append((term, contrib))

            sim = dot_product / (c_norm * j_norm)

            if sim >= settings.role_match_min_score:
                # Format match reason with top overlapping terms
                term_contributions.sort(key=lambda x: x[1], reverse=True)
                top_terms = [
                    t for t, _ in term_contributions[: settings.role_match_max_reasons]
                ]
                reason = f"overlap: {', '.join(top_terms)}" if top_terms else "semantic similarity"

                try:
                    async with db.begin_nested():
                        # Upsert RoleMatch
                        stmt_existing = select(RoleMatch).where(
                            RoleMatch.gap_cluster_id == cluster.id,
                            RoleMatch.job_posting_id == job.id,
                        )
                        res_match = await db.execute(stmt_existing)
                        existing_match = res_match.scalar_one_or_none()

                        if existing_match:
                            existing_match.match_score = sim
                            existing_match.match_reason = reason
                            role_match_id = existing_match.id
                        else:
                            new_match = RoleMatch(
                                gap_cluster_id=cluster.id,
                                job_posting_id=job.id,
                                match_score=sim,
                                match_reason=reason,
                            )
                            db.add(new_match)
                            await db.flush()
                            role_match_id = new_match.id

                        persisted_ids.append(role_match_id)

                        logger.info(
                            "Role Match found: cluster %s ↔ job %s (score=%.4f, reason=%s)",
                            cluster.id,
                            job.id,
                            sim,
                            reason,
                        )
                except Exception as e:
                    logger.error(
                        "Failed to persist role match for cluster %s and job %s: %s",
                        cluster.id,
                        job.id,
                        e,
                    )
            else:
                logger.debug(
                    "Role Match skipped: cluster %s ↔ job %s (score=%.4f below %.2f)",
                    cluster.id,
                    job.id,
                    sim,
                    settings.role_match_min_score,
                )

    return persisted_ids
