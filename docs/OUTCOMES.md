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
