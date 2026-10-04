# ADR-002: Scoring method (hybrid rules + local model)

- **Status:** Accepted by Peter (2026-10-03: "let's go with an ollama model")
- **Date:** 2026-10-03
- **Metrics this affects:** precision of top 20, hours per qualified opportunity, cost per 1,000 items

## Context

The Phase 0 scout scored candidates with keyword rules only. Its first run showed the rules fail on the judgment criteria. A post about LLM coding tools got Pain 3 from a stray number, Reachable was a default guess for every item, and launch and chat posts reached the top 20. Frequency and Free data, on the other hand, are counts or facts about the source, so rules handle them well.

## Decision

Score with a **hybrid**: each criterion goes to whichever method suits it.

| Criterion | Method |
|---|---|
| Frequency | Rule (comments, phrase matches, agency counts) |
| Free data | Rule (fixed by source) |
| Pain, Reachable, Backend weight | Local model |
| Messy data | Model for HN text, rule (vendor-name variants) for USAspending |

The model also decides whether a post **is a problem at all** (filters launches and chat) and writes the **one-line problem**.

- **Runtime:** Ollama on localhost, default model `qwen3:8b` (override: `OF_OLLAMA_MODEL`). Temperature 0, thinking off, JSON-schema structured output.
- **Provenance (FR-17):** every model-made score is tagged `method: model` along with the model name and prompt version (`judge-v1`). Judgments are cached by model + prompt version + text hash, so changing either re-judges.
- **Fallback:** if Ollama is down or returns invalid output, that item keeps its rule scores and the reason says so. A model failure never blocks a run.
- **Scope (v0):** HN items only. USAspending themes are already aggregates, so they keep their rule scores.

## Alternatives considered

| Option | Why not |
|---|---|
| Rules only | Measured noise in the 2026-10-03 run (see above). |
| Hosted model (Anthropic API) | Better judgment, but it sends data off the app (a human gate), needs a key, and costs about $2–4 per run. Can be revisited if the local model's precision is too low. |
| Model for all six criteria | Frequency and Free data are facts; a model would only add noise. |

## Consequences

- No API cost and no data leaves the machine. "Cost per 1,000 items" is local compute time only, which is logged.
- About 8–12 s per item on an M2 with 16 GB, so the default judges the top 80 rule-ranked items (about 12 min); `--judge-all` judges everything.
- Rules pre-select which items the model sees, so a post the rules badly under-score can be missed. `--judge-all` removes that bias.
- Rule and hybrid totals are both kept, so Peter's labels can measure whether the model actually improved precision.

## Rollback plan

Run with `--no-model` to get rules-only scoring. Nothing downstream depends on model output beyond the scores, which are recomputed on every run.
