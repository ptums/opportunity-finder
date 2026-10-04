// Score the frozen evaluation set with one judge and record the results (ADR-003).
//   npm run eval -- --dry-run                          # items, est. tokens, est. cost per judge; no calls
//   npm run eval -- --judge local --prompt judge-v1    # baseline: qwen3:8b judge-v1, from cache
//   npm run eval -- --judge local                      # qwen3:8b judge-v2 (Ollama)
//   npm run eval -- --judge haiku --limit 3 --raw --confirm-spend   # smoke test, prints raw JSON
//   npm run eval -- --judge sonnet --confirm-spend     # full set on Sonnet
// Paid judges never call the API without --confirm-spend, and always check the cost caps first.
// Full-set runs (no --limit) write data/eval-results/<judge>-<prompt>.json and regenerate the
// "Scorer v2 experiment" section of docs/OUTCOMES.md from every saved result.
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { appendSpend, checkCaps, estimateRun, readSpent, SPEND_LOG, spentFor } from "./cost.js";
import { rubricEchoChecker } from "./evidence.js";
import { type EvalItem, readFixture, readLabels, REASON_CODES, withLabels } from "./eval-set.js";
import { type ItemOutcome, type JudgeReport, pct, report } from "./eval-metrics.js";
import { judge, ollamaAvailable, SYSTEM_PROMPT } from "./judge.js";
import {
  evaluateV2, isCachedV2, isJudgeName, JUDGES, type JudgeSpec, judgeV2, judgeV2Stats,
  MAX_OUTPUT_TOKENS, PROMPT_V2, PROMPT_V2_VERSION, requestChars,
} from "./judge-v2.js";
import { applyJudgment, scoreText, total } from "./score.js";

const RESULTS_DIR = "data/eval-results";
const OUTCOMES = "docs/OUTCOMES.md";
const START = "<!-- scorer-v2:start -->";
const END = "<!-- scorer-v2:end -->";

interface SavedResult {
  judge: string;
  model: string;
  prompt: string;
  runAt: string;
  report: JudgeReport;
  costPer1000: string;
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const flag = (name: string) => process.argv.includes(name);

const rulesFor = (it: EvalItem) => scoreText(`${it.title} ${it.body}`, it.comments, it.phrases.length);

async function uncached(spec: JudgeSpec, items: EvalItem[]): Promise<EvalItem[]> {
  const out: EvalItem[] = [];
  for (const it of items) if (!(await isCachedV2(spec, it.title, it.body))) out.push(it);
  return out;
}

async function dryRun(items: EvalItem[]) {
  const spent = await readSpent();
  console.log(`Frozen set: ${items.length} items (${items.filter((i) => i.label).length} labeled). Logged API spend so far: $${spent.toFixed(4)}.`);
  console.log(`Estimate: input = chars ÷ 3.5 × 1.2; output = ${MAX_OUTPUT_TOKENS} tokens per item (ceiling).`);
  for (const spec of Object.values(JUDGES)) {
    const todo = await uncached(spec, items);
    if (spec.backend === "ollama") {
      console.log(`${spec.name.padEnd(6)} ${spec.model} ${PROMPT_V2_VERSION}: ${todo.length} uncached items, $0 (local; ~8–12 s/item ≈ ${Math.round((todo.length * 10) / 60)} min)`);
      continue;
    }
    const est = estimateRun(spec.model, todo.map((i) => requestChars(i.title, i.body)), MAX_OUTPUT_TOKENS);
    console.log(
      `${spec.name.padEnd(6)} ${spec.model} ${PROMPT_V2_VERSION}: ${est.items} uncached items, ~${est.inputTokens} input + ≤${est.outputTokens} output tokens, est. ≤ $${est.usd.toFixed(4)}`,
    );
  }
}

async function runV1(items: EvalItem[]): Promise<ItemOutcome[]> {
  const out: ItemOutcome[] = [];
  for (const it of items) {
    const j = await judge(it.title, it.body, { cacheOnly: true });
    out.push({
      id: it.id, label: it.label, reason: it.reason,
      shortlisted: j ? j.isProblem && total(applyJudgment(rulesFor(it), j)) >= 15 : null,
      quotesValid: 0, quotesTotal: 0,
      reasons: j ? [j.painWhy, j.messyWhy, j.backendWhy, j.reachableWhy] : [],
    });
  }
  return out;
}

async function runV2(spec: JudgeSpec, items: EvalItem[], cacheOnly: boolean, raw: boolean): Promise<ItemOutcome[]> {
  const out: ItemOutcome[] = [];
  for (const [n, it] of items.entries()) {
    process.stderr.write(`\r${spec.name}: ${n + 1}/${items.length}`);
    const j = await judgeV2(spec, it, { cacheOnly });
    if (raw && j) console.log(`\n${JSON.stringify({ id: it.id, judgment: j }, null, 2)}`);
    if (!j) {
      out.push({ id: it.id, label: it.label, reason: it.reason, shortlisted: null, quotesValid: 0, quotesTotal: 0, reasons: [] });
      continue;
    }
    const ev = evaluateV2(j, it.title, it.body, spec.model);
    out.push({
      id: it.id, label: it.label, reason: it.reason,
      // v2 shortlist = all gates pass with valid quotes and every score supported; rank by total (Peter, 2026-10-04).
      shortlisted: ev.status === "passed",
      quotesValid: ev.quotesValid, quotesTotal: ev.quotesTotal, artifacts: ev.artifacts, reasons: ev.reasons,
    });
  }
  process.stderr.write("\n");
  return out;
}

async function loadResults(): Promise<SavedResult[]> {
  try {
    const files = (await readdir(RESULTS_DIR)).filter((f) => f.endsWith(".json")).sort();
    return Promise.all(files.map(async (f) => JSON.parse(await readFile(join(RESULTS_DIR, f), "utf8")) as SavedResult));
  } catch {
    return [];
  }
}

function renderSection(results: SavedResult[], setSize: number, labeled: number): string {
  const rows = results.map((r) => {
    const x = r.report;
    return `| ${r.judge} (${r.model}) | ${r.prompt} | ${x.judged}/${x.items} | ${x.shortlisted} | ${pct(x.agreement)} | ${pct(x.precision)} | ${pct(x.recall)} | ${pct(x.evidenceValidity)} | ${pct(x.rubricEcho)} | ${pct(x.junkItems ?? null)} | ${r.costPer1000} | ${x.knownFpShortlisted.join(", ") || "none"} | ${r.runAt.slice(0, 10)} |`;
  });
  const fpRows = results.map(
    (r) => `| ${r.judge} ${r.prompt} | ${[...REASON_CODES, "uncoded"].map((c) => `${pct(r.report.fpRateByReason[c]?.rate ?? null)} (n=${r.report.fpRateByReason[c]?.n ?? 0})`).join(" | ")} |`,
  );
  return [
    START,
    `Frozen set: \`test/fixtures/eval-set.json\` (posts only), ${setSize} HN posts, ${labeled} labeled by Peter (labels kept locally in the gitignored \`docs/eval-labels.xlsx\`). Generated by \`npm run eval\`; do not edit by hand.`,
    "",
    "Shortlisted (judge-v2.1 and later) = all gates pass with valid quotes and every model score supported, ranked by total, no cutoff. judge-v2 rows used the old rule (also total ≥ 15). v1 = is_problem and hybrid total ≥ 15. Agreement = shortlisted matches label (yes/maybe vs no). Precision = share of shortlisted items labeled yes/maybe. Recall = share of yes/maybe items shortlisted. Evidence validity = quotes that pass the substring check ÷ quotes requested (v1 has no quotes). Rubric echo = reasons sharing a 5-word run with the judge prompt. Junk stripped = items where trailing markup (such as \`</br>\` or \`}\`) was removed from at least one string before the quote check (only measured on runs after 2026-10-04; older rows show n/a).",
    "",
    "| Judge | Prompt | Judged | Shortlisted | Agreement | Precision | Recall | Evidence valid | Rubric echo | Junk stripped | Cost / 1,000 items | Known FPs still shortlisted | Run |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
    ...rows,
    "",
    "False-positive rate by reason code (share of items Peter labeled \"no\" with that code that the judge shortlisted):",
    "",
    `| Judge | ${[...REASON_CODES, "uncoded"].join(" | ")} |`,
    `| --- | ${[...REASON_CODES, "uncoded"].map(() => "---").join(" | ")} |`,
    ...fpRows,
    END,
  ].join("\n");
}

async function writeOutcomes(setSize: number, labeled: number) {
  const section = renderSection(await loadResults(), setSize, labeled);
  const md = await readFile(OUTCOMES, "utf8");
  const next = md.includes(START)
    ? md.replace(new RegExp(`${START}[\\s\\S]*?${END}`), section)
    : `${md.trimEnd()}\n\n## Scorer v2 experiment\n\n${section}\n`;
  await writeFile(OUTCOMES, next);
}

async function main() {
  const fixture = withLabels(await readFixture(), (await readLabels()).labels);
  const limit = arg("--limit") ? Number(arg("--limit")) : undefined;
  const items = fixture.items.slice(0, limit);
  if (flag("--dry-run")) return dryRun(items);

  const judgeName = arg("--judge") ?? "local";
  if (!isJudgeName(judgeName)) throw new Error(`--judge must be local, haiku, or sonnet`);
  const spec = JUDGES[judgeName];
  const prompt = arg("--prompt") ?? PROMPT_V2_VERSION;
  if (prompt !== "judge-v1" && prompt !== PROMPT_V2_VERSION) throw new Error(`--prompt must be judge-v1 or ${PROMPT_V2_VERSION}`);
  if (prompt === "judge-v1" && spec.backend !== "ollama") throw new Error("judge-v1 exists only for the local judge");

  const t0 = Date.now();
  let outcomes: ItemOutcome[];
  let echoPrompt = PROMPT_V2;
  let estimatedUsd = 0;
  if (prompt === "judge-v1") {
    outcomes = await runV1(items);
    echoPrompt = SYSTEM_PROMPT;
  } else if (spec.backend === "anthropic") {
    const todo = await uncached(spec, items);
    const est = estimateRun(spec.model, todo.map((i) => requestChars(i.title, i.body)), MAX_OUTPUT_TOKENS);
    estimatedUsd = est.usd;
    console.log(`${spec.model}: ${todo.length} uncached items, est. ≤ $${est.usd.toFixed(4)}`);
    checkCaps(est.usd, await readSpent());
    if (todo.length > 0 && !flag("--confirm-spend")) {
      console.log("No API calls made. Re-run with --confirm-spend once Peter has approved this estimate.");
      process.exit(2);
    }
    outcomes = await runV2(spec, items, false, flag("--raw"));
  } else {
    const cacheOnly = !(await ollamaAvailable());
    if (cacheOnly) console.warn(`Ollama or ${spec.model} not available; using cached judge-v2 answers only.`);
    outcomes = await runV2(spec, items, cacheOnly, flag("--raw"));
  }
  const seconds = (Date.now() - t0) / 1000;

  const calls = judgeV2Stats.judged + judgeV2Stats.failures;
  if (spec.backend === "anthropic" && calls > 0) {
    await appendSpend({
      model: spec.model, promptVersion: prompt, items: calls,
      inputTokens: judgeV2Stats.inputTokens, outputTokens: judgeV2Stats.outputTokens,
      estimatedUsd, note: `eval${limit ? ` --limit ${limit}` : ""}`,
    });
  }

  const r = report(outcomes, rubricEchoChecker(echoPrompt));
  const costPer1000 =
    spec.backend === "ollama"
      ? `$0 (local${judgeV2Stats.judged ? `, ${(judgeV2Stats.seconds / judgeV2Stats.judged).toFixed(1)} s/item` : ""})`
      : `$${((spentFor(await readFile(SPEND_LOG, "utf8").catch(() => ""), spec.model, prompt) / fixture.items.length) * 1000).toFixed(2)} (all logged spend incl. retries ÷ ${fixture.items.length} items)`;

  console.log(JSON.stringify({ judge: judgeName, model: spec.model, prompt, seconds: Math.round(seconds), stats: judgeV2Stats, report: r, costPer1000 }, null, 2));
  if (r.labeled === 0) console.log("No labels in the frozen set: agreement and false-positive rates are n/a. Label docs/eval-labels.xlsx, then run npm run eval:export.");

  if (limit === undefined) {
    await mkdir(RESULTS_DIR, { recursive: true });
    const saved: SavedResult = { judge: judgeName, model: spec.model, prompt, runAt: new Date().toISOString(), report: r, costPer1000 };
    await writeFile(join(RESULTS_DIR, `${judgeName}-${prompt}.json`), `${JSON.stringify(saved, null, 2)}\n`);
    await writeOutcomes(fixture.items.length, fixture.items.filter((i) => i.label).length);
    console.log(`Updated ${OUTCOMES} (Scorer v2 experiment).`);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
