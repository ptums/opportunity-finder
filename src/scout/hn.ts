// Hacker News scout: searches Ask HN via the Algolia API for pain phrases.
// Poster identity (`author`) is dropped at parse time and never stored or printed.
import { fetchJson } from "./http.js";
import { scoreText, type Scores } from "./score.js";

export const HN_PHRASES = [
  "how do you manage",
  "is there a tool",
  "spreadsheets",
  "manually",
  "hours a week",
  "tedious",
  "frustrated with",
  "would pay for",
  "too expensive",
  "alternative to",
  "reconcile",
  "duplicate records",
  "data entry",
  "merge data",
  "CSV",
];

interface AlgoliaHit {
  objectID: string;
  title?: string;
  story_text?: string | null;
  num_comments?: number | null;
  created_at: string;
}

export interface HnCandidate {
  source: "HN";
  /** HN item id (the post, not its author). */
  id: string;
  url: string;
  title: string;
  /** Full decoded post text, used for model judging; only `snippet` is written out. */
  body: string;
  snippet: string;
  publishedAt: string;
  /** Comment count: shown as popularity, not frequency (ADR-003). */
  comments: number;
  phrases: string[];
  scores: Scores;
}

// Launch posts ("I built X", "Acme – does Y") are people selling, not people describing a pain.
const LAUNCH_TITLE = /^(show hn|launch hn)\b|\b(i|we) (built|made|created|launched)\b| [–—] /i;

export const isLaunchPost = (title: string): boolean => LAUNCH_TITLE.test(title);

export function htmlToText(html: string): string {
  return html
    .replace(/<p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;|&#x22;/g, '"')
    .replace(/&#x2F;/g, "/")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

export async function scoutHn(sinceDays = 365): Promise<HnCandidate[]> {
  // Round to the day so the request URL (and therefore the cache key) is stable across re-runs.
  const today = Math.floor(Date.now() / 86_400_000) * 86400;
  const since = today - sinceDays * 86400;
  const found = new Map<string, { hit: AlgoliaHit; phrases: Set<string> }>();

  for (const phrase of HN_PHRASES) {
    const url =
      "https://hn.algolia.com/api/v1/search?" +
      new URLSearchParams({
        query: `"${phrase}"`,
        tags: "ask_hn",
        numericFilters: `created_at_i>${since}`,
        hitsPerPage: "50",
      });
    const data = await fetchJson<{ hits: AlgoliaHit[] }>("hn", url);
    for (const hit of data.hits) {
      const entry = found.get(hit.objectID) ?? { hit, phrases: new Set<string>() };
      entry.phrases.add(phrase);
      found.set(hit.objectID, entry);
    }
  }

  return [...found.values()]
    .filter(({ hit }) => hit.story_text) // Ask HN posts with no body carry little signal
    .filter(({ hit }) => !isLaunchPost(hit.title ?? ""))
    .map(({ hit, phrases }) => {
      const title = (hit.title ?? "").replace(/^Ask HN:\s*/i, "");
      const body = htmlToText(hit.story_text ?? "");
      return {
        source: "HN" as const,
        id: hit.objectID,
        url: `https://news.ycombinator.com/item?id=${hit.objectID}`,
        title,
        body,
        snippet: body.slice(0, 280),
        publishedAt: hit.created_at.slice(0, 10),
        comments: hit.num_comments ?? 0,
        phrases: [...phrases],
        scores: scoreText(`${title} ${body}`, hit.num_comments ?? 0, phrases.size),
      };
    });
}
