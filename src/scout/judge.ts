// Local-model judgment for the criteria rules can't handle (ADR-002).
// Talks to Ollama on localhost; nothing leaves the machine. Results are cached on disk
// by model + prompt version + text, so re-runs are free and prompt changes re-judge.
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Score } from "./score.js";

export const OLLAMA_URL = process.env.OF_OLLAMA_URL ?? "http://localhost:11434";
export const JUDGE_MODEL = process.env.OF_OLLAMA_MODEL ?? "qwen3:8b";
export const PROMPT_VERSION = "judge-v1";

const CACHE_DIR = "data/judge-cache";

const SYSTEM_PROMPT = `You review posts from a tech forum to find real, recurring customer problems that a small software product could solve.

For the post, decide:
- is_problem: true only if someone describes a concrete problem they or their users have. False for product launches, self-promotion, general discussion, opinion pieces, or career questions.
- problem: the underlying problem in one plain line (max 15 words). Name who has it.
- pain: 1 = annoyance, no cost mentioned; 2 = time or money cost implied; 3 = hours or dollars stated explicitly.
- messy: 1 = one clean data source; 2 = some inconsistent or missing data; 3 = data spread across several systems with no shared key.
- backend: 1 = mostly a UI or simple forms; 2 = some data ingestion or matching; 3 = real ingestion, matching, and storage.
- reachable: 1 = unclear who has this; 2 = a known community or job role; 3 = a specific group you could find and message five of this week.
- Each *_why: max 12 words, quoting the post where possible.

Judge only from the post. Do not invent facts.`;

const SCHEMA = {
  type: "object",
  properties: {
    is_problem: { type: "boolean" },
    problem: { type: "string" },
    pain: { type: "integer", enum: [1, 2, 3] },
    pain_why: { type: "string" },
    messy: { type: "integer", enum: [1, 2, 3] },
    messy_why: { type: "string" },
    backend: { type: "integer", enum: [1, 2, 3] },
    backend_why: { type: "string" },
    reachable: { type: "integer", enum: [1, 2, 3] },
    reachable_why: { type: "string" },
  },
  required: [
    "is_problem", "problem", "pain", "pain_why", "messy", "messy_why",
    "backend", "backend_why", "reachable", "reachable_why",
  ],
} as const;

export interface Judgment {
  isProblem: boolean;
  problem: string;
  pain: Score;
  painWhy: string;
  messy: Score;
  messyWhy: string;
  backend: Score;
  backendWhy: string;
  reachable: Score;
  reachableWhy: string;
  model: string;
  promptVersion: string;
}

const asScore = (v: unknown): Score | null => (v === 1 || v === 2 || v === 3 ? v : null);
const asText = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);

/** Validate raw model JSON. Returns null if anything is missing or out of range. */
export function parseJudgment(raw: unknown, model: string): Judgment | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const pain = asScore(r.pain), messy = asScore(r.messy), backend = asScore(r.backend), reachable = asScore(r.reachable);
  if (typeof r.is_problem !== "boolean" || !pain || !messy || !backend || !reachable) return null;
  // A summary is only required when the post is a problem; non-problems are dropped anyway.
  const problem = asText(r.problem);
  if (r.is_problem && !problem) return null;
  return {
    isProblem: r.is_problem,
    problem: problem ?? "",
    pain,
    painWhy: asText(r.pain_why) ?? "",
    messy,
    messyWhy: asText(r.messy_why) ?? "",
    backend,
    backendWhy: asText(r.backend_why) ?? "",
    reachable,
    reachableWhy: asText(r.reachable_why) ?? "",
    model,
    promptVersion: PROMPT_VERSION,
  };
}

export const judgeStats = { judged: 0, cacheHits: 0, failures: 0, skipped: 0, seconds: 0 };

export async function ollamaAvailable(): Promise<boolean> {
  try {
    const res = await fetch(`${OLLAMA_URL}/api/tags`);
    if (!res.ok) return false;
    const { models } = (await res.json()) as { models: { name: string }[] };
    return models.some((m) => m.name === JUDGE_MODEL);
  } catch {
    return false;
  }
}

/**
 * Judge one post. Returns null on any failure so callers fall back to rule scores.
 * With cacheOnly (Ollama not running), returns a cached judgment or null without calling the model.
 */
export async function judge(title: string, body: string, opts: { cacheOnly?: boolean } = {}): Promise<Judgment | null> {
  const input = `Title: ${title}\n\nPost: ${body.slice(0, 3000)}`;
  const key = createHash("sha256").update(`${JUDGE_MODEL}\n${PROMPT_VERSION}\n${input}`).digest("hex");
  const cachePath = join(CACHE_DIR, `${key}.json`);

  try {
    const cached = parseJudgment(JSON.parse(await readFile(cachePath, "utf8")), JUDGE_MODEL);
    if (cached) {
      judgeStats.cacheHits++;
      return cached;
    }
  } catch {
    // cache miss
  }
  if (opts.cacheOnly) {
    judgeStats.skipped++;
    return null;
  }

  const t0 = Date.now();
  try {
    const res = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: JUDGE_MODEL,
        stream: false,
        think: false,
        format: SCHEMA,
        options: { temperature: 0 },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: input },
        ],
      }),
    });
    if (!res.ok) throw new Error(`ollama ${res.status}`);
    const data = (await res.json()) as { message: { content: string } };
    const raw: unknown = JSON.parse(data.message.content);
    const judgment = parseJudgment(raw, JUDGE_MODEL);
    if (!judgment) throw new Error(`invalid judgment shape: ${data.message.content.slice(0, 300)}`);
    await mkdir(CACHE_DIR, { recursive: true });
    await writeFile(cachePath, JSON.stringify(raw));
    judgeStats.judged++;
    return judgment;
  } catch (err) {
    judgeStats.failures++;
    console.error(`judge failed for "${title.slice(0, 60)}": ${(err as Error).message}`);
    return null;
  } finally {
    judgeStats.seconds += (Date.now() - t0) / 1000;
  }
}
