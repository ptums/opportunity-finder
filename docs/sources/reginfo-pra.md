# Source: reginfo.gov Paperwork Reduction Act (PRA) inventory

- **Checked:** 2026-10-05 by agent. Research only: about 8 GETs including one full download (kept in the session scratchpad, not the repo). Nothing built.
- **Verify:** [x] keyless  [~] limits  [x] terms (reuse explicitly allowed). **OK with caveats.** Adding it is a human gate (AGENTS.md).
- **Status:** parked with ADR-004 (2026-10-05). Healthcare is out of scope (`docs/TARGETS.md`).
- **Industries:** healthcare admin (CMS and other `HealthcareIndicator` collections), local government (bundled with state and tribal), nonprofits (weak; see the filtering section).
- **What it gives us:** federally estimated **burden hours and dollars per year** for every form the public must fill in. This is pain stated as a number, by who files.

## Access

- Report list: [reginfo.gov/public/do/PRAXML](https://www.reginfo.gov/public/do/PRAXML).
  - Current Inventory (`?type=inventory`), *"updated daily"*: one XML file of about **105 MB** (`CurrentInventoryReport.xml`, `RUNDATE="05 OCT 2026"`).
  - Also Expiration (monthly), Pending (daily) and Concluded last 30 days (daily).
- A plain GET with our User-Agent and no key, cookie or captcha returned `HTTP 200`, `Content-Type: application/xml`. Range requests are ignored, so it's the whole file every time.
- Schema: [reginfo.gov/public/xml/PRAPWS.xsd](https://www.reginfo.gov/public/xml/PRAPWS.xsd). No JSON API.

## Terms

- FAQ ([reginfo.gov/public/jsp/Utilities/faq.myjsp](https://www.reginfo.gov/public/jsp/Utilities/faq.myjsp)): *"Third party organizations may use the XML data to build related applications for the web, desktops, and mobile devices."* It also warns the XML *"may include comment submitter information (i.e. commenter name)"*.
- There's no robots.txt (`/robots.txt` redirects to the dashboard), no rate limit stated, and no AI, ML or LLM clause. The site doesn't state that the data is public domain, though US federal works generally are (17 U.S.C. §105).
- Our use: one download a day at most (it updates daily), well within any reasonable limit. Our 24-hour cache fits this exactly.

## Fields (seen in the file)

- **Per collection:**
  - Identifiers: `OMBControlNumber`, `ICRReferenceNumber`, `AgencyCode` (0938 = CMS, 1545 = IRS).
  - Text: `Title`, `Abstract` (present on 8,633 of 10,699).
  - Status: `ICRTypeCode`, `ExpirationDate`, `ICRStatus`, `HealthcareIndicator`.
  - Burden totals: `BurdenResponse`, `BurdenHour` and `BurdenCost`, each with a previous value.
- **Per form:** `InformationCollection/Title`, `AffectedPublicCode/PublicCode`, `NumberResponses/AnnualQuantity`, per-form burden hours and cost, `FormNumber`, `FormName`.
- **Not populated:** `NumberofRespondentsQuantity` appears 0 times (only response counts exist), and `PrivateSectorCode` (businesses vs. not-for-profits vs. farms) appears 0 times.

## Filtering for Peter's industries (counts from the 2026-10-05 file)

- 10,699 collections, 8,633 `Active`.
- `PublicCode` has only four values: Private Sector 17,604 · Individuals or Households 7,392 · **State, Local, and Tribal Governments 6,144** · Federal Government 343.
- **Healthcare admin:** `HealthcareIndicator = Yes` 159; CMS 333.
- **Nonprofits:** can't be separated from businesses (both are "Private Sector"). Searching abstracts for "Not-for-profit" finds only 5. IRS (1545, 387 collections) includes the 990 family.
- **Local government:** filtered together with state and tribal governments.

## Gotchas

- **Staff names:** every record has `AgencyContact/Person` (a federal staffer's name, email and phone). **The parser must drop it** (AGENTS.md: no identities).
- **Size:** about 105 MB of nested XML, so it needs a streaming parser.
- **Double counting:** 2,044 records are `RCF` (common forms reused across agencies), so burden would be counted twice without removing them.
- **Messy values:** older records say "Uncollected"; dates look like `2027-01-31-05:00`; the XSD itself has typos.

## How it would fit the scout

Like USAspending, these are organizational records, not posts. The natural shape is themes such as "CMS forms filed by providers: N collections, X million burden hours a year". Rules can score Pain directly from burden hours. An LLM would only be needed to group form titles and abstracts into problems, and that text is public government text with no personal data once contacts are dropped. It needs an ADR before building.

## Not verified

- Whether the Expiration, Pending and Concluded files have the same structure, and how big they are.
- Any server throttling.
- Whether comment-submitter names appear in the inventory (none seen).
- How accurate the burden-cost estimates are.
