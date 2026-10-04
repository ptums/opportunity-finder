# Opportunity Finder (working name)

Pulls messy data from free, keyless public sources, cleans it, and ranks it to find a customer problem worth solving. The README will lead with the metrics table once results exist (see `docs/OUTCOMES.md`).

**Status:** Phase 0 (manual baseline). No ingestion code yet, by design.

## Docs
- `REQUIREMENTS.md`: scope and phases
- `AGENTS.md`, `PROCESS.md`: how agents work here
- `docs/OUTCOMES.md`: Phase 0 worksheet and metrics
- `docs/adr/`: decisions (ADR-001 stack is Proposed; ADR-002 hybrid scoring is Accepted)
- `docs/sources/`: per-source checks of terms, limits, and keyless access

## Dev
```sh
npm install
npm run db:up        # Postgres 17 on localhost:5433
npm run typecheck
npm test
```
## Phase 0 scout
```sh
ollama serve                    # local model server (ADR-002); qwen3:8b must be pulled
npm run scout                   # hybrid scoring, model judges top 80 HN items (~18 min first run, cached after)
npm run scout -- --judge-all    # judge every HN item
npm run scout -- --no-model     # rules only
```
Output: `docs/phase0-candidates.md`. It won't overwrite a file you've started labeling.

Env vars: `DATABASE_URL`, `OF_USER_AGENT` (include contact info), `OF_OLLAMA_MODEL` (default `qwen3:8b`), `OF_OLLAMA_URL`.
