# Source: Stack Exchange API

- **Checked:** 2026-10-04 by agent (Step 4 of the scorer-v2 brief). Nothing has been built and no API calls were made.
- **Verify:** [~] keyless  [~] limits  [x] terms → **BLOCKED for the planned use.**
- **Decision (Peter, 2026-10-04):** option 3. Stack Exchange is dropped from the scout, and Step 6 runs on HN only.

## Verdict

Stack Exchange's Acceptable Use Policy forbids automated collection of Network content for LLM or machine-learning purposes, testing and benchmarking included, unless Stack Exchange gives written consent. The planned use does two of those things. It sends Stack Exchange post text to an LLM judge (`--judge sonnet`), and it measures judges against a labeled set (the Step 3 comparison). **Don't add this source in its LLM-judged form without written consent from Stack Exchange.**

## Terms (primary sources, read 2026-10-04)

Read with one `curl` per page. WebFetch can't reach stackoverflow.com or api.stackexchange.com.

**Acceptable Use Policy** ([stackoverflow.com/legal/acceptable-use-policy](https://stackoverflow.com/legal/acceptable-use-policy)), quoted:

> Except for what is necessary for human interaction with the Network (such as local browser caching), you may not use, launch, or distribute any automated system, including without limitation, any spider, bot/robot, cheat utility, scraper, unauthorized script, offline reader, data miners, or similar automated data gathering or extraction tools, to access any Network website or Service, or to collect, gather, or copy any text, files, audio or visual media, profile information, or any other content in any form, from any Network website or Service, for the purpose of:
> - Building a similar or competitive website, product, or service; or
> - Developing, building, training, testing, indexing, benchmarking, or improving any generative AI, chatbot, large language, or machine learning tool, model, or platform, or any similar technology.
> - Or any purpose, if such activity occurs at a volume or frequency that negatively impacts Network bandwidth, or limits or prevents Network access for other users.
>
> Your usage of automated data-gathering means is exempt from this policy if you have obtained express prior written consent. Examples of written exceptions that may be granted include for accessibility reasons or as part of a commercial license agreement.

The policy says "any Network website or Service", and the API is a Service, so I read it as covering API access as well as scraping. The Public Network Terms incorporate the AUP.

**API Terms of Use** ([stackoverflow.com/legal/api-terms-of-use](https://stackoverflow.com/legal/api-terms-of-use)):
- *"All Applications must ensure they visually indicate that the Stack Exchange Network is the source of the content provided through the API Services."*
- Using the API also binds us to the Stack Exchange Terms of Service.

**Public Network Terms of Service** ([stackoverflow.com/legal/terms-of-service/public](https://stackoverflow.com/legal/terms-of-service/public), last updated November 13, 2025):
- *"The Stack Overflow API shall be used solely pursuant to the terms of the API Terms of Use."*
- Content that isn't fetched through the API may be downloaded or stored only *"for … personal, noncommercial use"* without written permission.

**License** ([stackoverflow.com/help/licensing](https://stackoverflow.com/help/licensing)): content from 2018-05-02 onward is CC BY-SA 4.0, from 2011-04-08 to 2018-05-01 it is CC BY-SA 3.0, and older content is CC BY-SA 2.5. Attribution means a link to the post, at least, which the scout already stores as the source URL.

## Access and quota

- **Keyless access** is a long-standing feature of the API, but I did not probe it, because the terms question comes first. **Unverified.**
- **Quota:** the throttle page ([api.stackexchange.com/docs/throttle](https://api.stackexchange.com/docs/throttle)) gives 10,000 requests per day for requests that send an app key. It does not state the keyless daily quota; the 300 per day per IP figure often quoted elsewhere is **unverified**.
- **Throttles** (quoted from that page):
  - More than 30 requests per second from one IP gets the IP banned.
  - When a response has a `backoff` field, *"it must wait that many seconds before hitting the same method again."*
  - *"No application should make semantically identical requests more than once a minute."*

  The scout's 1 request per second, 24-hour cache and 429/5xx backoff would meet these. A `backoff` handler would need to be added.

## If Peter wants to proceed anyway, options (his call)

1. **Ask for written consent** (the AUP lists commercial license agreements as one route; contact via stackoverflow.com/legal). This is the only route that keeps the LLM judge on Stack Exchange posts within the terms as written.
2. **Rules-only Stack Exchange.** Fetch through the API and score with rules only, with no model and no benchmarking. The AI clause would then arguably not apply. However, the rules performed worst in Phase 0, so this adds volume without adding judgment.
3. **Drop Stack Exchange** from v1 and pick another keyless source whose terms allow LLM processing. Any candidate needs its own check and is a human gate.

## Privacy plan (if ever built)

The API returns an `owner` object (`display_name`, `user_id`, `link`, `profile_image`). A custom filter from `/filters/create` can exclude `owner` entirely, so identities never reach us. We would keep only body, title, tags, score, answer count, link and creation date.
