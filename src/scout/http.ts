// Polite JSON fetcher: identifies itself, throttles per source, backs off on 429/5xx,
// and caches raw responses on disk so re-runs within the cache window never re-fetch.
import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { USER_AGENT } from "../config.js";

const CACHE_DIR = "data/raw-cache";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const MIN_INTERVAL_MS = 1000; // self-imposed: 1 request/second per source
const MAX_RETRIES = 4;

const lastRequestAt = new Map<string, number>();

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function throttle(source: string): Promise<void> {
  const wait = (lastRequestAt.get(source) ?? 0) + MIN_INTERVAL_MS - Date.now();
  if (wait > 0) await sleep(wait);
  lastRequestAt.set(source, Date.now());
}

export interface FetchStats {
  requests: number;
  cacheHits: number;
  errors: number;
}

export const stats: Record<string, FetchStats> = {};

export async function fetchJson<T>(source: string, url: string, body?: unknown): Promise<T> {
  const s = (stats[source] ??= { requests: 0, cacheHits: 0, errors: 0 });
  const key = createHash("sha256").update(`${url}\n${JSON.stringify(body ?? null)}`).digest("hex");
  const cachePath = join(CACHE_DIR, source, `${key}.json`);

  try {
    const info = await stat(cachePath);
    if (Date.now() - info.mtimeMs < CACHE_TTL_MS) {
      s.cacheHits++;
      return JSON.parse(await readFile(cachePath, "utf8")) as T;
    }
  } catch {
    // cache miss
  }

  for (let attempt = 0; ; attempt++) {
    await throttle(source);
    s.requests++;
    const res = await fetch(url, {
      method: body === undefined ? "GET" : "POST",
      headers: { "User-Agent": USER_AGENT, "Content-Type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    if (res.ok) {
      const text = await res.text();
      await mkdir(join(CACHE_DIR, source), { recursive: true });
      await writeFile(cachePath, text);
      return JSON.parse(text) as T;
    }
    s.errors++;
    const retryable = res.status === 429 || res.status >= 500;
    if (!retryable || attempt >= MAX_RETRIES) {
      throw new Error(`${source} ${res.status} ${res.statusText} for ${url}`);
    }
    await sleep(2 ** attempt * 1000);
  }
}
