# Opportunity Finder (working name)

Pulls messy data from free, keyless public sources, cleans it, and ranks it to find a customer problem worth solving. The README will lead with the metrics table once results exist (see `docs/OUTCOMES.md`).

**Status:** Phase 0 (baseline). The scout has produced a scored shortlist in `docs/phase0-candidates.xlsx`, waiting for Peter's labels. No Phase 1 ingestion pipeline yet.

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

### What the scout does

1. **It searches.** It looks at Hacker News "Ask HN" posts from the past year, using phrases like "manually", "hours a week" and "is there a tool". It also searches USAspending for government contracts in areas like data entry and records management.
2. **It cleans up.** It drops posts with no body text and product launches like "I built…". It never keeps usernames.
3. **It scores with rules.** Each item gets six scores from 1 to 3. Rules handle the simple ones. More comments or more matching phrases means higher Frequency. USAspending data is public, so Free data scores high there.
4. **It asks the local model.** The model reads each post. It decides whether it's a real problem and drops the ones that aren't. It writes a one-line summary of the problem. It scores Pain, Messy data, Backend weight and Reachable, and says why.
5. **It ranks.** It adds up the six scores, so totals run from 6 to 18. It takes the best 12 Hacker News posts and the best 8 USAspending themes.
6. **It writes the results.** It creates the Excel workbook and a Markdown copy. Each score shows its reason and whether a rule or the model gave it.
7. **It saves its work.** Downloaded pages are kept for a day. Model answers are kept until the model or the prompt changes. So re-runs are fast, and nothing gets asked twice.
8. **It plays it safe.** It sends at most one request per second to each site. If Ollama is off, it uses saved answers and falls back to rules for the rest. It never overwrites a workbook you've started labeling.

In short: it does the reading you didn't want to do, and hands you a short, scored list to judge.

### 1. Start the local model (only needed to judge new posts)

```sh
ollama pull qwen3:8b   # first time only, about 5 GB
ollama serve           # leave running in its own terminal tab
```

### 2. Run the scout

```sh
npm run scout                   # model judges the top 80 HN posts by rule score
npm run scout -- --judge-all    # model judges every HN post (all ~270, about an hour the first time)
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
