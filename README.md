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

The scout finds candidate problems on Hacker News and USAspending, checks and scores them with a model judge (scorer v2, see ADR-003), and writes a ranked shortlist for you to label.

### What the scout does

1. **It searches.** It looks at Hacker News "Ask HN" posts from the past year, using phrases like "manually", "hours a week" and "is there a tool". It also searches USAspending for government contracts in areas like data entry and records management.
2. **It cleans up.** It drops posts with no body text and product launches like "I built…". It never keeps usernames. Only a post's title and body are ever sent to a model.
3. **It gates.** The judge must pass four gates before a post can make the shortlist. Each gate result comes with a quote from the post:
   - **G1 current problem:** a problem happening now, not a story, nostalgia, an opinion, venting or a launch.
   - **G2 need:** the author asks for help or states a written-down need.
   - **G3 not trivial:** no named product (or a plain spreadsheet) already solves *this author's* problem. A failed G3 must name the tool.
   - **G4 author has it:** the author or their team has the problem; they are not pitching or doing customer discovery.

   Posts that fail a gate go to the **Gated out** sheet with the deciding quote.
4. **It scores.** Each post gets 1–3 on Pain, Messy data, Backend weight, Reachable, **Buyer** and Free data:
   - **Reachable** means you could find and message five people with the problem, judged by where they gather (not by how specific the group sounds).
   - **Buyer** means the person with the problem, or someone they report to, would plausibly pay. A frustrated user with no budget scores 1.
   - Free data is a rule.
   - Comment count is shown as **Popularity** and is not part of the total.
5. **It checks the evidence.** Every gate and score needs a 4–25 word quote that really appears in the post (matching ignores case, whitespace and punctuation). A score without a valid quote is marked **unsupported** and left out of the total, and the post is marked for review. Run `npm run eval` to see how often reasons just repeat the rubric.
6. **It ranks.** Shortlist = all four gates pass and no score is unsupported, ranked by total (no cutoff). Hacker News posts come first, then the best 8 USAspending themes, whose rule-only totals aren't comparable.
7. **It writes the results.** Each run writes a new timestamped workbook and Markdown file (`docs/scout-v2-<date>.xlsx/.md`), so it never touches a file you've labeled.
8. **It saves its work and money.** Downloaded pages are kept for a day. Model answers are kept per model, prompt version and post text, so re-runs cost nothing. It sends at most one request per second to each site.

### 1. Choose a judge

| `--judge` | Model | Cost | Notes |
|---|---|---|---|
| `sonnet` (default) | claude-sonnet-5-5 | about $12 per 1,000 posts | Chosen after the judge comparison in `docs/OUTCOMES.md` |
| `haiku` | claude-haiku-4-5-20251001 | about $4 per 1,000 posts | Cheaper; its gates were much less discriminating |
| `local` | qwen3:8b via Ollama | $0 | The rollback. Runs the old judge-v1 prompt unless you pass `--prompt judge-v2.1` |

Paid judges read `ANTHROPIC_API_KEY` from `.env` (see `.env.example`). Before any call, the scout estimates the cost and stops if it is over $5 for the run or $20 in total. It makes no paid calls without `--confirm-spend`. Spend is logged in `docs/API-SPEND.md`.

### 2. Run the scout

```sh
npm run scout -- --dry-run                 # fetch (from cache if fresh), print the cost estimate, write nothing
npm run scout -- --confirm-spend           # Sonnet judges the top 80 HN posts by rule score
npm run scout -- --judge-all --confirm-spend   # judge every HN post (~270)
npm run scout -- --judge local             # rollback: local qwen3:8b, judge-v1 (start `ollama serve` first)
npm run scout -- --no-model                # rules only
```

### 3. Label the results

Open the newest `docs/scout-v2-*.xlsx`. Edit the light-blue cells (scores, Pursue?, Notes). G1–G4, Evidence and Popularity are on the right. **Band** shows Shortlist (all gates pass) or Review. The quotes behind every gate and score are on the Score reasons sheet.

### 4. Measure a judge

```sh
npm run eval:export                        # refresh labels from docs/eval-labels.xlsx into the frozen set
npm run eval -- --dry-run                  # estimate per judge, no calls
npm run eval -- --judge sonnet --confirm-spend   # score the frozen 80-post set; updates docs/OUTCOMES.md
```

### Running the local model

```sh
ollama pull qwen3:8b   # first time only, about 5 GB
ollama serve           # leave running in its own terminal tab; Ctrl+C when done
```

If Ollama is off, `--judge local` uses cached answers and falls back to rules for posts it has never judged.

Env vars: `DATABASE_URL`, `OF_USER_AGENT` (include contact info), `ANTHROPIC_API_KEY` (paid judges only; set in `.env`, never committed), `OF_OLLAMA_MODEL` (default `qwen3:8b`), `OF_OLLAMA_URL`.
