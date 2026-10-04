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

The scout finds candidate problems on Hacker News and USAspending, scores them (rules plus a local model, see ADR-002), and writes a ranked shortlist for you to label.

### 1. Start the local model (only needed to judge new posts)

```sh
ollama pull qwen3:8b   # first time only, about 5 GB
ollama serve           # leave running in its own terminal tab
```

### 2. Run the scout

```sh
npm run scout                   # model judges the top 80 HN posts by rule score
npm run scout -- --judge-all    # model judges every HN post (all ~270, about 45 min the first time)
npm run scout -- --no-model     # rules only, ignores the model and its cache
```

### 3. Label the results

Open `docs/phase0-candidates.xlsx`, edit the yellow cells (scores, Pursue?, Notes), and read the metrics on the Summary sheet. A Markdown copy is written to `docs/phase0-candidates.md`. Once you have started labeling, the scout never overwrites your file; it writes a timestamped copy instead.

### 4. Stop the model when you're done

Press `Ctrl+C` in the `ollama serve` tab. If Ollama was started some other way (for example the menu-bar app), quit it from there.

### Running without Ollama

- Every model judgment is cached in `data/judge-cache/`, so `npm run scout` works with Ollama off. Posts judged before keep their model scores, and nothing is re-judged.
- Posts that have **never** been judged get rule scores instead. The scout prints a warning, and the shortlist header says how many posts that affected. Start `ollama serve` and run again to judge them.
- Source pages are cached for 24 hours in `data/raw-cache/`. After that, a run fetches fresh posts, and any new ones need Ollama to be judged.
- Changing the model (`OF_OLLAMA_MODEL`) or the prompt version re-judges everything, because the cache is keyed on both.

Env vars: `DATABASE_URL`, `OF_USER_AGENT` (include contact info), `OF_OLLAMA_MODEL` (default `qwen3:8b`), `OF_OLLAMA_URL`.
