# ADR-006: City contract feeds as a scout source (Chicago, New York City)

- **Status:** Accepted by Peter (2026-10-05: "yes, check the portals and build it"; "yes to sonnet judging").
- **Metrics this affects:** precision of top 20, hours per qualified opportunity.
- **Source check:** `docs/sources/city-open-data.md`. **Targets:** `docs/TARGETS.md` (local government).

## Context

Peter wants local-government problems for a named list of cities. Legistar covers none of them without a token. Of their open-data portals, only **Chicago** and **New York City** publish current contract data with a description, keyless. The other cities have no usable feed (see the source doc).

A city's contract for a service ("records digitization for building permits", "case management technical assistance") is a written statement of an operational need the city is already paying for. That fits gate G2's "written organizational need".

## Decision

1. **Fetch** (one SODA request per city per run, 24-hour cache, limiter, backoff):
   - Chicago `rsxa-ify5`: last 365 days, `contract_type` like `PRO SERV%`, `SOFTWARE` or `WORK SERV%`.
   - NYC `qyyg-4tf5`: last 365 days, "Services (other than human services)" and "Goods and Services".
   - `$select` lists only purpose, department, type, amount and date fields. **Contact, vendor and address fields are never requested.**
2. **Pre-filter:**
   - One row per contract (revisions collapse).
   - Description of at least 6 words.
   - Drop police, courts, corrections and emergency-communications departments (CJIS, out of scope).
   - Newest **60 per city**, so at most 120 judged per run.
3. **Judge** with Sonnet and a contract-specific prompt, `judge-contract-v1`. It uses the same schema, evidence rule and junk stripping as judge-v2.1; the gates are reworded:
   - **G1:** buys a service or system for ongoing operations, not construction, commodities, vehicles, leases or pass-through grants.
   - **G2:** states the operational work the purchase supports.
   - **G3:** fail only on a plain license renewal of a named mainstream product, or a commodity.
   - **G4:** the buying department has the need itself.
   - Free data = 3 (public).
4. **Output:** a "City contracts" block first in the workbook, with the top 15 gate-passing contracts. Then App Store (empty while Apple's feed is down), HN and USAspending. `--no-contracts` skips this source.
5. **Cost:** about $1.30 actual per refresh (120 items). The dry run estimated up to $2.37, including 2 HN retries.

## Amendment (2026-10-05, Peter: "tighten the contract prompt and rerun")

- **`judge-contract-v2`:** G1 now requires the work to be mainly information or process handling (records, documents, applications, permits, scheduling, tracking, billing, notices, case files, inspection results, testing, reporting). Physical-labor services (repairs, maintenance, cleaning, tree work, towing, guards, food service) fail.
- **Duplicate descriptions:** contracts in the same city with the same description collapse to one row.
- **Result:** 7 of 120 passed (it was 27), 17 need review, and G1 gated out 59. Vehicle repair, towing and tree pruning no longer reach the shortlist.

## Alternatives considered

| Option | Why not |
|---|---|
| Per-town scraping for the NJ towns | Each town uses a different vendor site with its own terms. Scraping isn't allowed by default, and it's slow. |
| Socrata app token (no throttling) | Free, but it's a key (AGENTS.md). One request per city per day doesn't need it. |
| Include Chicago delegate-agency grants | 4,975 rows a year of pass-through funding to nonprofits. The buyer isn't the one with the need. A possible later nonprofit signal. |
| Judge every contract | About 3,400 to 7,000 a year per city, well over the cost cap. |

## Consequences

- Real local-government needs from two large cities, with dollar amounts. Peter's NJ towns stay uncovered; there's no keyless feed for them.
- Descriptions are often terse (Chicago especially), so many will fail G2. That's expected.
- **Text sent to Anthropic:** contract descriptions, department, category and amount, which are public records. Peter approved this.
- Rollback: `--no-contracts`. The module is isolated.
