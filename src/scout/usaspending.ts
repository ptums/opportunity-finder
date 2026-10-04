// USAspending scout: for each data-heavy service keyword, pull a year of contract awards
// and summarize the theme (how many agencies buy it, total spend, vendor-name variants).
// Output is aggregate counts only; no recipient names are printed.
import { fetchJson } from "./http.js";
import { countNameVariants, type Scored, type Scores } from "./score.js";

export const USA_KEYWORDS = [
  "data entry",
  "records management",
  "digitization",
  "data cleansing",
  "reconciliation",
  "case management system",
  "grants management",
  "legacy system modernization",
  "manual processing",
];

const PAGES_PER_KEYWORD = 3; // 300 awards max per theme

interface Award {
  "Award ID": string;
  "Recipient Name": string | null;
  "Award Amount": number | null;
  "Awarding Agency": string | null;
  generated_internal_id: string;
}

export interface UsaCandidate {
  source: "USAspending";
  url: string;
  title: string;
  snippet: string;
  publishedAt: string;
  phrases: string[];
  scores: Scores;
}

const usd = (n: number) =>
  n >= 1e9 ? `$${(n / 1e9).toFixed(1)}B` : n >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : `$${Math.round(n / 1e3)}K`;

export function scoreTheme(awards: number, agencies: number, totalUsd: number, variants: number): Scores {
  const tier = (v: number, hi: number, mid: number): 1 | 2 | 3 => (v >= hi ? 3 : v >= mid ? 2 : 1);
  const s = (value: 1 | 2 | 3, reason: string): Scored => ({ value, reason });
  return {
    frequency: s(tier(agencies, 10, 3), `${agencies} agencies, ${awards} awards`),
    pain: s(tier(totalUsd, 10e6, 1e6), `${usd(totalUsd)} spent in window`),
    messy: s(tier(variants, 3, 1), `${variants} vendor names with multiple spellings`),
    backend: s(3, "data-processing service by keyword choice"),
    reachable: s(1, "government buyers are hard to reach (guess; vendors may be easier)"),
    freeData: s(3, "USAspending is public"),
  };
}

export async function scoutUsaspending(start: string, end: string): Promise<UsaCandidate[]> {
  const out: UsaCandidate[] = [];
  for (const keyword of USA_KEYWORDS) {
    const awards: Award[] = [];
    for (let page = 1; page <= PAGES_PER_KEYWORD; page++) {
      const data = await fetchJson<{ results: Award[]; page_metadata: { hasNext: boolean } }>(
        "usaspending",
        "https://api.usaspending.gov/api/v2/search/spending_by_award/",
        {
          filters: {
            keywords: [keyword],
            award_type_codes: ["A", "B", "C", "D"],
            time_period: [{ start_date: start, end_date: end }],
          },
          fields: ["Award ID", "Recipient Name", "Award Amount", "Awarding Agency"],
          sort: "Award Amount",
          order: "desc",
          limit: 100,
          page,
        },
      );
      awards.push(...data.results);
      if (!data.page_metadata.hasNext) break;
    }
    if (awards.length === 0) continue;

    const agencies = new Set(awards.map((a) => a["Awarding Agency"]).filter(Boolean)).size;
    const totalUsd = awards.reduce((sum, a) => sum + (a["Award Amount"] ?? 0), 0);
    const variants = countNameVariants(awards.map((a) => a["Recipient Name"] ?? ""));
    const capped = awards.length >= PAGES_PER_KEYWORD * 100 ? "+" : "";

    out.push({
      source: "USAspending",
      // No stable deep link for a keyword search, so link the largest award as an example.
      url: `https://www.usaspending.gov/award/${awards[0]!.generated_internal_id}`,
      title: `Agencies repeatedly buy "${keyword}" services`,
      snippet: `${awards.length}${capped} contract awards from ${agencies} agencies, ${usd(totalUsd)} total (top awards by amount), ${variants} vendors appearing under multiple spellings.`,
      publishedAt: `${start}..${end}`,
      phrases: [keyword],
      scores: scoreTheme(awards.length, agencies, totalUsd, variants),
    });
  }
  return out;
}
