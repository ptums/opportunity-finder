# PROCESS.md

How work moves from idea to merge.

## Roles

- **Peter:** product owner. Writes or approves tickets, approves ADRs, passes human gates, merges.
- **Orchestrator agent:** picks the next ready ticket, runs the loop below, never merges.
- **Builder agents:** implement one ticket per branch.

## Loop (per ticket)

1. **Ready check:** the ticket names its metric, its phase gate is open, and any ADR it needs is Accepted.
2. **Branch:** `ticket/<id>-<slug>` off `main`.
3. **Build:** tests first for parsing/matching/scoring logic. Use recorded fixtures for source adapters.
4. **Verify:** `npm run typecheck && npm test`. Paste the output into the PR.
5. **PR:** what changed, the metric targeted, real output, and a "Not checked" list.
6. **Log:** add a row to `docs/AGENT-LOG.md`.
7. **Review and merge:** Peter.

## ADRs

`docs/adr/ADR-NNN-<slug>.md` with Status, Context, Decision, Alternatives, Consequences, Rollback. Status moves Proposed → Accepted only on Peter's say-so.

## Phase gates

See REQUIREMENTS §10. The orchestrator checks the gate before starting any ticket in a new phase.
