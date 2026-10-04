# Outcomes

Before/after numbers for every metric in REQUIREMENTS §9. Baselines first.

---

## Phase 0: Manual baseline (Peter)

**Rules:** fully manual. Use the normal websites (news.ycombinator.com, usaspending.gov) and no app code. Start the timer before opening the first site and stop it after the last score. Breaks don't count; write them down.

- Date: 10/3/2026
- Start time: 10:39PM / End time: / Breaks:
- **Total active minutes:**
- Sources used: Hacker News (Ask HN), USAspending

> **Pivot (2026-10-03):** the fully manual pass was abandoned before any item was scored. Peter found the volume of text too much to sift by hand. That is itself the "Situation" data point. Record the End time above as the moment of abandonment.
>
> Phase 0 became **machine-found, human-labeled**: `npm run scout` pulled and rule-scored candidates in 14.3 s (28 requests, 0 errors), written to `docs/phase0-candidates.md`. Peter reviews and corrects those 20 scores and marks Pursue?. That review is timed and becomes the baseline for "hours per qualified opportunity (assisted, v0)". Peter's corrections are the first labels for "precision of top 20".
>
> **Update (2026-10-03, ADR-002):** scoring is now hybrid, with local `qwen3:8b` judging Pain, Messy, Backend and Reachable for HN, and the model drops non-problems. The run judged 80 items in about 18 min, dropped 41 as not-a-problem, and had 0 failures. The shortlist shows both the hybrid **Total** and the rules-only **Rules** total, so Peter's labels can measure precision for each.
>
> **Caveat for the case study:** there is no fully manual time-per-lead number. The honest "before" is: *manual search abandoned after N minutes with 0 items scored*.

### Scored items (15–20)

Score each criterion 1–3. Total is 6–18. ≥15 = shortlist, <10 = drop.

Target: 10 Hacker News (news.ycombinator.com/ask) + 8–10 USAspending (Award Search). For USAspending, write the problem you infer from the award, not the award itself. Fill **Freq** last, after you've seen every item.

| Criterion | 1 | 2 | 3 |
| --- | --- | --- | --- |
| Frequency | You saw it once | 2–3 times, or in 2 places | Keeps coming up, across sources or many comments |
| Pain | An annoyance with no cost stated | Time or money cost implied | Hours or dollars stated outright |
| Messy data | One clean source | Some name variants or missing fields | Several sources with no shared key |
| Backend weight | Mostly a UI or simple forms | Some ingestion or matching | Real ingestion, matching and storage |
| Reachable | You can't say where these people are | You know a community they're in | You could message 5 of them this week |
| Free data | Needs paid or private data | Partly public | A prototype works entirely on public data |

| #   | Source | URL | One-line problem | Freq | Pain | Messy | Backend | Reach | Free data | Total | Pursue? |
| --- | ------ | --- | ---------------- | ---- | ---- | ----- | ------- | ----- | --------- | ----- | ------- |
| 1   |        |     |                  |      |      |       |         |       |           |       |         |
| 2   |        |     |                  |      |      |       |         |       |           |       |         |
| 3   |        |     |                  |      |      |       |         |       |           |       |         |
| 4   |        |     |                  |      |      |       |         |       |           |       |         |
| 5   |        |     |                  |      |      |       |         |       |           |       |         |
| 6   |        |     |                  |      |      |       |         |       |           |       |         |
| 7   |        |     |                  |      |      |       |         |       |           |       |         |
| 8   |        |     |                  |      |      |       |         |       |           |       |         |
| 9   |        |     |                  |      |      |       |         |       |           |       |         |
| 10  |        |     |                  |      |      |       |         |       |           |       |         |
| 11  |        |     |                  |      |      |       |         |       |           |       |         |
| 12  |        |     |                  |      |      |       |         |       |           |       |         |
| 13  |        |     |                  |      |      |       |         |       |           |       |         |
| 14  |        |     |                  |      |      |       |         |       |           |       |         |
| 15  |        |     |                  |      |      |       |         |       |           |       |         |
| 16  |        |     |                  |      |      |       |         |       |           |       |         |
| 17  |        |     |                  |      |      |       |         |       |           |       |         |
| 18  |        |     |                  |      |      |       |         |       |           |       |         |
| 19  |        |     |                  |      |      |       |         |       |           |       |         |
| 20  |        |     |                  |      |      |       |         |       |           |       |         |

### Baseline results

- Items reviewed:
- Qualified (≥15):
- **Hours per qualified opportunity** = active hours ÷ qualified:
- Duplicates noticed by hand (same problem twice):
- Vendor/org name variants noticed:
- Notes on what was slow or annoying:

### Go/no-go (REQUIREMENTS §10)

- [ ] Found at least one problem I want to pursue → proceed to Phase 1
- [ ] Found none → stop and reconsider

---

## Metrics table

| Metric                                        | Baseline | After | Notes      |
| --------------------------------------------- | -------- | ----- | ---------- |
| Hours per qualified opportunity               |          |       |            |
| Precision of top 20                           | n/a      |       |            |
| Duplicate rate (200-item sample)              |          |       |            |
| Entity match precision / recall (100 records) | n/a      |       |            |
| Field completeness                            |          |       |            |
| Cost per 1,000 items                          | n/a      |       |            |
| Source freshness                              | n/a      |       |            |
| Run time                                      | n/a      |       |            |
| Agent cost per merged ticket                  | n/a      |       | track only |
| Lead time, ticket to merge                    | n/a      |       | track only |

## Scorer v2 experiment

<!-- scorer-v2:start -->
Frozen set: `test/fixtures/eval-set.json` (posts only), 80 HN posts, 80 labeled by Peter (labels kept locally in the gitignored `docs/eval-labels.xlsx`). Generated by `npm run eval`; do not edit by hand.

Shortlisted (judge-v2.1) = all gates pass with valid quotes and every model score supported, ranked by total, no cutoff. judge-v2 rows used the old rule (also total ≥ 15). v1 = is_problem and hybrid total ≥ 15. Agreement = shortlisted matches label (yes/maybe vs no). Precision = share of shortlisted items labeled yes/maybe. Recall = share of yes/maybe items shortlisted. Evidence validity = quotes that pass the substring check ÷ quotes requested (v1 has no quotes). Rubric echo = reasons sharing a 5-word run with the judge prompt.

| Judge | Prompt | Judged | Shortlisted | Agreement | Precision | Recall | Evidence valid | Rubric echo | Cost / 1,000 items | Known FPs still shortlisted | Run |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| haiku (claude-haiku-4-5-20251001) | judge-v2 | 80/80 | 2 | 51% | 50% | 3% | 92% | 0% | $4.01 (all logged spend incl. retries ÷ 80 items) | none | 2026-10-04 |
| local (qwen3:8b) | judge-v1 | 80/80 | 9 | 53% | 56% | 13% | n/a | 15% | $0 (local) | #1, #6, #3, #8, #9, #5 | 2026-10-04 |
| sonnet (claude-sonnet-5-5) | judge-v2.1 | 80/80 | 6 | 54% | 67% | 10% | 86% | 1% | $17.32 (all logged spend incl. retries ÷ 80 items) | none | 2026-10-04 |
| sonnet (claude-sonnet-5-5) | judge-v2 | 79/80 | 0 | 51% | n/a | 0% | 85% | 1% | $12.96 (all logged spend incl. retries ÷ 80 items) | none | 2026-10-04 |

False-positive rate by reason code (share of items Peter labeled "no" with that code that the judge shortlisted):

| Judge | nostalgia | no_buyer | off_the_shelf | off_lane | not_a_need | other | uncoded |
| --- | --- | --- | --- | --- | --- | --- | --- |
| haiku judge-v2 | n/a (n=0) | 0% (n=2) | n/a (n=0) | 50% (n=2) | 0% (n=2) | n/a (n=0) | 0% (n=35) |
| local judge-v1 | n/a (n=0) | 0% (n=2) | n/a (n=0) | 50% (n=2) | 50% (n=2) | n/a (n=0) | 6% (n=35) |
| sonnet judge-v2.1 | n/a (n=0) | 0% (n=2) | n/a (n=0) | 50% (n=2) | 0% (n=2) | n/a (n=0) | 3% (n=35) |
| sonnet judge-v2 | n/a (n=0) | 0% (n=2) | n/a (n=0) | 0% (n=2) | 0% (n=2) | n/a (n=0) | 0% (n=34) |
<!-- scorer-v2:end -->

### Reading the results (2026-10-04, agent analysis; Peter decides)

**Labels are a quick screen.** Peter labeled from the title and the first 300 characters ("worth researching further?"); the judges see up to 3,000 characters. 39 of 80 are yes or maybe. Three Phase 0 false positives (#5, #8, #9) are labeled yes here, though Peter rejected them in Phase 0 after reading the threads. Agreement against these labels is therefore weak evidence either way.

**The ≥ 15 cutoff, not the gates, empties the v2 shortlists.** Judged on gates alone (all four pass with valid quotes):

| Judge | Pass all gates | Of those, labeled yes/maybe | Gate-only recall | Gated out |
| --- | --- | --- | --- | --- |
| haiku judge-v2 | 5 | 3 (60%) | 3/39 | 73 of 80, 14 of the yes/maybe items on all four gates at once |
| sonnet judge-v2 | 6 | 4 (67%) | 4/39 | 57 of 79. G3 is the main filter (49), then G2 (32), G4 (25), G1 (10) |

Sonnet's highest total among gate-passing posts is 13. It rarely gives a 3, and Free data is a rule that is usually 2, so 15 is almost unreachable.

**What v2 fixes:** none of the six Phase 0 false positives is shortlisted by Haiku or Sonnet (v1 shortlists all six). Rubric echo drops from 15% to 0–1%. 85–92% of quotes are verbatim.

**What v2 gets wrong:** Sonnet's G3 sometimes names a category, not a tool that solves the author's problem ("LLM", "Anthropic", "spreadsheet" for idea validation). One answer said "none named"; the validator now treats that as no tool, so the gate is unsupported. Haiku fails most gates on most posts, which looks indiscriminate, not like reasoning.

**Reliability and cost:**
- **Sonnet:** 79 of 80 judged. It hit `max_tokens` on 14 posts at 1,500 tokens. 11 succeeded on retry and 2 more at a 3,000 ceiling; one post (48484306) still runs past 3,000. Logged spend is $1.04, or about $13 per 1,000 items including retries.
- **Haiku:** 0 failures, $0.32, or $4.01 per 1,000 items.
- **qwen3:8b judge-v2:** not run. It took about 20 s per post, so roughly 27 minutes, over the 15-minute limit.

**Recommendation: Sonnet (claude-sonnet-5-5) as the judge, with two changes before Step 6**, both needing Peter's OK:
1. For v2, shortlist = all gates pass, ranked by total. Drop the ≥ 15 cutoff, which no v2 judge reaches.
2. Tighten the G3 wording: fail only when a named product solves *this author's* problem today. A category ("an LLM", "spreadsheets") is not a tool.

Why Sonnet over Haiku: its gate failures are spread across G1–G4 and come with specific reasons, while Haiku fails nearly everything on every gate. At about $13 per 1,000, judging the top 80 HN posts costs about $1 a run. Judging all 271 costs about $3.50, under the $5 cap. Haiku is the cheaper fallback if cost matters more than gate quality.

## USAspending vendor-name matcher check (Step 5, report only)

**Verdict: not a matcher bug.** The 0 comes from the data: USAspending returns one canonical spelling per recipient, so the "Messy" rule always scores 1 for these themes.

- `test/usaspending-matcher.test.ts` (4 tests, all pass): "ACME INC", "ACME, INC." and "Acme Incorporated" all normalize to `acme` and count as **1** vendor with multiple spellings. `&`/`and`, `L.L.C.`/`LLC` and `INC.`/`Inc` also merge, and identical spellings count 0.
- Cached responses (13 files, 903 awards, 485 distinct recipient names): every name is upper case, 485 raw names give 485 normalized keys, and **0** keys have more than one spelling. The `spending_by_award` endpoint already returns USAspending's cleaned recipient name, so variants never reach the matcher.
- Implication (no scoring change made): "Messy data" for USAspending can't vary on this endpoint. Measuring vendor-name mess would need a field with raw spellings, which would be a new data path; that's for Peter to decide.
