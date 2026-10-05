# ADR-005: App Store reviews as a scout source

- **Status:** Accepted by Peter (2026-10-05). **Blocked: the feed returned 0 reviews for every app tested on 2026-10-05 afternoon**, in the US and UK, JSON and XML, including an app that returned 50 reviews that morning. It answers HTTP 200 with no entries, which matches the outage reports in `docs/sources/app-store-reviews.md`. The adapter is built and treats this as a failure. Sending review text to Anthropic still needs Peter's OK.
- **Date:** 2026-10-05
- **Metrics this affects:** precision of top 20 (primary), hours per qualified opportunity, cost per 1,000 items.
- **Source check:** `docs/sources/app-store-reviews.md`. **Targets:** `docs/TARGETS.md`.

## Context

HN is engineering-heavy. Peter's target industries (`docs/TARGETS.md`) are where people use small-business tools and complain about them in App Store reviews. The review feed is keyless (50 per page, up to 10 pages per app). Apple publishes no terms for the feed, and its 2009 website terms ban "robots" on "the Site". Peter accepted that risk on 2026-10-05 with the mitigations below.

iTunes Search API lookups (2026-10-05, 33 calls, 3 seconds apart) show where coverage is real:

| Industry | Coverage | Proposed apps (rating count, operator-facing unless marked) |
|---|---|---|
| Trades and home services | Strong | Housecall Pro 30.5k · Jobber 21.1k · Joist 14.2k · Workiz 2.2k · ServiceTitan Mobile 1.7k |
| Property management | Strong | DoorLoop 6.0k · Buildium 4.5k · TenantCloud 6.3k · RentRedi 15.5k (landlords and tenants) |
| Events and venues | Strong | Eventbrite Organizer 32.5k · HoneyBook 16.3k |
| Associations and churches | Medium | Planning Center Services 2.2k · Breeze ChMS 31 |
| Nonprofits | Thin | Givebutter 122 · SignUpGenius 148 · My Impact (Better Impact) 127 |
| Local government | Thin | None operator-facing found. SeeClickFix 8.3k is used by residents. Local government stays with Legistar. |
| Small farms | None | Farmbrite 5 · AgriWebb 15. Skipped. |

## Decision

1. **App list as data.** `src/scout/appstore-apps.ts` holds the 16 apps above with id, name, industry and audience (`operator` or `mixed`). Peter edits this list; there's no keyword crawling. Customer-facing apps (Church Center, Tithe.ly, Wild Apricot members, SeeClickFix) are left out at first because their reviewers aren't the buyer.
2. **Fetch.** `https://itunes.apple.com/us/rss/customerreviews/id={id}/sortby=mostrecent/page={n}/json`, pages 1–10:
   - `USER_AGENT`, the per-source limiter (1 request/second), 24-hour cache, and backoff on 429/5xx.
   - Stop when a page has fewer than 50 entries.
   - **A 200 response with zero entries on page 1 is logged as a feed failure**, never as "no reviews".
   - About 16 × 10 = 160 requests for a full refresh (about 3 minutes).
   - Stop at once if Apple objects.
3. **Store only** review id, app id, industry, rating, title, body, app version, date and link. **The `author` object (nickname and profile URL) is dropped at parse time.**
4. **Pre-filter with rules before any model call**, to keep cost under the cap:
   - Rating ≤ 3: complaints and gaps, not praise.
   - Body ≥ 25 words, so the 4-word quotes rule can work.
   - Last 12 months.
   - At most **12 qualifying reviews per app**, most recent first. That's at most about 192 items per run.
5. **Judge with a review-specific prompt, `judge-review-v1`.** Same JSON schema, evidence rule and junk stripping as judge-v2.1; only the wording changes:
   - **G1 current problem:** a problem with the reviewer's work happening now, not a billing dispute, a login bug alone, or general praise or anger.
   - **G2 concrete gap:** states what the tool fails at or lacks for their work. This replaces "asks for help".
   - **G3 not already solved:** fail only if the review itself names another product that already does it, or the gap is a plain bug the vendor will fix. Must name the product or say "bug".
   - **G4 operator:** the reviewer runs or works in the business that uses the tool, not a customer of that business (for example a tenant or a church member).
   - **Scores:** Pain, Messy, Backend, Reachable and Buyer as in judge-v2.1. **Free data = 1** (the reviews show demand, not a public dataset). **Popularity** = the review's vote count, shown and not totaled.
6. **Judge model:** Sonnet (`--judge sonnet`, the current default), with the cost estimate and caps as today. 192 items ≈ $2.30 actual, about $3.90 capped estimate, under the $5 per-run cap. **Data leaving the app:** review title and body only, no author fields. This needs Peter's explicit OK.
7. **Output.** A new "App Store" block in the workbook, before HN: the top 12 gate-passing reviews, ranked by total, showing the app name and industry. HN and USAspending stay as they are. `--no-appstore` skips the source.
8. **Eval.** Peter labels about 60 reviews (a frozen fixture with no author fields; labels local and gitignored, as for HN) before we trust the ranking.

## Alternatives considered

| Option | Why not |
|---|---|
| Keyword search for apps | Search relevance is poor ("medical billing" returned exam-prep apps). A hand-picked list is cheaper and on-target. |
| Judge every review | Up to 9,000 reviews per refresh means well over the $5 cap. Rule pre-filters cut it to about 192. |
| Reuse judge-v2.1 unchanged | "Asks for help" and "author has the problem" misfire on reviews, which rarely ask for help. |
| Haiku instead of Sonnet | Cheaper and had no junk, but its gates were much weaker on HN. It can be compared on the review eval set. |
| Include customer-facing apps | Their reviewers are tenants, members or residents, so Buyer would mostly be 1. They can be added to the list later. |

## Consequences

- Trades, property management and events get strong coverage. Churches are medium. Nonprofits are thin, so ProPublica stays the plan there; local government stays with Legistar. Farms are not covered.
- Reviews of one app repeat the same complaint. The scout doesn't cluster (out of scope), so the top 12 may hold near-duplicates. That's a visible signal of frequency, not hidden.
- Apple terms risk is accepted by Peter and limited by the mitigations. If Apple objects, `--no-appstore` and deleting `appstore-apps.ts` remove the source.
- New code: a fetch adapter, a parser, pre-filters, the prompt file and a workbook block. **No new dependencies.**
- Tests: parser on a recorded feed fixture (author removed), the zero-entries-is-failure rule, pre-filters, and gate wording through the existing evidence tests.
- REQUIREMENTS §5 gets an App Store row (keyless; terms unclear; risk accepted by Peter).

## Rollback

`--no-appstore`, or remove the module and the app list. Nothing else depends on it.
