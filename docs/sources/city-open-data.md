# Source: city open-data contract feeds (Chicago, New York City)

- **Checked:** 2026-10-05 by agent (three research checks plus category queries). Requested by Peter for his city list.
- **Verify:** [x] keyless  [~] limits (Socrata throttles anonymous use, with no published number)  [~] terms. **OK with caveats** for Chicago and NYC. Built under ADR-006.

## Peter's city list

| City | Result |
|---|---|
| **Chicago** | **Used.** data.cityofchicago.org "Contracts" (`rsxa-ify5`), updated daily |
| **New York City** | **Used.** data.cityofnewyork.us "Recent Contract Awards" (`qyyg-4tf5`), updated daily. The council's Legistar API needs a token, but this portal doesn't. |
| Philadelphia | Not usable. Professional-services contract data stops at FY2020 Q4, commodities at FY2016. Its Legistar API needs a token (403). |
| Jersey City | Not usable. The only purchasing data is 2014–2018 attachments. Legistar Web API isn't set up for it. |
| New Jersey statewide (data.nj.gov) | Not usable. No municipal contract data; state datasets lack descriptions or are frozen. Covers none of New Brunswick, Trenton, Red Bank, Toms River, Cherry Hill, Spring Lake, Middletown or Cape May. |
| Bentonville, Rogers (AR) | Not on Legistar; no keyless portal found |

## Chicago (`rsxa-ify5`)

- **Endpoint:** `https://data.cityofchicago.org/resource/rsxa-ify5.json`. HTTP 200 with no key; last modified 2026-10-05.
- **Fields we select:** `purchase_order_description`, `purchase_order_contract_number`, `revision_number`, `contract_type`, `approval_date`, `department`, `award_amount`, `contract_pdf`. **Vendor name and address fields are never selected.**
- **Volume:** about 7,060 rows in the last year, most of them delegate-agency grants (4,975) and comptroller items (1,099). We keep only `PRO SERV%`, `SOFTWARE` and `WORK SERV%` types.
- **Gotchas:** each revision is a separate row (deduplicated on contract number), and rows with no date sort first unless a date filter is applied.
- **Terms** ([chicago.gov data disclaimer](https://www.chicago.gov/city/en/narr/foia/data_disclaimer.html)):
  - The City *"may require a user of this data to terminate any and all display, distribution or other use"*.
  - Derivative applications must show a disclaimer ("…data that has been modified for use from its original source, www.cityofchicago.org…").
  - There's an indemnity clause.
  - No rate limit and no AI clause.

## New York City (`qyyg-4tf5`)

- **Endpoint:** `https://data.cityofnewyork.us/resource/qyyg-4tf5.json`. HTTP 200 with no key; last modified 2026-10-05.
- **Fields we select:** `request_id`, `start_date`, `agency_name`, `category_description`, `short_title`, `selection_method_description`, `contract_amount`, `additional_description_1` (HTML, stripped).
- **The dataset also has `contact_name`, `contact_phone`, `email` and vendor fields. These are never selected,** so no personal names are fetched.
- **Volume:** about 3,437 awards in the last year. We keep "Services (other than human services)" and "Goods and Services".
- **Terms** ([NYC Open Data Technical Standards](https://cityofnewyork.github.io/opendatatsm/publicpolicies.html)):
  - *"data sets must be available without registration requirement, license requirement, or usage restrictions"*
  - Anyone who republishes must *"explicitly identify the source, version, and modifications"*.
  - *"DoITT may implement rate-limiting on a per-visitor basis"*.
  - No AI clause.

## Rate limits (Socrata)

[dev.socrata.com/docs/app-tokens.html](https://dev.socrata.com/docs/app-tokens.html): *"IP addresses that make too many requests during a given period may be subject to throttling."* We make one request per city per day, under the 24-hour cache. App tokens are free but count as a key under AGENTS.md, so we don't use them.

## Not verified

- The anonymous throttle threshold.
- Whether Chicago's disclaimer applies to an unpublished personal script. The workbook names the source and URL either way.
- Whether Chicago revision amounts are deltas or totals.
- Descriptions can name vendor organizations, and rarely a sole proprietor, and that text goes to the judge.
