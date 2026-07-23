# SideDoor — Technical Architecture

*Written the way a senior engineer would hand this to a PM: here's how we build it, here's exactly where the LLM sits and why, here's what's deterministic and boring on purpose.*

---

## 0. The engineering principle that shapes every decision below

**The test for every stage: could you delete the LLM call and still have a working product?**

If yes, it doesn't get an LLM call — it gets a formula, a rule, or a locally-run model with no external API cost. This isn't a purity exercise; it's what makes the product cheap to run at scale, fast to respond, fully auditable ("why did this gap outrank that one" should always have a one-sentence non-AI answer), and defensible in an interview as actual system design, not prompt engineering.

**Where this lands: exactly one LLM API call in the entire user journey** — resume/portfolio parsing at signup. Every other "smart" behavior (clustering, ranking, matching, prompt generation, card copy) is either a locally-run embedding model (no per-call API cost) or plain code.

---

## 1. High-Level System Map

```
[Next.js frontend]
      |
      v
[API layer - FastAPI]  <-->  [Postgres + pgvector]
      |                              ^
      v                              |
[Job queue - background workers] ----+
      |
      +--> Collector workers (Reddit API, GitHub API, job board APIs)
      +--> Embedding worker (local model, no external API)
      +--> Scheduler (cron-style re-scan for tracked companies)
      +--> Notification dispatcher (Telegram/WhatsApp/email)

[LLM API - one call type only]
      -> Resume/portfolio parsing at signup
```

**Stack choices and why:**
- **Frontend:** Next.js/TypeScript — fast to ship, matches the earlier roadmap recommendation, nothing exotic needed for the UI complexity here.
- **Backend:** FastAPI (Python) — the collector/clusterer/ranker stages are data-pipeline work; Python's ecosystem (requests, sentence-transformers, pandas if needed) is the path of least resistance. If you're more fluent in Node, this can be Express/Nest instead — the architecture doesn't depend on the language, just pick the one you'll move fastest in.
- **Database:** Postgres with the `pgvector` extension. This is a deliberate simplification — you get relational data (users, companies, evidence) and vector similarity search (for clustering and profile-matching) in one database, instead of running a separate vector DB (Pinecone/Weaviate) you don't need at this scale. One less service to run, deploy, and pay for.
- **Job queue:** something simple — Celery (Python) or BullMQ (Node) — for the collector jobs and scheduled re-scans. These are I/O-bound, rate-limited external API calls; they need to be async and retryable, not blocking the request/response cycle.
- **Embeddings:** run locally via `sentence-transformers` (e.g. `all-MiniLM-L6-v2`) — free, fast, no API key, no per-call cost, no rate limit from a third party. This is the single biggest lever for keeping the product cheap and not an "LLM wrapper" — the semantic matching that makes the product feel smart costs you compute, not API credits.

---

## 2. Data Model (core tables)

```
users
  id, email, auth info, created_at

user_profiles
  id, user_id, raw_resume_text, parsed_skills[], parsed_domains[],
  parsed_project_summary, embedding_vector, updated_at

companies
  id, name, url, github_repo_url (nullable), careers_page_url (nullable),
  last_scanned_at

evidence_items
  id, company_id, source_type (reddit|github_issue|review|job_posting),
  source_url, raw_text, author_handle (nullable), posted_at, fetched_at

gap_clusters
  id, company_id, label, embedding_vector, evidence_item_ids[],
  evidence_count, recency_score, rank_score

fixability_flags
  id, gap_cluster_id, has_public_repo (bool), has_public_api (bool),
  has_ui_surface (bool), is_buildable (bool)  -- computed, not stored opinion

job_postings
  id, company_id, title, raw_text, posted_at, is_open (bool)

role_matches
  id, gap_cluster_id, job_posting_id, match_score

cards
  id, user_id, gap_cluster_id, profile_match_score, shown_at, status
  (new|selected|dismissed)

contacts
  id, company_id, name (nullable), title, source_url (public page or
  generated search URL), contact_type

notifications
  id, user_id, company_id, gap_cluster_id, channel, sent_at, reason
```

This schema is the actual contract between pipeline stages — each stage reads from one or two tables and writes to the next, which keeps them independently testable and replaceable.

---

## 3. Stage-by-Stage Implementation

### 3.1 Signup & Profile Build — **the one LLM call**
- User uploads resume/portfolio (PDF or link).
- Extract raw text (PDF parsing library, e.g. `pdfplumber` — no LLM needed for text extraction itself).
- **Single LLM call**: send raw resume text with a structured-output prompt ("extract skills, tools, project domains, seniority signal as JSON") — this is a legitimate use because it's extraction, not generation, and it runs once per user, not once per request.
- Immediately after: run the parsed skill/domain text through the local embedding model, store `embedding_vector` on `user_profiles`. This vector is what every later profile-match comparison uses — no further LLM calls needed for matching, just vector math.

### 3.2 Collector — plain APIs, zero LLM
- Reddit: public JSON API (`/search.json` per subreddit/keyword) — no auth needed for read-only public search.
- GitHub: REST API (`/search/issues`, `/repos/{owner}/{repo}/issues`) — free tier is generous for this use case.
- Job postings: most ATS platforms (Greenhouse, Lever) expose public JSON job-board endpoints (e.g. `boards-api.greenhouse.io/v1/boards/{company}/jobs`) — no scraping needed if the company uses one of these; fallback to their public careers page HTML if not.
- Reviews (later phase): G2/Capterra don't have friendly public APIs — treat as a v2 addition, don't block v1 on it.
- Store every fetched item as an `evidence_item` row with its source URL preserved — this is what makes the "receipt" requirement (Product Principle: show the receipt) possible later; if you don't store the URL at collection time, you can't retrofit it.

### 3.3 Clusterer — local embeddings, zero LLM API cost
- Embed each `evidence_item.raw_text` with the same local model used for the user profile.
- Group by cosine similarity above a threshold (start with a simple agglomerative clustering or even a nearest-neighbor threshold join — don't reach for a fancy clustering library until you've proven the simple version is too crude).
- Each resulting cluster becomes a `gap_cluster` row, `evidence_count` = number of items in it.

### 3.4 Ranker — pure formula, zero LLM
```
rank_score = (evidence_count * w1) + (recency_score * w2) + (source_credibility * w3)
```
Where `recency_score` decays with age (e.g. items older than 6 months contribute less), and `source_credibility` is a static weight per source type (a GitHub issue with 20 thumbs-up counts more than a single Reddit comment — tune weights, don't guess with an LLM). This must stay a formula — it's the one place "auditability" matters most, since it's the ranking the user's trust in the whole product rests on.

### 3.5 Fixability Filter — rule-based checks, zero LLM
- `has_public_repo`: does `companies.github_repo_url` exist and return 200?
- `has_public_api`: does the company have public API docs (can start as a manually-curated flag per company for v1, automate detection later)?
- `has_ui_surface`: default true unless flagged otherwise (most products have a web UI you could theoretically extend/patch).
- `is_buildable` = any of the above true. Gaps failing this get deprioritized, not deleted (still useful for the outreach-only path).

### 3.6 Role Match — keyword/TF-IDF overlap, zero LLM
- Simple term-overlap or TF-IDF cosine similarity between the gap cluster's aggregated text and each open job posting's text. This doesn't need embeddings or an LLM — classic information retrieval technique, cheap and explainable.

### 3.7 Profile-Match Filter — local embeddings, zero LLM API cost
- Cosine similarity between `user_profiles.embedding_vector` and each `gap_cluster.embedding_vector`.
- Re-rank the fixable, role-matched gaps by this score, take top 2-3 as the cards shown to this user.

### 3.8 Card Rendering — templated, zero LLM
- The "why this matches you" line is a **template**, not generated text: `"You listed {top_matching_skill} — this gap involves {gap_domain}."` Filling in variables from data you already have is more trustworthy (and cheaper) than asking an LLM to explain a match it didn't compute.

### 3.9 Prompt Handoff — templated, zero LLM API cost to you
- Generate the prompt the user takes to Claude/GPT via string templating: insert the gap description, the evidence summary, and the user's parsed skills into a fixed prompt template. **This costs you nothing** — the actual LLM usage happens on the user's own Claude/ChatGPT account, not your API bill. This is worth stating explicitly in interviews: the product's most "AI-feeling" moment is the one stage where you've deliberately pushed the LLM cost off your own infrastructure.

### 3.10 Outreach Assembly — rule-based, zero LLM
- Public team/about page: simple scrape of the company's own published team page if it exists (this is their own public marketing content, not a ToS violation the way scraping LinkedIn is).
- LinkedIn: **generate a search URL** (`linkedin.com/search/results/people/?keywords={title}%20{company}`), don't scrape. This gets the user to the right place without touching LinkedIn's data programmatically.

### 3.11 Scheduler & Notification — rule-based diffing, zero LLM
- Scheduled job (weekly) re-runs 3.2–3.7 for each tracked company.
- Diff new `gap_clusters`/`role_matches` against previously stored ones — a new cluster, a jump in `evidence_count`, or a newly opened `job_posting` matching a previously-flagged gap all trigger a notification row.
- Dispatch via Telegram Bot API (simplest to integrate first) or WhatsApp Business API (more setup) — a one-line templated message, again no LLM needed to write it.

---

## 4. Where This Leaves the "Is It an LLM Wrapper" Question

Of eleven implementation stages above, **one** makes an LLM API call (3.1, resume parsing, once per signup). Two use a locally-run embedding model with no per-call API cost or external rate limit (3.3, 3.7 — and 3.1's own embedding step). The remaining eight are plain APIs, formulas, rules, and string templates. If you stripped the single LLM call out entirely, you could still onboard a user with a manually-entered skill list and the rest of the product would work identically — that's the actual test, and this architecture passes it.

## 5. What NOT to Build (engineering discipline, matches PRD §9)

- No custom-trained ML model for clustering/ranking — off-the-shelf embeddings and a tuned formula are sufficient and don't need a training pipeline or labeled data you don't have.
- No real-time streaming pipeline — weekly batch re-scans are enough per the PRD; building real-time infra here is solving a problem you don't have yet.
- No separate vector database service — `pgvector` handles this scale fine; don't add infrastructure complexity before you've proven you need it.
- No LinkedIn scraping, ever — ToS violation and legal exposure, not a technical shortcut worth taking.

## 6. Scaling & 24/7 Reliability

**This wasn't covered above, and it shouldn't be over-built yet either — here's the honest read.**

The single biggest scaling risk in this system isn't your own servers, it's **the external APIs you depend on**: Reddit and GitHub both rate-limit unauthenticated/low-tier requests, and Greenhouse/Lever endpoints can throttle too. At real multi-user volume, ten users each triggering a fresh scan of the same popular company (e.g. a well-known YC startup) will hit that company's data ten redundant times and burn through rate limits fast. That's the actual constraint to design around first — not raw request-per-second capacity on your own API layer, which is comparatively easy.

**What to add, in priority order:**

1. **Cache collected evidence per company, not per user.** `evidence_items` are already company-scoped in the schema (section 2) — this is intentional. Before re-fetching, check `companies.last_scanned_at`; if scanned within the last N hours, serve from the existing rows instead of hitting Reddit/GitHub again. This single change removes most of the redundant-load problem for free, because the data model was already structured this way.
2. **Rate-limit-aware collector workers with backoff.** Wrap each external API call with exponential backoff and respect the API's own rate-limit headers — a naive retry loop is what actually takes a pipeline down under load, not raw traffic.
3. **Idempotent, retryable background jobs.** Every queue job (collector run, scheduled re-scan, notification dispatch) should be safe to retry without creating duplicate `evidence_items` or double-sending a notification — use a unique constraint (e.g. on `source_url`) rather than trusting the job to run exactly once.
4. **Horizontal scaling of the API layer, not the pipeline.** The FastAPI request/response layer (signup, card display, card selection) can scale horizontally behind a load balancer trivially, since it's stateless — this is the easy part. The job queue workers scale separately and independently, which is exactly why the architecture put collection/clustering/ranking behind a queue in section 1 instead of running them inline on the request.
5. **A managed Postgres instance with connection pooling** (e.g. PgBouncer, or a managed provider that handles this) — the thing that actually falls over under concurrent load in a naive setup is exhausting direct DB connections, not query complexity at this scale.
6. **Basic uptime monitoring and error alerting** (e.g. a free tier of Sentry for errors, a simple health-check endpoint polled externally) — "24/7" mostly means "you find out something broke before a user does," not "zero downtime infrastructure."
7. **A per-user or global daily cap on the one LLM call (resume parsing).** This is your only real per-request cost driver — a cap protects you from a runaway bill if signups spike, independent of any traffic scaling question.

**What I would NOT build yet, even for "many users, 24/7":**
- Kubernetes / container orchestration — a single well-configured deployment (Render, Railway, Fly.io) handles far more load than this product will see for a long while; don't add orchestration complexity to solve a scale problem you don't have.
- Read replicas or database sharding — premature at this stage; a single well-indexed Postgres instance is fine until you have concrete evidence otherwise.
- A custom job-queue implementation — Celery/BullMQ (already chosen in section 1) already solve retry, backoff, and worker-scaling; don't build this yourself.

**The judgment call for you to make:** "many users, 24/7" is a real requirement for a company, but this is a two-week solo build meant to double as an interview artifact and prove one real loop. I'd build items 1-3 above now (they're cheap and protect you even at low volume — caching and idempotency are just good practice), and treat items 4-7 as "designed for, not yet built" until you actually have more than a handful of concurrent users. Building full production-scale reliability before you've validated anyone wants this at all is the "engineering-driven requirements" pitfall Cagan warns about — solving a problem you don't have yet at the cost of the one you do.

## 7. Suggested Build Order (maps to PRD §8 prioritization)

1. Data model + auth + resume upload (3.1) — get the one LLM call working and tested first, since it's the highest-risk external dependency.
2. Collector for one company, one source (Reddit) — prove data is actually flowing before building the rest of the pipeline on top of it.
3. Clusterer + Ranker (3.3–3.4) — local embeddings, formula-based ranking.
4. Fixability + Role match + Profile match (3.5–3.7) — layer the filters on top of step 3's output.
5. Card rendering + prompt handoff (3.8–3.9) — the first point where a user can actually complete the core loop end to end.
6. Outreach assembly (3.10) — high-want, not blocking the first internal test.
7. Scheduler + notifications (3.11) — nice-to-have, build once the core loop is proven once on yourself.