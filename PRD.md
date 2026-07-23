# SideDoor — Product Requirements Document (v2)

**Tagline:** Every job-seeker is optimizing for volume. We think that's exactly backwards.

*Written in the Martin Cagan PRD structure (Product Purpose → Principles → Personas/Goals/Tasks → Features → Assumptions → Release Criteria → Prioritization → Schedule). Living document — update in place as decisions are made, don't let decisions live only in chat.*

---

## 1. Product Purpose

### The problem (not the solution)

The job-search market has split into two failure modes, both driven by volume:

- **Applicant side:** AI-fueled auto-apply tools (LazyApply, AIApply, and similar) let candidates blast hundreds of near-identical applications. This has pushed application volume up sharply, overwhelmed recruiters, and gotten users auto-applied to roles they're wildly unqualified for. ATS platforms (Greenhouse, Lever, Workday) have responded with bot-detection and velocity filters — the arms race is already visible and already losing for candidates.
- **Outreach side:** tools like Chiaro already productize cold-emailing founders directly, using mail-merge-style personalization at scale — the same volume logic, one level upstream.

Both sides are optimizing the wrong variable. The data says otherwise: customized applications get 115% more interviews than generic ones. Every competitor is measurably fighting the market's own signal.

**The root cause this product addresses:** finding a genuinely differentiated angle into a specific company — real evidence of a real, current, buildable problem — takes real research time (hours per company, done properly). Almost nobody does this properly, so almost nobody's outreach is actually different from anyone else's, which is *why* the market collapsed into volume in the first place.

### Who it's for

Not "job-seekers" broadly. Specifically: **a job-seeker who has already tried, or watched a peer try, an auto-apply or mass-cold-email approach, gotten ghosted or flagged, and is now actively suspicious of anything that smells automated** — but still wants real leverage, not just "network harder." This suspicion is the reason the positioning has to lead with evidence and restraint, not speed.

### The big picture, in one scenario

Priya is a final-year CS student. She's sent 40 generic applications and heard back from none. A friend can get her a warm intro at one company, but she has nothing specific to say when she gets the introduction — she doesn't know what that company is actually struggling with right now. She uploads her resume and that one company's link. Twenty minutes later she has one evidenced, real problem that company's own users have been asking about for months, a prompt she can take to Claude to help her scope a tiny fix, and a template to reach the right person once she's built it — not a hundred templates to blast at a hundred companies.

### Product objectives, prioritized

1. **Evidence over volume** — every surfaced opportunity is backed by a real, linkable source (tweet, Reddit thread, blog post, GitHub issue). Measured by: 0 opportunity cards shown without at least one clickable source.
2. **Value-first, not hand-holding** — the user does the actual thinking and building; the product removes research friction, not judgment. Measured by: no feature ships that completes work the user should do themselves (see Product Principles).
3. **Speed to first real opportunity** — from signup to seeing the first evidenced card, minutes, not days. Measured by: time from resume upload to first card shown.

## 2. Product Principles

These resolve tradeoffs before they come up in implementation — if a feature request violates one, that's the answer, not a debate.

- **One real signal beats a hundred fake ones.** No outreach sequencing, no CRM, no multi-touch campaigns.
- **Show the receipt, not the score.** Every claim ships with the actual quote and link. A vague "sentiment" number without a source is not shown.
- **The product never finishes the job for the user.** It surfaces evidence and hands off a prompt or a starting point — the user does the building, the deciding, the reaching out. This is a permanent constraint, not a v1 limitation.
- **Standard is better than clever, for anything not core.** Signup, upload, notifications — build these the boring, expected way. Save the actual innovation for the pipeline and the cards.
- **If it's not evidenced, it's not shown.** One weak card erodes trust in every card after it — bias toward fewer, stronger cards over a longer list.

## 3. User Profile (Persona)

**Aditya, the referral-adjacent builder.** Final-year student or early-career developer. Has 1-3 solid technical projects, a resume, maybe a GitHub. Has a warm-but-thin connection to one or more target companies (a friend, a senior, a weak LinkedIn tie) but no real leverage yet — the connection alone doesn't get him hired. He's tried applying cold before and either heard nothing back or specifically distrusts tools that promise to "automate" his job search, because he's seen those backfire for peers. He has maybe one to two weeks of spare evenings to invest in one real shot at his top choice, not months.

**Primary goal:** walk into his one warm conversation (or cold outreach) with something concrete and specific to that company, not a generic pitch — and know, before spending a weekend building it, that it's worth the time.

## 4. User Goals & Tasks (maps directly to Features below)

| Goal | Task |
|---|---|
| Get matched to relevant opportunities, not generic ones | Upload resume/portfolio once at signup |
| Know where to even start | Upload a company shortlist or single link |
| Trust that a "gap" is real | See evidence (quotes, links) attached to every surfaced card |
| Know it's worth their specific effort | See cards filtered/ranked against their own skill profile |
| Actually build something | Get a tailored prompt to take to Claude/GPT and build a small MVP themselves |
| Prove they built it | Attach a live link + short Loom walkthrough to the opportunity |
| Reach the right person | Get pointed at 3-5 relevant contacts at the company (not scraped, not spammed) |
| Stay in the loop without checking manually | Get pinged when a new matching opportunity appears at a tracked company |

## 5. Features (End-to-End Workflow)

### 5.1 Signup & Profile Build
User signs up and uploads a resume or portfolio link. This is parsed (LLM extraction into structured fields: skills, tools, project domains, seniority signals) into a profile used to personalize every later step. **Objective supported:** #1, #3.

### 5.2 Company Input & Research Pipeline
User uploads a company shortlist or a single company link. Runs through:
- **Collector** — pulls public signals per company: job postings, GitHub issues (if public repo exists), forum/Reddit/X mentions, reviews. Plain APIs, no LLM.
- **Clusterer** — groups near-duplicate complaints/requests via embeddings. Classification, not generation.
- **Ranker** — scores clusters by frequency + recency + source credibility. Pure formula, fully auditable.
- **Fixability filter** — keeps only gaps with an actual public surface to build against (repo, API, UI). Rule-based.
- **Role match** — cross-references surviving gaps against currently open job postings at that company. Keyword/domain overlap.
- **Profile-match filter (new)** — re-ranks surviving gaps against the user's parsed skill profile (embedding similarity), so the cards shown are ones this specific user can plausibly execute.
**Objective supported:** #1, #3.

### 5.3 Opportunity Cards
Surfaces 2-3 cards, each with: the gap in plain language, the evidence trail (quotes + source links — tweet, Reddit, blog, GitHub issue), the matching open role (if any), and why it matches the user's profile. **Objective supported:** #1.

### 5.4 Prompt Handoff & Build
User picks a card. Product generates a tailored prompt (gap + evidence + user's skill profile) for the user to paste into Claude or GPT elsewhere, acting as a build mentor. **The product does not build the MVP itself** — this is a deliberate principle, not a missing feature. User builds a small MVP/solution externally, gets a live link, records a short Loom walkthrough. **Objective supported:** #2.

### 5.5 Outreach Assembly
Product helps assemble the outreach package: the evidence, the live artifact, the Loom video, and 3-5 relevant contacts at the company. Contact-finding is scoped to what's legitimately available — public team/about pages, a generated LinkedIn search URL for relevant titles at the company — **not automated scraping of LinkedIn profiles**, which violates its ToS and creates real legal exposure. **Objective supported:** #1, #2.

### 5.6 Ongoing Matching & Notification
Once a company is on a user's tracked shortlist, a scheduled re-scan checks for new gaps or newly-opened matching roles. When something crosses the bar (new strong evidence, a role opening that matches a previously-flagged gap), the user is pinged via WhatsApp/Telegram/email — a one-line summary plus a link back into the app, not the full card crammed into the message. **Objective supported:** #3.

## 6. Assumptions to Question (Cagan Step 6)

- *Assumption: users have a resume/portfolio worth parsing.* Some early-career users may not — worth checking before assuming this is a universal entry point.
- *Assumption: "evidence exists publicly" for most target companies.* Smaller or very private companies may simply not have enough public surface (no active forum, no public repo) — the pipeline needs a graceful "not enough signal for this company" state, not a forced weak card.
- *Assumption: users will actually go build the MVP externally once handed a prompt.* This is the biggest behavioral risk in the whole product — dropping the user at "here's a prompt, go build" is a real drop-off point compared to a fully guided flow. Worth testing directly, not assuming.
- *Assumption: 3-5 contacts is the right number.* Untested — could be too many (spreads a company's attention thin, one contact receiving from a few different pitches) or too few (no one responds).

## 7. Release Criteria

- **Performance:** first opportunity card must appear within minutes of company input, not hours — a slow first pass kills the "wow" moment.
- **Reliability:** zero cards shown without at least one verifiable source link — this is a hard release gate, not a target.
- **Usability:** a user with no prior context should understand what a card means and what to do next without an onboarding tutorial.
- **Supportability:** every pipeline stage (collector, clusterer, ranker, filters) should log why a gap was surfaced or dropped, so debugging a bad card doesn't require guesswork.

## 8. Prioritization

**Must-have (v1 cannot ship without these):**
- Resume/portfolio upload → profile build
- Single-company deep pipeline (collector → clusterer → ranker → fixability filter → role match → profile-match)
- 2-3 evidenced opportunity cards with real source links
- Prompt handoff for MVP building

**High-want (want before wider launch, won't delay first internal test):**
- Outreach assembly (contact pointers + package assembly)
- Loom/artifact attachment to a card

**Nice-to-have (design for, build later):**
- Multi-company shortlist radar sweep + cross-company ranking
- Scheduled re-scan + notification/ping layer (WhatsApp/Telegram)
- Non-technical artifact branch (proposal/mockup instead of code, for non-dev users)

## 9. Explicitly Out of Scope

- Any competitor hand-off (using one company's evidence to build a solution for their rival) — rejected outright, undermines the entire trust mechanism.
- Multi-touch outreach sequencing, CRM sync, campaign management — this is not a sales tool; adding this dilutes the differentiator.
- Automated LinkedIn scraping for contact discovery — ToS violation, real legal exposure; use public pages and generated search URLs instead.
- The product building or completing the MVP itself — permanent principle, not a v1 gap.

## 10. Schedule & Context

Two-week build window, doubling as hands-on product/engineering learning ahead of APM/product-engineering interviews at YC/a16z-backed companies. Build-in-public starts Day 1 (problem framing, before any code), so the trail itself becomes part of the portfolio artifact, not just the finished product.

## 11. First Real Test

Run the full v1 loop on the builder's own profile and one real target company (where a warm contact exists) before generalizing to multiple companies or other users. This validates the "will a user actually go build the MVP after the prompt handoff" assumption from Section 6 — the single riskiest one in the product — before any further scope is added.