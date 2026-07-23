# SideDoor — Agent Rules

## What this project is
A tool that finds evidenced, buildable opportunities at target companies for a job-seeker, and hands off a prompt for them to build a small MVP themselves. Full spec: see PRD.md and ARCHITECTURE.md in this repo.

## Product principles (non-negotiable)
- Never complete the MVP for the user — scaffold and hand off, don't finish the build.
- No LLM call where a rule, formula, or template suffices. Before adding one, ask: "if I deleted this call, would the product still basically work?"
- Every opportunity card must have a real, clickable evidence source. No source, no card.
- No LinkedIn scraping. Generate search URLs instead.

## File ownership — respect this strictly
- `/backend/**` — Backend-Pipeline agent only
- `/frontend/**` — Frontend-Cards agent only
- `/shared/**` (API contracts, types) — Integration agent only, during integration passes
- Tests may be added by QA-Verifier under `/tests/**`, but QA-Verifier does not edit `/backend` or `/frontend` directly — it reports issues, the owning agent fixes them.

## Data schema
See ARCHITECTURE.md §2 for the full schema (users, user_profiles, companies, evidence_items, gap_clusters, etc.) — do not invent new tables without checking this first.

## Current build order
1. Resume/profile parsing
2. Collector (one source first: Reddit)
3. Clusterer + Ranker
4. Fixability + Role match + Profile match filters
5. Card rendering + prompt handoff
6. Outreach assembly
7. Scheduler + notifications