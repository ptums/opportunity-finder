// Rule-based scoring for Phase 0 candidates. Every score carries a reason so Peter can
// see how it was produced and override it (FR-17, FR-18). These are heuristics, not truth.

import type { Judgment } from "./judge.js";

export type Score = 1 | 2 | 3;

export interface Scored {
  value: Score;
  reason: string;
  /** Absent = rule-based. Set when a model produced the score (FR-17). */
  model?: { name: string; promptVersion: string };
  /** Verbatim quote the model cited (judge-v2). */
  quote?: string;
  /** Set when the cited quote failed the evidence check; the score is left out of the total (ADR-003). */
  unsupported?: true;
}

export interface Scores {
  frequency: Scored;
  pain: Scored;
  messy: Scored;
  backend: Scored;
  reachable: Scored;
  freeData: Scored;
  /** judge-v2 only. When present, the total drops Frequency and adds Buyer (ADR-003). */
  buyer?: Scored;
}

const counted = (x: Scored): number => (x.unsupported ? 0 : x.value);

/** v1 / rules: sum of the six criteria. v2 (Buyer present): Frequency out, Buyer in, unsupported scores skipped. */
export const total = (s: Scores): number =>
  s.buyer
    ? [s.pain, s.messy, s.backend, s.reachable, s.buyer, s.freeData].reduce((sum, x) => sum + counted(x), 0)
    : s.frequency.value + s.pain.value + s.messy.value + s.backend.value + s.reachable.value + s.freeData.value;

const STATED_COST = /\b\d+(\.\d+)?\s*(hours?|hrs?|days?)\s*(a|per|each|every)\s*(day|week|month|year)\b|\$\s?\d[\d,]*(\.\d+)?\s*(k|m)?\b/i;
const PAIN_WORDS = /\b(manual(ly)?|tedious|painful|frustrat\w*|nightmare|waste\w*|time[- ]consuming|error[- ]prone|hate|struggl\w*|annoying)\b/i;
const MESSY_WORDS = /\b(spreadsheets?|excel|csv|reconcil\w*|duplicates?|dedup\w*|merg\w*|data entry|copy[- ]paste|export\w*|import\w*|mismatch\w*|inconsistent)\b/gi;
const BACKEND_WORDS = /\b(sync\w*|pipeline|ingest\w*|apis?|database|scrap\w*|match\w*|integrat\w*|automat\w*|etl|webhooks?|batch)\b/gi;
const ROLE_WORDS = /\b(accountants?|bookkeep\w*|small business(es)?|nonprofits?|clinics?|landlords?|contractors?|freelancers?|agenc(y|ies)|recruiters?|teachers?|lawyers?|law firms?|restaurants?|shops?|ops team|sales team|founders?)\b/i;
const PUBLIC_DATA_WORDS = /\b(public data|open data|government|federal|census|sec filings?|public records?)\b/i;

const distinctMatches = (text: string, re: RegExp): string[] =>
  [...new Set((text.match(re) ?? []).map((m) => m.toLowerCase()))];

const byCount = (hits: string[], label: string): Scored =>
  hits.length >= 2
    ? { value: 3, reason: `${label}: ${hits.slice(0, 4).join(", ")}` }
    : hits.length === 1
      ? { value: 2, reason: `${label}: ${hits[0]}` }
      : { value: 1, reason: `no ${label.toLowerCase()}` };

export function scoreText(text: string, numComments: number, phraseHits: number): Scores {
  const cost = text.match(STATED_COST);
  const painWord = text.match(PAIN_WORDS);
  const role = text.match(ROLE_WORDS);
  return {
    frequency:
      numComments >= 50 || phraseHits >= 3
        ? { value: 3, reason: `${numComments} comments, matched ${phraseHits} phrases` }
        : numComments >= 10 || phraseHits >= 2
          ? { value: 2, reason: `${numComments} comments, matched ${phraseHits} phrases` }
          : { value: 1, reason: `${numComments} comments, matched ${phraseHits} phrase` },
    pain: cost
      ? { value: 3, reason: `stated cost "${cost[0]}"` }
      : painWord
        ? { value: 2, reason: `pain word "${painWord[0]}"` }
        : { value: 1, reason: "no stated cost or pain word" },
    messy: byCount(distinctMatches(text, MESSY_WORDS), "Messy-data words"),
    backend: byCount(distinctMatches(text, BACKEND_WORDS), "Backend words"),
    reachable: role
      ? { value: 2, reason: `names a group: "${role[0]}" (guess; confirm by hand)` }
      : { value: 1, reason: "no identifiable group (guess)" },
    freeData: PUBLIC_DATA_WORDS.test(text)
      ? { value: 3, reason: "mentions public data" }
      : { value: 2, reason: "default: unknown, assume partly public" },
  };
}

/** Replace the judgment criteria with model scores; Frequency and Free data stay rule-based (ADR-002). */
export function applyJudgment(rules: Scores, j: Judgment): Scores {
  const model = { name: j.model, promptVersion: j.promptVersion };
  return {
    ...rules,
    pain: { value: j.pain, reason: j.painWhy, model },
    messy: { value: j.messy, reason: j.messyWhy, model },
    backend: { value: j.backend, reason: j.backendWhy, model },
    reachable: { value: j.reachable, reason: j.reachableWhy, model },
  };
}

// Vendor-name normalization for spotting variants ("ACME, INC." vs "Acme Inc").
const SUFFIXES = /\b(inc|incorporated|llc|l l c|ltd|limited|corp|corporation|co|company|lp|llp|plc|pc|the)\b/g;

export function normalizeOrgName(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(SUFFIXES, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Number of normalized names that appear under more than one raw spelling. */
export function countNameVariants(names: string[]): number {
  const spellings = new Map<string, Set<string>>();
  for (const n of names) {
    const key = normalizeOrgName(n);
    if (!key) continue;
    (spellings.get(key) ?? spellings.set(key, new Set()).get(key)!).add(n.trim());
  }
  return [...spellings.values()].filter((s) => s.size > 1).length;
}
