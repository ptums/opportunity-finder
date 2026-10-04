# REQUIREMENTS.md

Project working name: **Opportunity Finder** (rename later)
Owner: Peter (product owner). Agents build; Peter reviews and merges.
Status: Draft v1. Fill the `[ ]` items and `<<placeholders>>` before the first ticket is cut.

---

## 1. Purpose

Build a backend-heavy, full-stack app that pulls messy data from free, keyless public sources, cleans it, and ranks it so Peter can find a real customer problem worth solving. Peter signs in, reviews a ranked list, stars the interesting ones, and picks one to pursue.

This project is also a portfolio case study. The product is not the point. The measured result is. Every decision here should make a before/after number easier to state.

### The case study in four parts (fill in as we go)

1. **Situation:** Finding a customer problem by hand takes <<X>> hours per qualified lead and relies on gut feel.
2. **Baseline:** Manual pass of 15-20 items: <<hours>>, <<number qualified>>. Recorded in `docs/OUTCOMES.md` before any code is written.
3. **What changed:** Ingestion, cleaning, entity matching, and ranking pipeline built by an agent team under a documented process.
4. **Result:** <<hours to shortlist, precision of top 20, duplicate rate, match accuracy, cost per 1,000 items>>.

## 2. Principles

- **Outcomes over outputs.** A feature exists only if it moves a metric in section 9.
- **Baseline before building.** Phase 0 (manual baseline) must finish before Phase 1 starts.
- **Keyless sources only.** No source that requires an API key, token, or OAuth app. If a source later needs one, it is dropped, not added.
- **Respect the sources.** Follow each source's terms, rate limits, and robots rules. No scraping of sites that forbid it. Identify the app with a User-Agent that has contact info where required.
- **Privacy by design.** Store the text snippet, source URL, and timestamp. Do not store poster identities. Do not use the app to contact anyone.
- **Built for use.** No fixed time box. Build it the way Peter wants to use it, and make each phase end in something usable.
- **Honest reporting.** Agents quote real command output and say what they did NOT check.

## 3. Users

| User | Need |
|---|---|
| Peter (v1, only user) | See ranked opportunities from public data, label them, take notes, and pick one to pursue |
| Future reader of the case study | Understand the problem, the baseline, and the measured result |

No multi-user features in v1.

## 4. Goals and non-goals

### Goals (v1)
- Ingest from 4 sources on a schedule, with an idempotent re-run.
- Normalize all items to one schema.
- Detect exact and near duplicates.
- Resolve organization and vendor names to canonical entities.
- Cluster similar items into opportunities.
- Score and rank opportunities on six criteria.
- A desktop and mobile web UI to browse, filter, star, label, and annotate.
- Metrics and logs sufficient to write the case study.

### Non-goals (v1)
- Scraping any site that forbids it.
- Any source requiring an API key or login.
- Contacting people, sending messages, or exporting contact lists.
- Multi-user accounts, billing, or public access.
- A marketing site, custom domain, or app store release.
- Real-time streaming. Scheduled batch is enough.
- Healthcare data.

## 5. Data sources

All access methods and limits below are assumptions. **Each source must be verified (terms, rate limits, keyless status) before its ticket is built.** Record the result in `docs/sources/<source>.md` and tick the box.

### v1 sources

| Source | Access | Signal | Mess it adds | Verify |
|---|---|---|---|---|
| Hacker News (Algolia and Firebase APIs) | No key | Ask HN, Show HN, "Who is hiring" text | Unstructured complaints and asks | [ ] terms [ ] limits [ ] keyless |
| Stack Exchange API | No key at low quota | Spreadsheet, accounting, and integration questions | Tags, duplicates, vague titles | [ ] terms [ ] limits [ ] keyless |
| USAspending API | No key | Federal contract awards by agency and vendor | Vendor name variants, duplicates | [ ] terms [ ] limits [ ] keyless |
| ProPublica Nonprofit Explorer API | No key | Nonprofit 990 financials | Name variants, missing fields | [ ] terms [ ] limits [ ] keyless |

### Matching helper (not a demand source)

| Source | Access | Use | Verify |
|---|---|---|---|
| Wikidata (SPARQL) | No key | Canonical identifiers for organizations and places during entity resolution | [ ] terms [ ] limits [ ] keyless |

### v2 candidates (do not build in v1)

Apple App Store review feeds, Federal Register API, SEC EDGAR (User-Agent with contact info required), city and state open data portals (Socrata and similar, throttled without a token), data.gov catalog (CKAN).

### Excluded

Anything needing a key or login (for example SAM.gov, Reddit, Product Hunt, YouTube, Adzuna, USAJobs), and sites whose terms prohibit scraping (G2, Capterra, Trustpilot, LinkedIn, Indeed, Upwork, Fiverr).

### Source rules
- One source per ticket. Each source gets an ADR section covering terms, limits, schema, and failure modes.
- Cache raw responses. Never re-fetch what was fetched within the source's cache window.
- Backoff on 429 and 5xx. Respect rate limits with a global per-source limiter.
- Pagination, schema drift, and partial failures must be handled and logged, not ignored.

## 6. Functional requirements

### 6.1 Ingestion
- FR-1: Scheduled runs per source, plus a manual "run now."
- FR-2: Raw payloads stored immutably with source, fetch time, and request parameters.
- FR-3: Runs are idempotent. Re-running a window produces no duplicate raw or normalized rows.
- FR-4: Each run records items fetched, items new, errors, duration, and cost.

### 6.2 Normalization
- FR-5: Map every source to a common item schema (section 7).
- FR-6: Keep a link from each normalized item back to its raw record.
- FR-7: Items that fail validation go to a rejects table with a reason, not dropped silently.

### 6.3 Deduplication
- FR-8: Exact duplicates (same source and external id, or same normalized text hash) are collapsed.
- FR-9: Near duplicates (cross-source or reworded) are grouped by similarity with a recorded score and method.
- FR-10: Duplicate rate before and after is measured on a labeled sample.

### 6.4 Entity resolution
- FR-11: Organization and vendor names are resolved to canonical entities using normalization, fuzzy matching, and Wikidata where a match exists.
- FR-12: Every match stores method and confidence. Low-confidence matches are flagged for review, not auto-merged.
- FR-13: Precision and recall are measured on a hand-labeled sample of 100 records.

### 6.5 Clustering and scoring
- FR-14: Group similar items into **opportunities** (a recurring problem or market signal).
- FR-15: Score each opportunity 1-3 on each criterion:
  1. Frequency: how many independent items and sources mention it
  2. Pain: stated cost in hours or money
  3. Messy data: multiple sources or no shared keys involved
  4. Backend weight: needs real ingestion, matching, and storage
  5. Reachable: Peter could find and message five people in that group
  6. Free data available: a prototype is possible on public data
- FR-16: Total score is the sum (6-18). 15 or higher is "shortlist," under 10 is "drop."
- FR-17: Every score stores how it was produced (rule or model), the model name and prompt version if a model is used, and its inputs.
- FR-18: Peter can override any score. Overrides are kept as labels and used to measure ranking quality.

### 6.6 Web UI (desktop and mobile)
- FR-19: Sign in (single user).
- FR-20: Ranked list of opportunities with score, source mix, and item count.
- FR-21: Detail view with the underlying snippets, source links, entities, and score breakdown.
- FR-22: Star, label (interesting, not interesting, needs more), and write notes.
- FR-23: Filters by source, score, label, date, and entity.
- FR-24: Run status and recent metrics page.
- FR-25: Responsive from phone width to desktop. Keyboard operable. WCAG 2.2 AA is the bar, with a note on what still needs a human screen-reader pass.

## 7. Data model (draft, the architect owns the final version)

| Entity | Key fields |
|---|---|
| `source_runs` | id, source, started_at, finished_at, items_fetched, items_new, errors, cost |
| `raw_items` | id, source, external_id, fetched_at, payload (immutable) |
| `items` | id, raw_item_id, source, source_url, text_snippet, published_at, tags, language, text_hash |
| `rejects` | id, raw_item_id, reason, detail |
| `duplicate_groups` | id, method, score, member_item_ids |
| `entities` | id, canonical_name, type, wikidata_id (nullable), aliases |
| `entity_matches` | item_id, entity_id, method, confidence, reviewed |
| `opportunities` | id, title, summary, item_ids, created_at |
| `opportunity_scores` | opportunity_id, criterion, score, method, model, prompt_version, created_at |
| `labels` | opportunity_id, label, starred, notes, created_at |

Retention: snippets and source URLs only. No poster names or handles.

## 8. Non-functional requirements

- **Cost:** hard monthly cap <<$ amount>>. Log cost per 1,000 items and per run. The app stops model calls if the cap is hit.
- **Reliability:** a failing source never blocks the others. Errors are logged with the source and run id.
- **Observability:** structured logs, run metrics page, and error monitoring. Events and counts only, no personal data.
- **Security:** no secrets in the repo, `.env*` never read or printed by agents, auth required for all pages, least-privilege credentials.
- **Performance:** list page loads in under <<2 s>> on a typical connection with 10,000 items.
- **Portability:** TypeScript preferred. Hosting and database are decided in ADR-001. Cloudflare is acceptable.
- **Accessibility:** per FR-25.
- **Tests:** unit tests for parsing, matching, and scoring. Integration tests with recorded fixtures (no live calls in CI). End-to-end tests for sign in, browse, star, and annotate.

## 9. Success metrics

Measured in `docs/OUTCOMES.md`. Baselines are recorded in Phase 0.

| Metric | How measured | Baseline | Target |
|---|---|---|---|
| Hours per qualified opportunity | Timed manual pass vs. app-assisted pass | <<from Phase 0>> | <<lower>> |
| Precision of top 20 | Share of top 20 Peter labels "interesting" | n/a | <<>>% |
| Duplicate rate | Labeled sample of 200 items, before vs. after dedupe | <<from raw>> | <<lower>> |
| Entity match precision and recall | 100 hand-labeled records | n/a | <<>>% / <<>>% |
| Field completeness | Share of key fields populated, before vs. after | <<from raw>> | <<higher>> |
| Cost per 1,000 items | Run logs | n/a | <<$>> |
| Source freshness | Age of newest item per source | n/a | <<hours>> |
| Run time | Run logs | n/a | <<minutes>> |
| Agent cost per merged ticket | Agent usage logs | n/a | track only |
| Lead time, ticket to merge | GitHub and Linear timestamps | n/a | track only |

## 10. Phases and exit criteria

| Phase | Work | Exit criteria |
|---|---|---|
| 0. Baseline | Manual pass over 15-20 items from 2 sources. Score by hand with the six criteria. Time it. Write it to `docs/OUTCOMES.md`. | Baseline numbers and a labeled starter set exist |
| 1. Ingestion | 2 sources (Hacker News, USAspending) with raw storage, runs, and idempotency | Re-run produces no duplicates, errors are logged, source docs ticked |
| 2. Normalize and dedupe | Common schema, rejects, exact and near dedupe, entity resolution on one source | Duplicate rate and match precision measured on labeled samples |
| 3. Remaining sources and scoring | Add Stack Exchange and ProPublica, clustering, six-criterion scoring | Top 20 can be ranked and compared with Peter's labels |
| 4. UI | Sign in, list, detail, star, label, notes, filters, run status | Peter completes a full browse-and-label session on desktop and phone |
| 5. Evaluate and write up | Measure every metric in section 9, finish the case study | Four-part case study draft in `docs/CASE-STUDY.md` |

### Go/no-go gates
- **After Phase 0:** if the manual pass finds no problem Peter wants to pursue, stop and reconsider the whole approach.
- **After Phase 2:** if duplicate rate and match precision did not measurably improve, fix the approach before building the UI.

## 11. Agentic workflow requirements

- Follow `AGENTS.md` and `PROCESS.md`. Orchestrator runs the loop and never merges. Peter merges.
- Every ticket states which metric it should move.
- Cross-cutting choices (stack, schema, new source, scoring approach) need an ADR with context, decision, alternatives, consequences, and a rollback plan.
- Agents log time, retries, and cost per ticket in `docs/AGENT-LOG.md`.
- No agent reads or prints `.env*`, uses real personal data, or commits secrets.
- Agents quote real command output and state what they did NOT check.
- Human gates: before any new source is added, before any hosting or domain change, and before any change that sends data off the app.

## 12. Risks

| Risk | Mitigation |
|---|---|
| Building a tool to avoid picking an idea | Phase 0 gate; each phase must end in something Peter actually uses |
| Source terms or limits change | Verify per source, cache raw data, isolate each source behind an adapter |
| Keyless sources skew toward technical users, not small businesses | Treat output as a shortlist for human conversations, not proof of demand |
| Ranking is noisy at first | Use Peter's labels to measure and improve precision, and report that honestly |
| Model cost creeps up | Monthly cap and per-run cost logging |
| Over-scoping | Non-goals list above, one source per ticket |

## 13. Open questions

- [ ] Hosting and database (ADR-001)
- [ ] Scoring method: rules only, model-assisted, or both (ADR-002)
- [ ] Monthly cost cap
- [ ] Final project name
- [ ] Whether Stack Exchange's keyless quota is enough for v1

## 14. Definition of done

- Phases 0 to 5 complete, or deliberately paused with notes.
- Every metric in section 9 has a recorded before and after, or an explicit note on why not.
- README explains the problem, architecture, and results with the metrics table at the top.
- `docs/CASE-STUDY.md` is written in the four-part shape.
- No secrets, no personal data, and no real poster identities in the repo.
