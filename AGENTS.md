# AGENTS.md

Rules for every agent working in this repo. REQUIREMENTS.md is the source of truth. This file is how to work with it.

## Hard rules

- **Never** read, print, or commit `.env*` files or secrets. Config comes from `process.env` (see `src/config.ts`).
- **Never** store poster identities (HN `by`/`author`, usernames, handles). Store snippet + source URL + timestamp only.
- **Never** add a source that needs a key, token, OAuth, or login. Never fetch site HTML where the terms forbid scraping.
- **Never** merge. Open a PR. Peter merges.
- **Human gates (stop and ask):** adding a new source, any hosting/domain change, anything that sends data off the app.
- Respect the phase gates in REQUIREMENTS §10. No Phase N+1 code until Phase N's exit criteria are met.

## Every ticket

1. Name the metric (REQUIREMENTS §9) it should move.
2. One source per ticket.
3. Cross-cutting changes (stack, schema, new source, scoring) need an ADR in `docs/adr/`.
4. Tests: unit tests for parsing/matching/scoring, and recorded fixtures for integration tests (no live calls in CI).
5. Log time, retries, and cost in `docs/AGENT-LOG.md`.

## Reporting

- Quote real command output (tests, typecheck, curl probes). Don't paraphrase results.
- End every PR/report with a **"Not checked"** list.

## Conventions

- TypeScript strict, ESM, Node 22. `npm run typecheck`, `npm test`.
- Outbound HTTP always sends `USER_AGENT`, goes through the per-source rate limiter, and backs off on 429/5xx.
- Local DB: `npm run db:up` (Postgres on port 5433).
