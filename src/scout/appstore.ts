// App Store reviews scout (ADR-005): recent reviews of operator-facing apps in Peter's target industries.
// Reviewer identity (the feed's `author` object) is dropped at parse time and never stored or printed.
import { fetchJson, stats } from "./http.js";
import { type AppEntry, APPS, type Industry } from "./appstore-apps.js";
import { scoreText, type Scores } from "./score.js";

const MAX_PAGES = 10;
const PER_PAGE = 50;
/** Rule pre-filters, applied before any model call so a run stays under the cost cap. */
export const MAX_RATING = 3;
export const MIN_WORDS = 25;
export const MAX_AGE_DAYS = 365;
export const PER_APP = 12;

export interface Review {
  id: string;
  appId: number;
  rating: number;
  title: string;
  body: string;
  version: string;
  publishedAt: string;
  votes: number;
  url: string;
}

export interface AppStoreCandidate {
  source: "App Store";
  id: string;
  app: string;
  industry: Industry;
  url: string;
  /** "[App] review title": the app name gives the judge context. */
  title: string;
  body: string;
  snippet: string;
  publishedAt: string;
  /** Review helpful-vote count, shown as popularity (not in the total). */
  comments: number;
  rating: number;
  phrases: string[];
  scores: Scores;
}

type Label = { label?: string; attributes?: Record<string, string> };
interface RawEntry {
  id?: Label;
  title?: Label;
  content?: Label;
  updated?: Label;
  link?: Label | Label[];
  "im:rating"?: Label;
  "im:version"?: Label;
  "im:voteSum"?: Label;
  author?: unknown; // deliberately never read
}
interface Feed {
  feed?: { entry?: RawEntry | RawEntry[] };
}

const text = (l: Label | undefined): string => (l?.label ?? "").trim();

/** Parse one feed page into reviews. Entries without a rating (app metadata in older feeds) are skipped. */
export function parseFeed(json: Feed, appId: number): Review[] {
  const raw = json.feed?.entry;
  const entries = raw === undefined ? [] : Array.isArray(raw) ? raw : [raw];
  const out: Review[] = [];
  for (const e of entries) {
    const rating = Number(text(e["im:rating"]));
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) continue;
    const link = Array.isArray(e.link) ? e.link[0] : e.link;
    out.push({
      id: text(e.id),
      appId,
      rating,
      title: text(e.title),
      body: text(e.content),
      version: text(e["im:version"]),
      publishedAt: text(e.updated).slice(0, 10),
      votes: Number(text(e["im:voteSum"])) || 0,
      url: link?.attributes?.href ?? `https://apps.apple.com/us/app/id${appId}?see-all=reviews`,
    });
  }
  return out;
}

const wordCount = (s: string) => s.split(/\s+/).filter(Boolean).length;

/** Keep complaints with enough text to quote, from the last year, newest first, at most PER_APP per app. */
export function preFilter(reviews: Review[], now = Date.now()): Review[] {
  const cutoff = new Date(now - MAX_AGE_DAYS * 86_400_000).toISOString().slice(0, 10);
  return reviews
    .filter((r) => r.rating <= MAX_RATING && wordCount(r.body) >= MIN_WORDS && r.publishedAt >= cutoff)
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
    .slice(0, PER_APP);
}

export const appStoreStats = { apps: 0, reviews: 0, kept: 0, emptyFeeds: [] as string[] };

async function fetchApp(app: AppEntry): Promise<Review[]> {
  const all: Review[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const url = `https://itunes.apple.com/us/rss/customerreviews/page=${page}/id=${app.id}/sortby=mostrecent/json`;
    const reviews = parseFeed(await fetchJson<Feed>("appstore", url), app.id);
    // A 200 with no entries on page 1 is a feed failure (reported outages), never "no reviews".
    if (page === 1 && reviews.length === 0) {
      appStoreStats.emptyFeeds.push(app.name);
      stats.appstore!.errors++;
      break;
    }
    all.push(...reviews);
    if (reviews.length < PER_PAGE) break;
  }
  return all;
}

export async function scoutAppStore(apps: AppEntry[] = APPS): Promise<AppStoreCandidate[]> {
  const out: AppStoreCandidate[] = [];
  for (const app of apps) {
    let reviews: Review[];
    try {
      reviews = await fetchApp(app);
    } catch (err) {
      // One failing app never blocks the others (REQUIREMENTS §8).
      console.error(`appstore: ${app.name} failed: ${(err as Error).message.slice(0, 120)}`);
      continue;
    }
    appStoreStats.apps++;
    appStoreStats.reviews += reviews.length;
    const kept = preFilter(reviews);
    appStoreStats.kept += kept.length;
    for (const r of kept) {
      const scores = scoreText(`${r.title} ${r.body}`, r.votes, 0);
      out.push({
        source: "App Store",
        id: r.id,
        app: app.name,
        industry: app.industry,
        url: r.url,
        title: `[${app.name}] ${r.title}`,
        body: r.body,
        snippet: r.body.slice(0, 280),
        publishedAt: r.publishedAt,
        comments: r.votes,
        rating: r.rating,
        phrases: [app.industry],
        // Reviews show demand; they aren't a public dataset to build on (ADR-005).
        scores: { ...scores, freeData: { value: 1, reason: "app reviews: demand signal, no public dataset" } },
      });
    }
  }
  return out;
}
