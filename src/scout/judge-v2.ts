// Judge v2 (ADR-003): gates + six-criterion scoring with verbatim-quote evidence.
// One zod schema drives Ollama's `format`, Anthropic structured outputs, and validation.
// Judgments are cached by model + prompt version + input text, as in v1.
// Only post title and body are sent to the API; logs carry counts and item ids, never post text.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { checkQuote, stripTrailingArtifacts } from "./evidence.js";
import { JUDGE_MODEL, OLLAMA_URL } from "./judge.js";
import type { Score, Scored, Scores } from "./score.js";

// judge-v2.1 (2026-10-04, Peter approved): G3 fails only on a named product that solves this
// author's problem, not a category. judge-v2.2 (thinking on, medium effort) was tried and reverted
// the same day: junk stayed (42/75) and precision fell. judge-v2.md is kept for the record.
export const PROMPT_V2_VERSION = "judge-v2.1";
export const PROMPT_V2 = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "prompts", `${PROMPT_V2_VERSION}.md`), "utf8");

const CACHE_DIR = "data/judge-cache";
/** Output ceiling per request; also the worst case the cost estimate assumes. */
// 1500 → 3000 → back to 1500 (2026-10-04, Peter approved). The 3000 ceiling was for Sonnet's digit
// loop, which the enum schema fixed. Real answers average ~700 tokens, and the estimate assumes this
// ceiling, so 3000 pushed a full-list run past the $5 cap. A truncated answer is a recorded failure.
export const MAX_OUTPUT_TOKENS = 1500;
const BODY_CHARS = 3000;

export type JudgeName = "local" | "haiku" | "sonnet";
export interface JudgeSpec {
  name: JudgeName;
  backend: "ollama" | "anthropic";
  model: string;
}
export const JUDGES: Record<JudgeName, JudgeSpec> = {
  local: { name: "local", backend: "ollama", model: JUDGE_MODEL },
  haiku: { name: "haiku", backend: "anthropic", model: "claude-haiku-4-5-20251001" },
  sonnet: { name: "sonnet", backend: "anthropic", model: "claude-sonnet-5-5" },
};
export const isJudgeName = (s: string): s is JudgeName => s in JUDGES;

const Gate = z.object({ pass: z.boolean(), quote: z.string() });
const Criterion = z.object({ score: z.int().min(1).max(3), quote: z.string(), why: z.string() });
export const JudgmentV2Schema = z.object({
  g1_current_problem: Gate,
  g2_need: Gate,
  g3_not_trivial: Gate.extend({ tool: z.string() }),
  g4_author_has_problem: Gate,
  problem: z.string(),
  pain: Criterion,
  messy: Criterion,
  backend: Criterion,
  reachable: Criterion,
  buyer: Criterion,
});
export type RawJudgmentV2 = z.infer<typeof JudgmentV2Schema>;

type JsonSchema = { [key: string]: unknown };

/**
 * JSON schema sent to the models. Built from the zod schema, but the 1–3 scores become
 * `enum: [1, 2, 3]`: the API ignores minimum/maximum, and the SDK's zod helper (0.131.0) also
 * moves `enum` into a description. Without a hard enum, Sonnet sometimes looped on digits
 * ("0.00.00…") until max_tokens. Every object gets additionalProperties: false, as the API requires.
 */
export function judgeJsonSchema(): JsonSchema {
  const fix = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(fix);
    if (typeof node !== "object" || node === null) return node;
    const n = node as JsonSchema;
    if (n.type === "integer" && n.minimum === 1 && n.maximum === 3) return { type: "integer", enum: [1, 2, 3] };
    const out: JsonSchema = {};
    for (const [k, v] of Object.entries(n)) if (k !== "$schema") out[k] = fix(v);
    if (out.type === "object") out.additionalProperties = false;
    return out;
  };
  return fix(z.toJSONSchema(JudgmentV2Schema)) as JsonSchema;
}
const JUDGE_JSON_SCHEMA = judgeJsonSchema();

export const GATES = ["g1_current_problem", "g2_need", "g3_not_trivial", "g4_author_has_problem"] as const;
export const MODEL_CRITERIA = ["pain", "messy", "backend", "reachable", "buyer"] as const;
export type GateKey = (typeof GATES)[number];
export type ModelCriterion = (typeof MODEL_CRITERIA)[number];

/** Exactly what is sent to the model, and what quotes are checked against. */
export const judgeInput = (title: string, body: string): string => `Title: ${title}\n\nPost: ${body.slice(0, BODY_CHARS)}`;
/** Characters per request (system prompt + input), for the cost estimate. */
export const requestChars = (title: string, body: string): number => PROMPT_V2.length + judgeInput(title, body).length;

export const judgeV2Stats = { judged: 0, cacheHits: 0, failures: 0, skipped: 0, seconds: 0, inputTokens: 0, outputTokens: 0 };

const cachePathFor = (model: string, input: string): string =>
  join(CACHE_DIR, `${createHash("sha256").update(`${model}\n${PROMPT_V2_VERSION}\n${input}`).digest("hex")}.json`);

export async function isCachedV2(judge: JudgeSpec, title: string, body: string): Promise<boolean> {
  try {
    await readFile(cachePathFor(judge.model, judgeInput(title, body)), "utf8");
    return true;
  } catch {
    return false;
  }
}

let client: Anthropic | undefined;
function anthropic(): Anthropic {
  // The SDK reads ANTHROPIC_API_KEY itself; we only check it is present and never print it.
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not set (see .env.example)");
  return (client ??= new Anthropic());
}

async function callOllama(model: string, input: string): Promise<unknown> {
  const res = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      stream: false,
      think: false,
      format: JUDGE_JSON_SCHEMA,
      options: { temperature: 0 },
      messages: [
        { role: "system", content: PROMPT_V2 },
        { role: "user", content: input },
      ],
    }),
  });
  if (!res.ok) throw new Error(`ollama ${res.status}`);
  const data = (await res.json()) as { message: { content: string } };
  return JSON.parse(data.message.content);
}

async function callAnthropic(spec: JudgeSpec, input: string): Promise<unknown> {
  // Sonnet 5.5 rejects non-default temperature and can't disable thinking; "between_tools" turns it off
  // for a single-turn call. Sonnet appends junk ("</br>", "}") to some strings under any setting tried;
  // evaluateV2 strips trailing junk. Haiku 4.5 takes temperature 0 and showed no junk.
  const format = { type: "json_schema" as const, schema: JUDGE_JSON_SCHEMA };
  const sampling =
    spec.name === "sonnet"
      ? { thinking: { type: "between_tools" as const }, output_config: { effort: "low" as const, format } }
      : { temperature: 0, output_config: { format } };
  const res = await anthropic().messages.create({
    model: spec.model,
    max_tokens: MAX_OUTPUT_TOKENS,
    system: PROMPT_V2,
    messages: [{ role: "user", content: input }],
    ...sampling,
  });
  judgeV2Stats.inputTokens += res.usage.input_tokens;
  judgeV2Stats.outputTokens += res.usage.output_tokens;
  // Check why generation stopped before parsing, so truncation and refusals are named in the log.
  if (res.stop_reason !== "end_turn") throw new Error(`stop_reason ${res.stop_reason} after ${res.usage.output_tokens} output tokens`);
  const text = res.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
  try {
    return JSON.parse(text);
  } catch {
    // Fixed message: JSON.parse errors can echo model output, which quotes the post.
    throw new Error(`output is not valid JSON (${text.length} chars, ${res.usage.output_tokens} output tokens)`);
  }
}

/** Error text safe to log: API errors are reduced to class and status so nothing from the request leaks. */
function safeError(err: unknown): string {
  if (err instanceof Anthropic.APIError) return `${err.constructor.name} ${err.status ?? ""}`.trim();
  if (err instanceof Anthropic.AnthropicError) return err.constructor.name;
  return err instanceof Error ? err.message.slice(0, 120) : "unknown error";
}

/**
 * Judge one post with judge-v2. Returns the schema-valid raw judgment, or null on any failure
 * (callers fall back to rule scores). With cacheOnly, never calls a model.
 */
export async function judgeV2(
  spec: JudgeSpec,
  item: { id: string; title: string; body: string },
  opts: { cacheOnly?: boolean } = {},
): Promise<RawJudgmentV2 | null> {
  const input = judgeInput(item.title, item.body);
  const cachePath = cachePathFor(spec.model, input);
  try {
    const cached = JudgmentV2Schema.safeParse(JSON.parse(await readFile(cachePath, "utf8")));
    if (cached.success) {
      judgeV2Stats.cacheHits++;
      return cached.data;
    }
  } catch {
    // cache miss
  }
  if (opts.cacheOnly) {
    judgeV2Stats.skipped++;
    return null;
  }

  const t0 = Date.now();
  try {
    const raw = spec.backend === "ollama" ? await callOllama(spec.model, input) : await callAnthropic(spec, input);
    const parsed = JudgmentV2Schema.safeParse(raw);
    if (!parsed.success) throw new Error(`schema validation failed (${parsed.error.issues.length} issues)`);
    await mkdir(CACHE_DIR, { recursive: true });
    await writeFile(cachePath, JSON.stringify(parsed.data));
    judgeV2Stats.judged++;
    return parsed.data;
  } catch (err) {
    judgeV2Stats.failures++;
    console.error(`judge ${spec.name} failed for item ${item.id}: ${safeError(err)}`);
    return null;
  } finally {
    judgeV2Stats.seconds += (Date.now() - t0) / 1000;
  }
}

// --- Evidence + gates -------------------------------------------------------

export type GateStatus = "pass" | "fail" | "unsupported";
export interface GateResult {
  status: GateStatus;
  quote: string;
  /** Tool that already solves it (G3 fail), or why the gate is unsupported. */
  note: string;
}
export type ItemStatus = "passed" | "gated_out" | "needs_review";

export interface EvaluatedV2 {
  status: ItemStatus;
  problem: string;
  gates: Record<GateKey, GateResult>;
  criteria: Record<ModelCriterion, Scored>;
  quotesValid: number;
  quotesTotal: number;
  /** Strings (quotes, reasons, problem) that had trailing markup stripped. */
  artifacts: number;
  /** The model's own "why" texts, for the rubric-echo rate. */
  reasons: string[];
}

/** Apply the evidence rule and gate logic to a schema-valid judgment. */
export function evaluateV2(raw: RawJudgmentV2, title: string, body: string, model: string): EvaluatedV2 {
  const source = judgeInput(title, body);
  let quotesValid = 0;
  let artifacts = 0;
  const clean = (text: string) => {
    const r = stripTrailingArtifacts(text, source);
    if (r.stripped) artifacts++;
    return r.text;
  };
  const check = (quote: string) => {
    const r = checkQuote(quote, source);
    if (r.valid) quotesValid++;
    return r;
  };

  const gates = {} as Record<GateKey, GateResult>;
  for (const key of GATES) {
    const g = { ...raw[key], quote: clean(raw[key].quote) };
    const q = check(g.quote);
    const named = key === "g3_not_trivial" ? raw.g3_not_trivial.tool.trim() : "";
    // "none", "n/a", "none named" etc. are not a tool name; G3 must name one to fail (ADR-003).
    const tool = /^(none|n\/?a|unknown|not applicable)\b/i.test(named) ? "" : named;
    if (!q.valid) gates[key] = { status: "unsupported", quote: g.quote, note: `quote ${q.why}` };
    else if (key === "g3_not_trivial" && !g.pass && !tool) gates[key] = { status: "unsupported", quote: g.quote, note: "fail without naming a tool" };
    else gates[key] = { status: g.pass ? "pass" : "fail", quote: g.quote, note: g.pass ? "" : tool };
  }

  const tag = { name: model, promptVersion: PROMPT_V2_VERSION };
  const criteria = {} as Record<ModelCriterion, Scored>;
  const whys: string[] = [];
  for (const key of MODEL_CRITERIA) {
    const c = { ...raw[key], quote: clean(raw[key].quote), why: clean(raw[key].why) };
    whys.push(c.why);
    const q = check(c.quote);
    criteria[key] = {
      value: c.score as Score,
      reason: q.valid ? `${c.why} — "${c.quote}"` : `unsupported (quote ${q.why}): ${c.why}`,
      model: tag,
      quote: c.quote,
      ...(q.valid ? {} : { unsupported: true as const }),
    };
  }

  const gateList = Object.values(gates);
  const status: ItemStatus = gateList.some((g) => g.status === "fail")
    ? "gated_out"
    : gateList.some((g) => g.status === "unsupported") || Object.values(criteria).some((c) => c.unsupported)
      ? "needs_review"
      : "passed";

  return {
    status,
    problem: clean(raw.problem).trim() || title,
    gates,
    criteria,
    quotesValid,
    quotesTotal: GATES.length + MODEL_CRITERIA.length,
    artifacts,
    reasons: whys,
  };
}

/** Swap in v2 model scores. Frequency stays as a display-only popularity value (not in the HN total). */
export function applyJudgmentV2(rules: Scores, ev: EvaluatedV2, comments: number): Scores {
  return {
    ...rules,
    frequency: { ...rules.frequency, reason: `popularity only, not in total: ${comments} comments` },
    pain: ev.criteria.pain,
    messy: ev.criteria.messy,
    backend: ev.criteria.backend,
    reachable: ev.criteria.reachable,
    buyer: ev.criteria.buyer,
  };
}
