// API cost estimate, caps, and the spend log (ADR-003). Estimates are deliberately pessimistic:
// input from character count with a 20% margin, output at the max_tokens ceiling.
import { appendFile, readFile, writeFile } from "node:fs/promises";

/** USD per million tokens. Source: claude.com/pricing, fetched 2026-10-04. */
export const PRICES: Record<string, { input: number; output: number }> = {
  "claude-haiku-4-5-20251001": { input: 1, output: 5 },
  "claude-sonnet-5-5": { input: 2, output: 10 },
};

export const RUN_CAP_USD = 5;
export const TOTAL_CAP_USD = 20;
export const SPEND_LOG = "docs/API-SPEND.md";

const CHARS_PER_TOKEN = 3.5;
const MARGIN = 1.2;

export const estimateTokens = (chars: number): number => Math.ceil((chars / CHARS_PER_TOKEN) * MARGIN);

export function costUsd(model: string, inputTokens: number, outputTokens: number): number {
  const p = PRICES[model];
  if (!p) throw new Error(`no price for model ${model}`);
  return (inputTokens * p.input + outputTokens * p.output) / 1e6;
}

export interface Estimate {
  model: string;
  items: number;
  inputTokens: number;
  outputTokens: number;
  usd: number;
}

/** Estimate a run from the characters each uncached request will send. */
export function estimateRun(model: string, requestChars: number[], maxOutputTokens: number): Estimate {
  const inputTokens = requestChars.reduce((sum, c) => sum + estimateTokens(c), 0);
  const outputTokens = requestChars.length * maxOutputTokens;
  return { model, items: requestChars.length, inputTokens, outputTokens, usd: costUsd(model, inputTokens, outputTokens) };
}

/** Throws if the run estimate breaks the per-run cap or pushes logged spend past the total cap. */
export function checkCaps(estimateUsd: number, spentUsd: number): void {
  if (estimateUsd > RUN_CAP_USD) {
    throw new Error(`estimated $${estimateUsd.toFixed(2)} exceeds the $${RUN_CAP_USD} per-run cap; aborting`);
  }
  if (spentUsd + estimateUsd > TOTAL_CAP_USD) {
    throw new Error(
      `spent $${spentUsd.toFixed(2)} + estimated $${estimateUsd.toFixed(2)} exceeds the $${TOTAL_CAP_USD} total cap; aborting`,
    );
  }
}

const HEADER = [
  "# API spend",
  "",
  "One row per run that called a paid API. Counts only, never post text. Prices: claude.com/pricing (fetched 2026-10-04).",
  `Caps: $${RUN_CAP_USD} per run, $${TOTAL_CAP_USD} total. "Actual" is computed from the API's reported usage.`,
  "",
  "| Date | Model | Prompt version | Items | Input tokens | Output tokens | Estimated cost | Actual cost | Note |",
  "| --- | --- | --- | --- | --- | --- | --- | --- | --- |",
  "",
].join("\n");

/** Total logged spend: the Actual column (or Estimated when Actual is missing). */
export function parseSpent(markdown: string): number {
  let sum = 0;
  for (const line of markdown.split("\n")) {
    const cells = line.split("|").map((c) => c.trim());
    if (cells.length < 10 || !/^\d{4}-\d{2}-\d{2}$/.test(cells[1] ?? "")) continue;
    const money = (s: string | undefined) => (s && /^\$\d/.test(s) ? Number(s.slice(1)) : NaN);
    const actual = money(cells[8]);
    sum += Number.isFinite(actual) ? actual : money(cells[7]) || 0;
  }
  return sum;
}

/** Logged actual spend for one model + prompt version (all runs, including retries). */
export function spentFor(markdown: string, model: string, promptVersion: string): number {
  return parseSpent(
    markdown
      .split("\n")
      .filter((line) => {
        const cells = line.split("|").map((c) => c.trim());
        return cells[2] === model && cells[3] === promptVersion;
      })
      .join("\n"),
  );
}

export async function readSpent(path = SPEND_LOG): Promise<number> {
  try {
    return parseSpent(await readFile(path, "utf8"));
  } catch {
    return 0;
  }
}

export interface SpendRow {
  model: string;
  promptVersion: string;
  items: number;
  inputTokens: number;
  outputTokens: number;
  estimatedUsd: number;
  note: string;
}

export async function appendSpend(row: SpendRow, path = SPEND_LOG): Promise<void> {
  try {
    await readFile(path, "utf8");
  } catch {
    await writeFile(path, HEADER);
  }
  const actual = costUsd(row.model, row.inputTokens, row.outputTokens);
  const line = `| ${new Date().toISOString().slice(0, 10)} | ${row.model} | ${row.promptVersion} | ${row.items} | ${row.inputTokens} | ${row.outputTokens} | $${row.estimatedUsd.toFixed(4)} | $${actual.toFixed(4)} | ${row.note} |\n`;
  await appendFile(path, line);
}
