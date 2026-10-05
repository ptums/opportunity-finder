// City contracts scout (ADR-006): recent service, consulting and software contracts from keyless
// city open-data portals (Socrata SODA). Only purpose/description fields are selected; contact,
// vendor-address and person fields are never requested, so no personal names are fetched.
import { fetchJson } from "./http.js";
import { scoreText, type Scores } from "./score.js";

/** Most recent qualifying contracts judged per city per run (cost cap, ADR-006). */
export const PER_CITY = 60;
export const MIN_WORDS = 6;
const LOOKBACK_DAYS = 365;
const FETCH_ROWS = 500;

export interface CityContract {
  city: string;
  department: string;
  category: string;
  description: string;
  amount: number | null;
  date: string;
  url: string;
  /** Stable id for de-duplication (contract number or notice id). */
  key: string;
}

export interface CityContractCandidate {
  source: "City contracts";
  id: string;
  city: string;
  url: string;
  title: string;
  body: string;
  snippet: string;
  publishedAt: string;
  comments: number;
  phrases: string[];
  scores: Scores;
}

const soql = (base: string, params: Record<string, string>) => `${base}?${new URLSearchParams(params)}`;
const since = (now: number) => new Date(now - LOOKBACK_DAYS * 86_400_000).toISOString().slice(0, 19);
const num = (v: unknown) => (v === undefined || v === null || v === "" ? null : Number(v));

/** Strip HTML tags and entities from NYC's notice text. */
export const htmlText = (s: string) =>
  s.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&[a-z]+;/g, " ").replace(/\s+/g, " ").trim();

// --- Chicago: data.cityofchicago.org "Contracts" (rsxa-ify5) -----------------------------------
/** Service-type contracts only: skips construction, commodities, vehicles, leases and delegate-agency grants. */
export const CHICAGO_TYPES = "(contract_type like 'PRO SERV%' OR contract_type = 'SOFTWARE' OR contract_type like 'WORK SERV%')";

interface ChicagoRow {
  purchase_order_description?: string;
  purchase_order_contract_number?: string;
  revision_number?: string;
  contract_type?: string;
  approval_date?: string;
  department?: string;
  award_amount?: string;
  contract_pdf?: { url?: string } | string;
}

export function parseChicago(rows: ChicagoRow[]): CityContract[] {
  return rows.map((r) => ({
    city: "Chicago",
    department: (r.department ?? "").trim(),
    category: (r.contract_type ?? "").trim(),
    description: (r.purchase_order_description ?? "").trim(),
    amount: num(r.award_amount),
    date: (r.approval_date ?? "").slice(0, 10),
    url:
      (typeof r.contract_pdf === "string" ? r.contract_pdf : r.contract_pdf?.url) ??
      "https://data.cityofchicago.org/d/rsxa-ify5",
    key: `chicago:${r.purchase_order_contract_number ?? r.purchase_order_description}`,
  }));
}

async function fetchChicago(now: number): Promise<CityContract[]> {
  const url = soql("https://data.cityofchicago.org/resource/rsxa-ify5.json", {
    $select: "purchase_order_description,purchase_order_contract_number,revision_number,contract_type,approval_date,department,award_amount,contract_pdf",
    $where: `approval_date > '${since(now)}' AND ${CHICAGO_TYPES}`,
    $order: "approval_date DESC",
    $limit: String(FETCH_ROWS),
  });
  return parseChicago(await fetchJson<ChicagoRow[]>("chicago", url));
}

// --- NYC: data.cityofnewyork.us "Recent Contract Awards" (qyyg-4tf5) ----------------------------
/** Skips goods, construction and human-services (client services run by providers) categories. */
export const NYC_CATEGORIES = "category_description in('Services (other than human services)','Goods and Services')";

interface NycRow {
  request_id?: string;
  start_date?: string;
  agency_name?: string;
  category_description?: string;
  short_title?: string;
  selection_method_description?: string;
  contract_amount?: string;
  additional_description_1?: string;
}

export function parseNyc(rows: NycRow[]): CityContract[] {
  return rows.map((r) => {
    const title = (r.short_title ?? "").trim();
    const extra = htmlText(r.additional_description_1 ?? "");
    return {
      city: "New York City",
      department: (r.agency_name ?? "").trim(),
      category: [r.category_description, r.selection_method_description].filter(Boolean).join(", "),
      description: extra && !extra.toLowerCase().includes(title.toLowerCase()) ? `${title}. ${extra}` : extra || title,
      amount: num(r.contract_amount),
      date: (r.start_date ?? "").slice(0, 10),
      url: `https://a856-cityrecord.nyc.gov/RequestDetail/${r.request_id ?? ""}`,
      key: `nyc:${r.request_id ?? title}`,
    };
  });
}

async function fetchNyc(now: number): Promise<CityContract[]> {
  const url = soql("https://data.cityofnewyork.us/resource/qyyg-4tf5.json", {
    // Contact name, phone, email and vendor fields exist in this dataset; they are never selected.
    $select: "request_id,start_date,agency_name,category_description,short_title,selection_method_description,contract_amount,additional_description_1",
    $where: `start_date > '${since(now)}' AND ${NYC_CATEGORIES}`,
    $order: "start_date DESC",
    $limit: String(FETCH_ROWS),
  });
  return parseNyc(await fetchJson<NycRow[]>("nyc", url));
}

// --- Shared -----------------------------------------------------------------------------------
const words = (s: string) => s.split(/\s+/).filter(Boolean).length;
/** Police, courts and corrections are out of scope (CJIS; docs/TARGETS.md). */
export const OUT_OF_SCOPE_DEPT = /police|nypd|court|correction|probation|district attorney|sheriff|public safety|emergency communications|911/i;

/** One row per contract (revisions and renewals collapse), real descriptions only, newest first, capped. */
export function preFilter(rows: CityContract[]): CityContract[] {
  const seen = new Set<string>();
  const out: CityContract[] = [];
  // Same city + same description (e.g. two fleet-maintenance contracts) counts once.
  const sameText = (r: CityContract) => `${r.city}:${r.description.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()}`;
  for (const r of [...rows].sort((a, b) => b.date.localeCompare(a.date))) {
    if (seen.has(r.key) || seen.has(sameText(r)) || words(r.description) < MIN_WORDS || OUT_OF_SCOPE_DEPT.test(r.department)) continue;
    seen.add(r.key);
    seen.add(sameText(r));
    out.push(r);
    if (out.length >= PER_CITY) break;
  }
  return out;
}

const usd = (n: number | null) => (n === null ? "not stated" : `$${Math.round(n).toLocaleString("en-US")}`);

export function toCandidate(c: CityContract): CityContractCandidate {
  const title = `[${c.city} · ${c.department}] ${c.description.split(/\s+/).slice(0, 12).join(" ")}`;
  const body = `${c.description}\n\nCategory: ${c.category}. Amount: ${usd(c.amount)}. Date: ${c.date}.`;
  const scores = scoreText(`${c.description}`, 0, 0);
  return {
    source: "City contracts",
    id: c.key,
    city: c.city,
    url: c.url,
    title,
    body,
    snippet: c.description.slice(0, 280),
    publishedAt: c.date,
    comments: 0,
    phrases: [c.city, c.category],
    scores: { ...scores, freeData: { value: 3, reason: "public city contract data" } },
  };
}

export const cityContractStats: Record<string, { fetched: number; kept: number }> = {};

export async function scoutCityContracts(now = Date.now()): Promise<CityContractCandidate[]> {
  const out: CityContractCandidate[] = [];
  for (const [city, fetcher] of [["Chicago", fetchChicago], ["New York City", fetchNyc]] as const) {
    try {
      const rows = await fetcher(now);
      const kept = preFilter(rows);
      cityContractStats[city] = { fetched: rows.length, kept: kept.length };
      out.push(...kept.map(toCandidate));
    } catch (err) {
      // One failing city never blocks the others (REQUIREMENTS §8).
      console.error(`city contracts: ${city} failed: ${(err as Error).message.slice(0, 120)}`);
    }
  }
  return out;
}
