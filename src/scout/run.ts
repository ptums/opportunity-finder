// Phase 0 scout: fetch candidates from HN + USAspending, score them (rules + local model,
// see ADR-002), and write a ranked shortlist for Peter to review and label by hand.
//   npm run scout                 # model judges the top 80 HN items by rule score
//   npm run scout -- --judge-all  # model judges every HN item
//   npm run scout -- --no-model   # rules only
// Scorer v2 (ADR-003):
//   --judge local|haiku|sonnet    # default sonnet (Peter approved 2026-10-04). Rollback: --judge local
//   --prompt judge-v1|judge-v2.1  # default judge-v1 for local, judge-v2.1 for haiku/sonnet
//   --dry-run                     # fetch from cache, print the judge cost estimate, write nothing
//   --confirm-spend               # required before a paid judge makes any API call
import { access, readFile, writeFile } from "node:fs/promises";
import { appendSpend, checkCaps, estimateRun, readSpent } from "./cost.js";
import { scoutHn, type HnCandidate } from "./hn.js";
import { stats } from "./http.js";
import { judge, judgeStats, JUDGE_MODEL, ollamaAvailable, PROMPT_VERSION } from "./judge.js";
import {
  applyJudgmentV2, evaluateV2, isCachedV2, isJudgeName, JUDGES, type JudgeSpec, judgeV2, judgeV2Stats,
  MAX_OUTPUT_TOKENS, PROMPT_V2_VERSION, requestChars,
} from "./judge-v2.js";
import { applyJudgment, total, type Scored } from "./score.js";
import { scoutUsaspending, type UsaCandidate } from "./usaspending.js";
import { type GatedOut, type Ranked, workbookHasLabels, writeWorkbook } from "./workbook.js";

const OUT = "docs/phase0-candidates.md";
const XLSX = "docs/phase0-candidates.xlsx";
const HN_TOP = 12;
const USA_TOP = 8;
const DEFAULT_JUDGE_LIMIT = 80;

const esc = (s: string) => s.replace(/\|/g, "\\|").replace(/\n/g, " ");

function row(c: Ranked, i: number): string {
  const s = c.scores;
  const v = (x: Scored | undefined) => (!x ? "–" : x.unsupported ? "unsupported" : x.value);
  return `| ${i + 1} | ${c.source} | [link](${c.url}) | ${esc(c.problem)} | ${v(s.frequency)} | ${v(s.pain)} | ${v(s.messy)} | ${v(s.backend)} | ${v(s.reachable)} | ${v(s.buyer)} | ${v(s.freeData)} | **${total(s)}** | ${c.ruleTotal} | |`;
}

function detail(c: Ranked, i: number): string {
  const s = c.scores;
  const line = (label: string, x: Scored | undefined) =>
    !x ? "" : `- ${label} ${x.unsupported ? "unsupported" : x.value} (${x.model ? `model ${x.model.name}` : "rule"}): ${x.reason}`;
  const gates = c.gates
    ? Object.entries(c.gates).map(([k, g]) => `- ${k}: ${g.status}${g.note ? ` (${g.note})` : ""} — "${g.quote}"`)
    : [];
  return [
    `### ${i + 1}. ${c.problem}`,
    `${c.source} · ${c.publishedAt} · ${c.url}`,
    c.title === c.problem ? "" : `\nOriginal title: ${c.title}`,
    "",
    `> ${esc(c.snippet)}${c.snippet.length >= 280 ? "…" : ""}`,
    "",
    line("Frequency", s.frequency),
    line("Pain", s.pain),
    line("Messy", s.messy),
    line("Backend", s.backend),
    line("Reachable", s.reachable),
    line("Buyer", s.buyer),
    line("Free data", s.freeData),
    ...gates,
    c.evidence ? `- Evidence: ${c.evidence} quotes found in the post; popularity ${c.popularity} comments` : "",
    "",
  ].join("\n");
}

/** Refuse to overwrite a shortlist Peter has already started labeling. */
async function outputPath(): Promise<string> {
  try {
    await access(OUT);
  } catch {
    return OUT;
  }
  const labeled = /\| (yes|maybe|no) \|\s*$/im.test(await readFile(OUT, "utf8"));
  return labeled ? OUT.replace(".md", `-${Date.now()}.md`) : OUT;
}

async function judgeHn(
  hn: HnCandidate[],
  limit: number,
  cacheOnly: boolean,
): Promise<{ kept: Ranked[]; dropped: number }> {
  const byRule = [...hn].sort((a, b) => total(b.scores) - total(a.scores));
  const kept: Ranked[] = [];
  let dropped = 0;
  for (const [i, c] of byRule.entries()) {
    const base = { ...c, problem: c.title, ruleTotal: total(c.scores) };
    if (i >= limit) {
      kept.push(base);
      continue;
    }
    process.stdout.write(`\rjudging ${i + 1}/${Math.min(limit, byRule.length)}…`);
    const j = await judge(c.title, c.body, { cacheOnly });
    if (!j) {
      kept.push(base); // model failed: keep rule scores
    } else if (!j.isProblem) {
      dropped++;
    } else {
      kept.push({ ...base, problem: j.problem, scores: applyJudgment(c.scores, j) });
    }
  }
  process.stdout.write("\n");
  return { kept, dropped };
}

async function judgeHnV2(
  spec: JudgeSpec,
  hn: HnCandidate[],
  limit: number,
  cacheOnly: boolean,
): Promise<{ kept: Ranked[]; gatedOut: GatedOut[] }> {
  const byRule = [...hn].sort((a, b) => total(b.scores) - total(a.scores));
  const kept: Ranked[] = [];
  const gatedOut: GatedOut[] = [];
  for (const [i, c] of byRule.entries()) {
    const base: Ranked = { ...c, problem: c.title, ruleTotal: total(c.scores), popularity: c.comments };
    if (i >= limit) break; // v2 lists judged posts only; rule-only rows have no gates to show
    process.stdout.write(`\rjudging ${i + 1}/${Math.min(limit, byRule.length)}…`);
    const j = await judgeV2(spec, c, { cacheOnly });
    if (!j) {
      kept.push({ ...base, status: "needs_review", evidence: "judge failed" }); // keep rule scores, flag it
      continue;
    }
    const ev = evaluateV2(j, c.title, c.body, spec.model);
    if (ev.status === "gated_out") {
      gatedOut.push({ url: c.url, title: c.title, problem: ev.problem, gates: ev.gates });
      continue;
    }
    kept.push({
      ...base,
      problem: ev.problem,
      scores: applyJudgmentV2(c.scores, ev, c.comments),
      gates: ev.gates,
      evidence: `${ev.quotesValid}/${ev.quotesTotal}`,
      status: ev.status,
    });
  }
  process.stdout.write("\n");
  return { kept, gatedOut };
}

function argValue(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const judgeName = argValue("--judge") ?? "sonnet";
  if (!isJudgeName(judgeName)) throw new Error("--judge must be local, haiku, or sonnet");
  const spec = JUDGES[judgeName];
  const prompt = argValue("--prompt") ?? (spec.backend === "ollama" ? PROMPT_VERSION : PROMPT_V2_VERSION);
  if (prompt !== PROMPT_VERSION && prompt !== PROMPT_V2_VERSION) throw new Error(`--prompt must be ${PROMPT_VERSION} or ${PROMPT_V2_VERSION}`);
  if (prompt === PROMPT_VERSION && spec.backend !== "ollama") throw new Error(`${PROMPT_VERSION} exists only for the local judge`);
  const v2 = prompt === PROMPT_V2_VERSION;

  const t0 = Date.now();
  const year = new Date().getUTCFullYear();
  const [hn, usa] = await Promise.all([scoutHn(365), scoutUsaspending(`${year - 1}-10-01`, `${year}-09-30`)]);
  const fetchSeconds = (Date.now() - t0) / 1000;

  const useModel = !args.has("--no-model");
  const limit = !useModel ? 0 : args.has("--judge-all") ? hn.length : DEFAULT_JUDGE_LIMIT;
  const toJudge = [...hn].sort((a, b) => total(b.scores) - total(a.scores)).slice(0, limit);

  let estimatedUsd = 0;
  if (useModel && v2 && spec.backend === "anthropic") {
    const todo: HnCandidate[] = [];
    for (const c of toJudge) if (!(await isCachedV2(spec, c.title, c.body))) todo.push(c);
    const est = estimateRun(spec.model, todo.map((c) => requestChars(c.title, c.body)), MAX_OUTPUT_TOKENS);
    estimatedUsd = est.usd;
    console.log(`${spec.model}: ${todo.length} uncached items, ~${est.inputTokens} input + ≤${est.outputTokens} output tokens, est. ≤ $${est.usd.toFixed(4)}`);
    checkCaps(est.usd, await readSpent());
    if (args.has("--dry-run")) return;
    if (todo.length > 0 && !args.has("--confirm-spend")) {
      console.log("No API calls made. Re-run with --confirm-spend once Peter has approved this estimate.");
      process.exit(2);
    }
  } else if (args.has("--dry-run")) {
    console.log(`${spec.model} ${prompt}: local judge, $0. ${toJudge.length} items would be judged.`);
    return;
  }

  const cacheOnly = useModel && spec.backend === "ollama" && !(await ollamaAvailable());
  if (cacheOnly) {
    console.warn(`Ollama or model ${JUDGE_MODEL} not available; using cached judgments only, rules for the rest.`);
  }
  let hnRanked: Ranked[];
  let dropped = 0;
  let gatedOut: GatedOut[] = [];
  if (v2 && useModel) {
    ({ kept: hnRanked, gatedOut } = await judgeHnV2(spec, hn, limit, cacheOnly));
    dropped = gatedOut.length;
    const calls = judgeV2Stats.judged + judgeV2Stats.failures;
    if (spec.backend === "anthropic" && calls > 0) {
      await appendSpend({
        model: spec.model, promptVersion: prompt, items: calls,
        inputTokens: judgeV2Stats.inputTokens, outputTokens: judgeV2Stats.outputTokens,
        estimatedUsd, note: "scout",
      });
    }
  } else {
    ({ kept: hnRanked, dropped } = await judgeHn(hn, limit, cacheOnly));
  }
  const usaRanked: Ranked[] = usa.map((c: UsaCandidate) => ({ ...c, problem: c.title, ruleTotal: total(c.scores) }));

  // Scorer v2: posts that passed every gate rank above those needing review, then by total (no cutoff).
  const gateRank = (r: Ranked) => (r.status === "passed" ? 0 : r.status === "needs_review" ? 1 : 0);
  const byScore = (a: Ranked, b: Ranked) =>
    gateRank(a) - gateRank(b) || total(b.scores) - total(a.scores) || b.ruleTotal - a.ruleTotal;
  const hnTop = hnRanked.sort(byScore).slice(0, HN_TOP);
  const usaTop = usaRanked.sort(byScore).slice(0, USA_TOP);
  // v2 HN totals (no Frequency, plus Buyer) aren't comparable with USAspending's, so keep the sources in blocks.
  const top = v2 && useModel ? [...hnTop, ...usaTop] : [...hnTop, ...usaTop].sort(byScore);
  const seconds = ((Date.now() - t0) / 1000).toFixed(1);

  const method = !useModel
    ? "Rules only (model not used)."
    : v2
      ? `Scorer v2 (ADR-003): gates G1–G4, then Pain, Messy, Backend, Reachable, Buyer for HN by **${spec.model}** (prompt ${PROMPT_V2_VERSION}) on the top ${limit} HN items by rule score, each with a quote checked against the post. HN total excludes Frequency (shown as popularity) and unsupported scores. USAspending: rules.`
        + (cacheOnly ? ` Ollama was not running: ${judgeV2Stats.skipped} items with no cached judgment used rules.` : "")
      : `Hybrid (ADR-002): Pain, Messy, Backend, Reachable for HN by **${JUDGE_MODEL}** (prompt ${PROMPT_VERSION}) on the top ${limit} HN items by rule score; everything else by rules.`
        + (cacheOnly ? ` Ollama was not running: ${judgeStats.skipped} items with no cached judgment used rules.` : "");

  const md = [
    "# Phase 0 candidates (auto-generated)",
    "",
    `Generated ${new Date().toISOString()} by \`npm run scout\` in ${seconds}s. ${method}`,
    "",
    `HN posts found: ${hn.length}; dropped by model ${v2 ? "at a gate" : "as not-a-problem"}: ${dropped}; USAspending themes: ${usa.length}. Showing top ${HN_TOP} HN + top ${USA_TOP} USAspending.`,
    "",
    "Review each row: change any score you disagree with and fill in **Pursue?** (yes / maybe / no). **Rules** is the rules-only total, kept so your labels can measure whether the model helped.",
    "",
    "| # | Source | URL | Problem | Freq | Pain | Messy | Backend | Reach | Buyer | Free data | Total | Rules | Pursue? |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
    ...top.map(row),
    "",
    "## Details and score reasons",
    "",
    ...top.map(detail),
    "## Run stats",
    "",
    v2
      ? `Fetch: ${fetchSeconds.toFixed(1)}s. Model: ${judgeV2Stats.judged} judged, ${judgeV2Stats.cacheHits} from cache, ${judgeV2Stats.failures} failures, ${judgeV2Stats.skipped} skipped, ${judgeV2Stats.seconds.toFixed(0)}s model time, ${judgeV2Stats.inputTokens} input / ${judgeV2Stats.outputTokens} output API tokens.`
      : `Fetch: ${fetchSeconds.toFixed(1)}s. Model: ${judgeStats.judged} judged, ${judgeStats.cacheHits} from cache, ${judgeStats.failures} failures, ${judgeStats.skipped} skipped (no cache, Ollama off), ${judgeStats.seconds.toFixed(0)}s model time.`,
    "",
    "| Source | HTTP requests | Cache hits | Errors |",
    "| --- | --- | --- | --- |",
    ...Object.entries(stats).map(([k, v]) => `| ${k} | ${v.requests} | ${v.cacheHits} | ${v.errors} |`),
    "",
  ].join("\n");

  // Scorer v2 runs always write timestamped copies so no Phase 0 file is ever replaced.
  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
  const out = v2 && useModel ? `docs/scout-v2-${stamp}.md` : await outputPath();
  await writeFile(out, md);
  const xlsx =
    v2 && useModel
      ? `docs/scout-v2-${stamp}.xlsx`
      : (await workbookHasLabels(XLSX)) ? XLSX.replace(".xlsx", `-${Date.now()}.xlsx`) : XLSX;
  await writeWorkbook(xlsx, top, { generatedAt: new Date().toISOString(), method: method.replace(/\*\*/g, "") }, gatedOut);
  console.log(`Wrote ${out} and ${xlsx}: ${top.length} candidates in ${seconds}s`);
  console.log(JSON.stringify({ http: stats, model: v2 ? judgeV2Stats : judgeStats, dropped }));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
