# Source: Apple App Store customer reviews

- **Checked:** 2026-10-05 by agent. Research only: one reviews-feed GET and one Search API GET; nothing stored or built.
- **Verify:** [x] keyless  [~] limits  [~] terms. **OK with caveats; needs Peter's call.** Adding it is a human gate, and so is sending review text to Anthropic (a new kind of data leaving the app).
- **Industries:** healthcare admin (practice management, billing, scheduling apps; no patient data), nonprofits (donor, volunteer, fundraising apps), local government (permitting, 311, city-services apps).

## Access (test requests 2026-10-05)

- **Reviews feed:** `https://itunes.apple.com/{country}/rss/customerreviews/id={appId}/sortby=mostrecent/json[?page=N]`
  - Returned **HTTP 200**, no key, **50 reviews per page**.
  - The feed's `last` link points at `page=10`, so the most we can get is about 500 reviews per app per country.
  - The data was current: newest review dated 2026-10-04.
- **Entry fields:** `title`, `content`, `im:rating`, `im:version`, `updated`, `id`, `link`, `im:voteSum`, `im:voteCount`, `author` (nickname and profile URL).
- **Finding app ids:** the iTunes Search API, `https://itunes.apple.com/search?term=…&entity=software`, returned **HTTP 200** without a key. Relevance is weak: the top 5 results for "medical billing" were mostly exam-prep apps, so the app list should be picked by hand, not by keyword.

## Rate limits

- Search API: *"The Search API is limited to approximately 20 calls per minute (subject to change)."* ([performance-partners.apple.com/search-api](https://performance-partners.apple.com/search-api))
- Reviews feed: no documented limit. We would apply our own 1 request per second, the 24-hour cache, and backoff.

## Terms

- **The reviews feed has no published terms of its own.** The RSS generator ([rss.marketingtools.apple.com](https://rss.marketingtools.apple.com/)) and the Tools page show no terms text and don't mention review feeds.
- The Search API terms are written for **promotion**: *"Developers may use promotional content in the API… only to promote store content and not for entertainment purposes."* Research lookups aren't addressed either way.
- Apple Website Terms of Use ([apple.com/legal/internet-services/terms/site.html](https://www.apple.com/legal/internet-services/terms/site.html), last updated November 20, 2009):

  > You may not use any "deep-link", "page-scrape", "robot", "spider" or other automatic device… to access, acquire, copy or monitor any portion of the Site or any Content… to obtain… information through any means not purposely made available through the Site.

  It's unclear whether "Site" covers the itunes.apple.com feeds. A JSON feed is arguably "purposely made available", but that's our reading, not Apple's.
- **No AI, ML, LLM or data-mining clause** was found on any of these pages, unlike Stack Exchange.

## Reliability

There's no official deprecation notice. But a dev.to post and a GitHub issue report the feed returning `200 OK` with no reviews at times. The fetcher must **treat 200 with zero entries as a failure**, not as "no reviews".

## Privacy plan

Drop the whole `author` object (nickname and profile URL) at parse time. Keep title, content, rating, app id, version, date and link.

## How it would fit the scout

Reviews are people describing problems with tools they already use, often with a buyer signal (they pay for the app). They map onto the HN gates reasonably well, although G2 ("asks for help") becomes "states what the tool fails at". Short texts may make many quotes fall under the 4-word minimum.

## Not verified

- Whether "Site" in the 2009 terms covers the feed endpoints.
- What the Apple Media Services Terms say about third parties reusing reviews.
- Throttling on the reviews feed.
- Pages 2–10 and other countries.
- How many reviews niche healthcare-admin, nonprofit and local-government apps actually have.
