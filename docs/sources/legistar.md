# Source: Legistar Web API (Granicus): city and county council matters

- **Checked:** 2026-10-05 by agent. Research only: two test GETs and one filter GET; nothing stored or built.
- **Verify:** [~] keyless (per city)  [~] limits  [~] terms. **OK with caveats.** Adding it is a human gate (AGENTS.md).
- **Industry:** local government. The signal is contract approvals, procurement items and resolutions, in the city's own words.

## Access

- Base URL is `https://webapi.legistar.com/v1/{client}/…`, where `{client}` matches the city's `{client}.legistar.com` subdomain.
- **Keyless works for some cities but not all.** The docs ([webapi.legistar.com/Home/Examples](https://webapi.legistar.com/Home/Examples)) say: *"Some clients require use of API tokens for access."*
  - `GET /v1/seattle/matters?$top=2` returned `HTTP/1.1 200 OK` with 2 JSON records.
  - `GET /v1/nyc/matters?$top=1` returned **403**. NYC hands out tokens through an email form ([council.nyc.gov/legislation/api](https://council.nyc.gov/legislation/api/)), so **NYC and any other token-only city are excluded** (AGENTS.md: no source that needs a key).
- The docs also say only public records are returned: *"Items returned to GET requests are limited to those items marked as public and available for view on InSite."*
- No documented endpoint lists all clients. Each city has to be probed individually.

## Limits and paging

- *"queries replies are limited to 1000 responses"*. Paging uses `$top`/`$skip`, and filtering follows OData v3, e.g. `$filter=MatterIntroDate ge datetime'2026-01-01' and substringof('contract',MatterTitle)`. A test of that filter returned 200; the number of results wasn't counted.
- No rate limit is documented. We would apply our own 1 request per second, the 24-hour cache, and backoff on 429/5xx.

## Terms

- The API pages ([webapi.legistar.com](https://webapi.legistar.com/), `/Help`) carry **no terms, no license and no rate-limit text**. The only footer is "© 2026 - Granicus".
- The general Granicus Terms of Use ([granicus.com/trust-center/terms-of-use](https://granicus.com/trust-center/terms-of-use/), last updated July 20, 2026) are written for people visiting granicus.com:
  - *"Use of the information contained on this website is solely intended for individual and private use"*
  - No renting, leasing or selling of materials.
  - Access can be revoked without notice.
  - **They say nothing about APIs, automated access, data mining, AI or LLMs, or attribution.**
- **Reading:** the matters are public city records. Our use is personal and non-commercial, which fits "individual and private use". There is no AI clause like the one that blocked Stack Exchange. **Not verified:** whether a Granicus subscription agreement covers third-party readers of the API, and each city's own terms.

## Useful fields

`MatterTitle`, `MatterName`, `MatterTypeName` (e.g. "Ordinance", "Resolution", contracts vary by city), `MatterStatusName`, `MatterBodyName`, `MatterIntroDate`, `MatterAgendaDate`, `MatterPassedDate`, `MatterCost`, `MatterLastModifiedUtc`. Full text and attachments are under `Matters/{id}/Texts` and `/Attachments`; whether these work without a key is not verified.

## Privacy plan

- **Drop:** `MatterRequester`, the `/Sponsors` sub-resource (elected officials), `MatterNotes`, and the free-text `MatterText1–5` / `MatterEXText1–11` fields unless needed.
- **Watch:** titles and text can name contractors or residents, and that text would go to the LLM judge. Peter approved sending public post text, but this is a new kind of text, so it needs his OK.

## How it would fit the scout

Matters are organizational records, not posts by people with a problem. G4 ("the author has the problem") and G2 ("asks for help") don't map cleanly, so this source would need its own gate wording or a USAspending-style summary (e.g. "N cities approved contracts for X"). That is a design decision for an ADR before any build.
