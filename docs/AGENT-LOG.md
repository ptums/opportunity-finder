# Agent log

One row per ticket or session. Cost is the model usage cost if known, otherwise "unknown".

| Date | Ticket | Agent/model | Wall time | Retries | Cost | Outcome | Notes |
|---|---|---|---|---|---|---|---|
| 2026-10-03 | foundation | Claude Code (claude-opus-5-5) | 1 session | 0 | unknown | Scaffold + docs; no ingestion code | Phase 0 gate respected; ADR-001 Proposed; HN + USAspending probed keyless |
| 2026-10-03 | phase0-scout | Claude Code (claude-opus-5-5) | 1 session | 1 (launch-post filter, cache-key fix) | unknown | `npm run scout` → docs/phase0-candidates.md (20 candidates, 14.3s, 0 errors); 12 unit tests pass | Pivot from fully manual Phase 0 at Peter's request; scores are rule-based guesses |
| 2026-10-03 | adr-002-hybrid-scoring | Claude Code (claude-opus-5-5) | 1 session | 1 (validation rejected empty summary on non-problems; fixed and restarted) | $0 API (local qwen3:8b, 1059s model time) | 80 HN items judged, 41 dropped, 0 failures; 15 unit tests pass | Time box removed from REQUIREMENTS at Peter's request |
