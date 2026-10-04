# ADR-001: Stack, database, and hosting

- **Status:** Proposed — awaiting Peter's approval (hosting is a human gate, REQUIREMENTS §11)
- **Date:** 2026-10-03
- **Metrics this affects:** run time, cost per 1,000 items, entity match precision/recall, duplicate rate

## Context

The app is backend-heavy. It does scheduled batch ingestion from four keyless sources, stores raw payloads immutably, finds exact and near duplicates, and does fuzzy entity resolution on vendor and organization names. A small single-user UI sits on top. REQUIREMENTS §8 prefers TypeScript and allows Cloudflare.

The heaviest database work is fuzzy string matching for vendor names (FR-11) and near-duplicate grouping (FR-9). Both are easier with trigram similarity indexes than with application-side loops.

## Decision

1. **Language/runtime:** TypeScript on Node 22 (ESM, strict mode).
2. **Database:** PostgreSQL 17 with `pg_trgm`, plus `pgvector` if embeddings are adopted for near-dupes (that choice goes in its own ADR).
3. **Local-first:** Postgres runs in Docker (`docker-compose.yml`, port 5433). All Phase 1–3 work runs locally, so no host is needed yet.
4. **Hosting:** Deferred. It gets decided in an amendment to this ADR before Phase 4 (UI), when sign-in and scheduled runs first need a public host. Leading candidates: Neon Postgres plus a Node host with cron (Fly.io, Railway, or Vercel Functions with Cron).
5. **Testing:** Vitest. Integration tests use recorded fixtures and make no live calls in CI (REQUIREMENTS §8).

## Alternatives considered

| Option | Why not (for now) |
|---|---|
| Cloudflare Workers + D1 | Cheap, and cron is built in. But D1 is SQLite with no trigram index, so fuzzy matching moves into app code. Workers' CPU limits also make batch clustering awkward. |
| Node + SQLite | Fastest start. Fuzzy matching has the same gap, and deploying would likely mean a migration. |
| Python | A strong data ecosystem, but the requirements prefer TypeScript and the UI would be in a second language. |

## Consequences

- `pg_trgm` `similarity()` and GIN indexes give a measurable, explainable matching method. Scores and methods are stored per FR-9/FR-12.
- Docker is a local dependency.
- Moving to a hosted Postgres later is a connection-string change, not a migration.

## Rollback plan

Schema migrations are plain SQL files. If Postgres turns out to be wrong, the raw-payload table is the only state that can't be rebuilt. It can be exported as JSONL and replayed into another store, and everything downstream can be re-derived by re-running normalization.
