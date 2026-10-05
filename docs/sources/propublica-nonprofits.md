# Source: ProPublica Nonprofit Explorer API

- **Checked:** 2026-10-05 by agent. Research only: 3 API GETs (one search, two organizations); nothing stored or built.
- **Verify:** [x] keyless  [~] limits  [x] terms (personal, non-commercial use OK). **OK with caveats.** It's already listed as a v1 source in REQUIREMENTS §5, but building it is still a human gate and needs an ADR.
- **Industry:** nonprofits. This fills the gap the PRA data leaves (see ADR-004).

## Access

- Docs: [projects.propublica.org/nonprofits/api](https://projects.propublica.org/nonprofits/api). There's no key; the docs say *"Usage constitues agreement to our Data Terms of Use."*
- Base URL: `https://projects.propublica.org/nonprofits/api/v2`.
  - `GET /search.json`: `q`, `page` (zero-indexed), `state[id]`, `ntee[id]` (1–10), `c_code[id]`. **25 results per page** (reduced from 100 on 2023-09-12). No max page stated.
  - `GET /organizations/:ein.json`: the organization plus its filings (there is no separate filings endpoint).
- Test results:
  - `search.json?q=food+bank` returned **HTTP 200**, `total_results 842, num_pages 34, per_page 25`.
  - Two organization requests returned **HTTP 200**. One had no filing data; the other had 13 filings with data.
  - The responses carry `cache-control: public, max-age=86400`, which matches our 24-hour cache.

## Terms ([projects.propublica.org/datastore/terms](https://projects.propublica.org/datastore/terms/), published 2025-02-13)

> You can't republish the raw data in its entirety or otherwise distribute the data (in whole or in part) on a stand-alone basis. … You can't change the data except to update or correct it. … You can't charge people money to look at the data or sell advertising specifically against it. … You can't sub-license or resell the data to others. … If you use the data for publication, you must cite ProPublica. … there may be different terms included for some datasets.

- Our personal research use fits these terms. **We must cite ProPublica** wherever its data shows up (workbook rows and the README), and we must **not commit raw responses** to the public repo; only scored summaries go in.
- No AI, ML, LLM, automated-access or rate-limit clauses. Only PDF downloads are described as rate limited.

## Fields

- **In the API (per filing):** `totrevenue`, `totfuncexpns`, `totassetsend`, `totliabend`, `totnetassetend`, `totprgmrevnue`, `totcntrbgfts`, `compnsatncurrofcr`, `pct_compnsatncurrofcr`, `othrsalwages`, `payrolltx`, `profndraising`, `grsincfndrsng`, `lessdirfndrsng`, `tax_prd_yr`, `formtype`.
- **On the organization:** `ntee_code`, `state`, `subseccd`.
- **Not in the API:** the program / management / fundraising expense split, employee and volunteer counts, and mission text. Those exist only in the IRS 990 XML. So admin and fundraising ratios can only be approximated, and there's no mission text to judge.

## Privacy plan

No officer names or per-person pay come back, only the aggregate officer compensation. **Drop `careofname`**, which can be a person's name.

## Alternative noted

IRS Form 990 e-file XML ZIPs ([irs.gov/charities-non-profits/form-990-series-downloads](https://www.irs.gov/charities-non-profits/form-990-series-downloads), through August 2026, no registration seen) have the full expense split, staff counts and mission text, but also officer names. A future option if the API's fields prove too thin. Its terms are not checked.

## Not verified

- Whether "different terms" apply to Nonprofit Explorer specifically.
- A maximum number of search pages.
- Real rate limits.
- Whether sending ProPublica data to an LLM is acceptable (the terms are silent).
- The IRS bulk-file terms.
