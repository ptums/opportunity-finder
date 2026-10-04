# ADR-003: Scorer v2 (gates, Buyer, evidence quotes, selectable judge)

- **Status:** Accepted by Peter (2026-10-04: "lets move on to complete this task"). The `--prompt` default below was decided by the agent, since that open question got no answer. Peter can override it.
- **Date:** 2026-10-04
- **Supersedes:** parts of ADR-002 (Frequency for HN, the HN criteria set, and "local model only").
- **Metrics this affects:** precision of top 20 (primary), cost per 1,000 items, hours per qualified opportunity.

## Context

Phase 0 found 0 of 20 candidates worth pursuing (see the "Score reasons" sheet in `docs/phase0-candidates.xlsx`). The causes:
- Builders pitching or doing their own discovery passed as "problems" (#1, #6, #8, #9, partly #4).
- A nostalgia post (#3) and a vent (#5) scored 3 on Pain and Reach.
- qwen3:8b repeats the rubric back as its reasons.
- Reach measures how specific the group is.
- Frequency is really comment popularity.

This is the Phase 0 "reconsider" response, and it stays inside the scout. It adds no schema, pipeline, dedupe, or UI.

## Decision

**1. Gates run before scoring.** Each gate is pass or fail, with a verbatim quote. A post that fails any gate is not shortlisted. It stays in the workbook with the failing gate and its quote.

| Gate | Passes when | Fails on |
|---|---|---|
| G1 Current problem | A problem happening now | Story, nostalgia, opinion, venting, launch |
| G2 Need | Asks for help, or states a written organizational need | Musing, poll, "what do you think" |
| G3 Not trivial | Can't be solved in an afternoon with existing tools | Fixed by Zapier, Stripe, a spreadsheet, or a named tool. **`g3_tool` is required on fail.** |
| G4 Author has it | The author or their org has the problem | Pitch, launch, or a founder running customer discovery |

**2. HN criteria (six model or rule scores, total 6–18, bands unchanged: 15+ shortlist, under 10 drop).**
- Model scores: Pain, Messy, Backend, **Reachable**, **Buyer**.
  - Reachable is redefined: could Peter find and message 5 people with this problem, based on where they gather (a named forum, trade group, or marketplace)? How specific the group is doesn't count.
  - Buyer (new): would the person with the problem, or someone they report to, plausibly pay? A frustrated user with no budget scores 1.
- Free data stays a rule.
- Frequency leaves the HN total. Comment count is shown as a separate **`popularity`** column.
- USAspending themes keep their current six rule scores, with no gates and no Buyer. They are aggregates, not posts. The matcher is checked in Step 5, report only.

**3. Evidence rule.** Every gate result and model score carries a `quote`. The validator normalizes both the quote and the text that was sent (title + body, first 3,000 characters):
- lowercase
- collapse whitespace
- strip `' " ‘ ’ “ ” \``
- trim edge punctuation

The quote must be a substring of the normalized text and 4–25 words long. If not:
- The score is stored as `unsupported` and left out of the total.
- The item is marked "needs review" and not shortlisted.
- A gate with no valid quote counts as not passed.

**Rubric echo** means a reason shares any normalized 5-word sequence with the judge prompt. It is reported per judge as a rate and does not change scores.

**4. Output.** Every judge returns JSON in one schema:
- 4 gates × {pass, quote}, plus `g3_tool`
- `problem`
- 5 scores × {value, quote, why ≤ 15 words}

The schema is defined once in **zod** (the approved validator). It drives Ollama's `format`, the Anthropic structured-output schema, and validation after the response. Settings: temperature 0 (except Sonnet; see the amendments below), prompt `judge-v2` in `src/scout/prompts/judge-v2.md`. The cache key stays model + prompt version + text hash. Invalid output falls back to rule scores, as it does today.

**5. Judge selection.** `--judge local|haiku|sonnet` selects qwen3:8b (default), claude-haiku-4-5-20251001, or claude-sonnet-5-5. API judges use `@anthropic-ai/sdk`.
- The key comes from `process.env.ANTHROPIC_API_KEY`, loaded with `tsx --env-file=.env`. Agents never open the file. The variable name goes in `.env.example`.
- Only the title and body leave the machine. Authors are already dropped in `hn.ts`, and labels and notes are never sent.
- Logs and errors carry counts and item IDs, never post text.

**6. Cost cap.** Before any API call, the run estimates the cost:
- Input tokens: characters ÷ 3.5 × 1.2.
- Output tokens: `max_tokens` (the worst case).

The run aborts if the estimate is over $5 for the run, or if spend logged in `docs/API-SPEND.md` plus the estimate is over $20. After the run, actual `usage` is appended there.

Prices are from claude.com/pricing, fetched 2026-10-04:
- Haiku 4.5: $1 in / $5 out per MTok.
- Sonnet 5.5: $2 in / $10 out per MTok.

**Rough estimate for 80 items** (about 2.5k tokens in and 0.5k out each, unverified until the dry run): Haiku ≈ $0.40, Sonnet ≈ $0.80.

**7. Judge comparison on a frozen set.**
- **The set:** 80 HN posts, title and body only, with no author, stored as a fixture.
- **Labels:** Peter's label (`pursue` yes/maybe/no) and a reason code (`nostalgia`, `no_buyer`, `off_the_shelf`, `off_lane`, `not_a_need`, `other`).
- **Judges:** `npm run eval -- --judge <name>` runs each judge over the same fixture and writes to `docs/OUTCOMES.md`. The qwen judge-v1 baseline is read from `data/judge-cache` (271 cached judgments).
- **"Shortlisted" means:** all gates passed, all scores supported, and total ≥ 15.
- **Reported per judge:**
  - agreement with labels (yes/maybe vs. no)
  - false-positive rate by reason code
  - evidence-validity rate
  - rubric-echo rate
  - cost per 1,000 items
  - which of #1, #3, #5, #6, #8, #9 are still shortlisted

**Blocker found while reading:** `docs/phase0-candidates-top80.xlsx` has 20 rows, not 80, and its Pursue? and Notes columns are empty (so is `phase0-candidates.xlsx`). Step 2 will stop until Peter labels the set. Labels will not be guessed.

## Alternatives considered

| Option | Why not |
|---|---|
| Keep judge-v1 and add a "builder" flag | Doesn't fix rubric echo or unsupported scores. |
| Model chooses quotes with no validation | Can't tell evidence from invention, and that was the Phase 0 failure. |
| Count tokens with Anthropic's `count_tokens` API | An extra outbound call per item. A local estimate with a 20% margin plus a worst-case output bound is enough at these caps. |
| Message Batches API (50% cheaper) | Runs at these sizes cost under $1, so the latency isn't worth it. Can revisit for the full Step 6 run. |
| Keep Frequency in the total, rescaled | Comment count measures popularity, not frequency. Better shown than scored. |

## Consequences

- New dependencies: `@anthropic-ai/sdk` and `zod`. Nothing else.
- The shortlist will be shorter. Gates and the quote rule drop items rather than score them low.
- An 8B local model may often fail the quote rule. That shows up as a low evidence-validity rate, which is the point of measuring it.
- HN and USAspending totals are no longer the same mix of criteria. In v2 runs the output lists HN first, then USAspending, instead of one merged ranking (corrected 2026-10-04: the earlier claim that the workbook already ranked them in separate blocks was wrong).
- **`--prompt judge-v1|judge-v2`** was added. It defaults to judge-v1 for `local` (today's behavior) and judge-v2 for API judges. This keeps qwen3:8b judge-v1 as the default, as Peter asked.

## Amendments found while building (Step 2)

- **No temperature 0 on Sonnet 5.5.** The API rejects non-default `temperature` on `claude-sonnet-5-5`. The Sonnet judge therefore sends the default temperature, with `thinking: {type: "between_tools"}` (thinking off for a single call) and `effort: "low"`. qwen and Haiku still use temperature 0. Sonnet results may vary slightly between runs. The answer cache hides this on re-runs.
- **Structured output** uses the SDK's `messages.parse` with `zodOutputFormat(JudgmentV2Schema)`. The result is validated again with zod before it is cached.
- **Paid judges need `--confirm-spend`.** Without it, a paid judge prints the estimate and makes no calls. That's the human gate.
- **Scorer v2 scout runs** always write `docs/scout-v2-<timestamp>.md/.xlsx`, so a Phase 0 file is never replaced.
- **Punctuation-insensitive quote matching** (approved by Peter 2026-10-04, after the smoke test). In the smoke test, Haiku copied quotes word for word but swapped list separators (`-` → `.`, `•` → `,`). Matching now keeps only letters, digits, `$` and `%`. Paraphrased and invented quotes are still rejected (unit-tested).
- **Precision and recall** were added to the comparison (approved 2026-10-04). Labels are about half positive (39/80), so agreement alone can't tell a useful judge from one that shortlists nothing.
- **Labels are a quick screen.** Peter labeled from the title and the first 300 characters ("worth researching further?"), not from the full thread. Three Phase 0 false positives (#5, #8, #9) are labeled yes on this basis.
- **judge-v2.1 and the gate-only shortlist** (Peter approved 2026-10-04 after Step 3):
  - G3 now fails only when a named product (or a plain spreadsheet) solves this author's problem today; categories like "an LLM" don't count.
  - The v2 shortlist is every post that passes all gates with no unsupported score, ranked by total, with no ≥ 15 cutoff.
  - The default `--judge` is now `sonnet`. Rollback: `--judge local`.
- **Hard enum for scores.** Sonnet looped on digits ("0.00.00…") until `max_tokens` on 11 of 80 posts. The API ignores `minimum`/`maximum`, and the SDK's zod helper (0.131.0) also turns `enum` into a description. The judge now sends a hand-built JSON schema with `score: {"type": "integer", "enum": [1, 2, 3]}` and validates responses with zod. After the fix, 11 of 11 succeeded, at about 750 output tokens each.
- **Output ceiling** is 3,000 tokens (it was 1,500).
- **Gated-out posts** go to a "Gated out" sheet in the workbook, not to the Candidates sheet.

## Rollback

`--judge local` (with `--prompt judge-v1` if added) reproduces today's scoring from cache. `--no-model` still gives rules only. Scores are recomputed on every run from cached inputs, and there's no database migration to undo.
