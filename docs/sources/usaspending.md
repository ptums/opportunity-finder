# Source: USAspending API

- **Checked:** 2026-10-03 by agent
- **Verify:** [x] keyless  [~] limits  [x] terms

## Access

- Base: `https://api.usaspending.gov/api/v2/`
- Main endpoint: `POST /search/spending_by_award/` (filters: `award_type_codes`, `time_period`; paginated with `limit`/`page`)
- Endpoint docs: https://api.usaspending.gov/docs/endpoints

**Keyless: confirmed.** Live probe, 2026-10-03, no credentials:

```
POST /api/v2/search/spending_by_award/  {award_type_codes:[A,B,C,D], time_period:2026-09-01..30, limit:2}
-> HTTP/1.1 200 OK, returned "HDR-OBG A JOINT VENTURE", "CDM FEDERAL PROGRAMS CORPORATION", ...
```

## Rate limits

- **No documented rate limit found.** The docs endpoint page has no rate-limit or API-key text, and no `x-ratelimit` headers were returned (a `Cache-Trace` header was).
- **Our self-imposed limit:** at most 1 request/second, backoff on 429/5xx, and cache raw responses per date window.

## Terms

Federal spending data published under the DATA Act. The API source code is CC0-1.0 ([repo](https://github.com/fedspendingtransparency/usaspending-api)). It is a US government public data service with no login.

## Privacy

Recipients are organizations. Some sole-proprietor recipients may be individuals' names. **Open question for Peter:** do we exclude recipients flagged as individuals (`recipient_type` / business categories), or accept them as public business records?

## Schema notes / mess

- `Recipient Name` has variants (JVs, "INC" vs "INC.", parent/child). `Recipient UEI` is the best key for exact match. Fall back to fuzzy matching when it's missing.
- `Description` is free-text, all caps, and often truncated.
- `generated_internal_id` is stable and is our `external_id`.

## Failure modes

Large windows paginate deeply, so ingest in daily windows. Expect occasional 5xx under load. Award amounts change when modifications are filed, so re-fetching a window can return updated rows with the same id. Keep that idempotent (new raw version, same normalized item).
