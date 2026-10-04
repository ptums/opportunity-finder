# Source: Hacker News

- **Checked:** 2026-10-03 by agent. Peter must sign off on the terms item before the ingestion ticket is built.
- **Verify:** [x] keyless  [~] limits  [ ] terms (needs Peter's judgment, see below)

## Access

| API | Base URL | Use |
|---|---|---|
| Official Firebase API | `https://hacker-news.firebaseio.com/v0/` | `askstories`, `showstories`, `item/<id>.json`, `maxitem` |
| Algolia HN Search | `https://hn.algolia.com/api/v1/` | `search_by_date?tags=ask_hn` with `numericFilters=created_at_i>…` for time-windowed backfill |

**Keyless: confirmed.** Live probe, 2026-10-03, no credentials:

```
GET /api/v1/search_by_date?tags=ask_hn&hitsPerPage=2   -> HTTP/2 200
GET /v0/maxitem.json                                   -> 49950328 HTTP 200
```

## Rate limits

- Firebase API README: *"There is currently no rate limit."* ([github.com/HackerNews/API](https://github.com/HackerNews/API))
- Algolia: 10,000 requests/hour per IP is the figure commonly cited by third parties. **I could not confirm it on a primary source** (the hn.algolia.com/api page is rendered by JavaScript, and its fetched HTML has no limit text). No `x-ratelimit` headers were returned.
- **Our self-imposed limit:** at most 1 request/second per API, plus exponential backoff on 429/5xx.

## Terms

- The Firebase API is published by HN itself under MIT (repo license). It is an official access path, not scraping.
- The YC site terms ([ycombinator.com/legal](https://www.ycombinator.com/legal/)) forbid *"data mining, robots, scraping or similar data gathering"* **on the Site**. We use only the published APIs and never fetch `news.ycombinator.com` HTML. **Open question for Peter:** do you accept that API use falls outside this clause? Many public projects read it that way, but it isn't written down explicitly.
- No Algolia-specific terms page was found for the HN index.

## Privacy (REQUIREMENTS §2, §7)

Both APIs return `by` / `author`. **The normalizer must drop these fields.** Raw payloads are stored immutably (FR-2), so raw storage will contain usernames. Options for Peter, to settle before Phase 1:
1. Strip `by`/`author` before writing to `raw_items` (recommended: raw stays immutable, minus identity fields).
2. Store raw as-is, and keep raw out of the repo and out of any export.

## Schema notes / mess

- Ask HN text (`text` / `story_text`) is HTML-escaped and needs decoding.
- Deleted or dead items come back with `deleted: true` / `dead: true` and send to `rejects`.
- "Who is hiring" content lives in child comments, which is a large fan-out. Skip it in v1 unless it's needed.

## Failure modes

Firebase item fetches are one request per item (N+1). Use Algolia for windowed listing and Firebase only for gaps. Watch for schema drift in Algolia's `_highlightResult` (ignore it, never parse it).
