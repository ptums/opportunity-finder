# ADR-004: Paperwork Reduction Act (PRA) burden data as a scout source

- **Status:** Parked (Peter, 2026-10-05). Peter wants to avoid heavily regulated work such as HIPAA and Medicaid (see `docs/TARGETS.md`). PRA data measures regulatory paperwork, so it points at the most regulated industries. Kept for the record; reopen only if nonprofit Form 990 or local-government reporting burden becomes the focus.
- **Date:** 2026-10-05
- **Metrics this affects:** precision of top 20 (primary), hours per qualified opportunity.
- **Source check:** `docs/sources/reginfo-pra.md` (keyless; reuse explicitly allowed).

## Context

HN is engineering-heavy, and Peter wants problems in **healthcare admin, nonprofits and local government**. reginfo.gov publishes every federal information collection (form) with the government's own estimate of **burden hours and dollars per year**, and who must file it. A first look at the 2026-10-05 file (8,633 active collections, excluding reused common forms):

| Segment | Collections | Burden hours/yr | Biggest examples |
|---|---|---|---|
| Healthcare (HealthcareIndicator or CMS) | 380 | 546M | Medicaid eligibility changes 72.9M · MA encounter data 48.9M · Advance Beneficiary Notice 38.7M · Price transparency 28.6M |
| State/local/tribal government respondents | 1,875 | 1,958M | HIPAA privacy rule 954M · SNAP forms 142.8M · Real ID 34.9M |
| Nonprofits (IRS exempt-org) | 8 | 76M | U.S. Tax-Exempt Organization Returns (990 family) 75.5M |

These are records, not posts, so the HN gates (G2 "asks for help", G4 "author has the problem") don't apply. The source works like USAspending: summaries scored by rules.

## Decision

1. **Fetch:** download the Current Inventory XML (about 105 MB) at most once a day, with `USER_AGENT`, through the existing per-source limiter, 24-hour cache and 429/5xx backoff. `http.ts` gets a fetch-to-file variant, because the file is too big for the JSON path.
2. **Parse:** stream the file with **`sax`** (new dependency, MIT, no dependencies of its own). The approved list was the Anthropic SDK and a schema validator, so this needs Peter's OK. Node has no built-in XML parser, and loading 105 MB into a DOM is risky. Keep only: OMB control number, title, abstract, agency code, status, healthcare indicator, affected-public codes, responses/yr, burden hours/yr, burden cost/yr, form numbers and names. **Never read `AgencyContact`** (federal staff names, emails and phones).
3. **Filter:** status Active; drop `RCF` (reused common forms) and titles starting "Generic Clearance". Assign segments:
   - **Healthcare admin:** HealthcareIndicator = Yes or agency CMS, excluding collections whose only respondents are individuals (patients), to stay on the admin side.
   - **Local government:** affected public includes "State, Local, and Tribal Governments".
   - **Nonprofits:** IRS exempt-organization collections, plus titles or abstracts mentioning not-for-profit or tax-exempt. This is acknowledged as thin; ProPublica is being checked to fill the gap.
4. **Candidate** = one collection in one segment. Top **5 per segment** (15 rows) go into the workbook as a third block after HN and USAspending, with Source = `PRA (healthcare)`, `PRA (local gov)` or `PRA (nonprofit)`.
5. **Scores (rules, each with a reason, as for USAspending):**
   - **Pain:** total burden hours/yr. ≥10M = 3, ≥1M = 2, otherwise 1.
   - **Frequency:** responses/yr. ≥1M = 3, ≥10k = 2, otherwise 1.
   - **Messy:** number of distinct forms in the collection. ≥3 = 3, 2 = 2, 1 = 1.
   - **Backend:** 2 by default ("forms intake and reporting"), marked as a guess.
   - **Reachable:** 2 by segment ("known professional community"), marked as a guess.
   - **Buyer:** government or private-sector filers = 3; individuals only = 1.
   - **Free data:** 3 (public).
   - **Popularity:** not used.
6. **No LLM in this ADR.** Sending PRA titles and abstracts to the Anthropic API would be new data leaving the app. If rules alone rank too much noise (for example, rule-driven forms with no software angle), a follow-up ADR can propose a one-gate judge ("could software cut this burden?", with a quote from the abstract).

## Alternatives considered

| Option | Why not |
|---|---|
| LLM judge on every collection now | Costs money and adds a new outbound data type before rules are shown to be too weak. |
| Full DOM parse (no new dependency) | 105 MB of nested XML in memory. A streaming parser is safer and still small. |
| Regex splitting on `<InformationCollectionRequest>` | No dependency, but brittle against schema quirks. Kept as the fallback if `sax` is declined. |
| Rank by total hours across all segments | HIPAA (954M hours) and federal tax forms would crowd out everything else. Ranking within segments keeps each industry visible. |

## Consequences

- Healthcare admin, local government and (thinly) nonprofits show up in the shortlist, each with a stated pain number.
- Many scores are rule guesses (Backend, Reachable). The workbook says so, and Peter's labels will show whether the ranking helps.
- The biggest collections are rules everyone must follow (HIPAA, Medicaid). A high burden doesn't mean a small product can help. That's the main risk to precision, and it's what labels will measure.
- One 105 MB download a day; parse time is to be measured.
- REQUIREMENTS §5 gets a row for reginfo.gov PRA (keyless, terms OK).
- Tests: unit tests for field extraction (from a small recorded XML fixture with contact fields removed), segment filters, de-duplication and scoring. No live calls in CI.

## Rollback

`--no-pra` skips the source. The adapter is one module with no shared state; removing it and the `sax` dependency restores the current scout.
