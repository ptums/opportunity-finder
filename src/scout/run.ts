// Phase 0 scout: fetch candidates from HN + USAspending, score them (rules + local model,
// see ADR-002), and write a ranked shortlist for Peter to review and label by hand.
//   npm run scout                 # model judges the top 80 HN items by rule score
//   npm run scout -- --judge-all  # model judges every HN item
//   npm run scout -- --no-model   # rules only
import { access, readFile, writeFile } from "node:fs/promises";
import { scoutHn, type HnCandidate } from "./hn.js";
import { stats } from "./http.js";
import { judge, judgeStats, JUDGE_MODEL, ollamaAvailable, PROMPT_VERSION } from "./judge.js";
import { applyJudgment, total, type Scores } from "./score.js";
import { scoutUsaspending, type UsaCandidate } from "./usaspending.js";

const OUT = "docs/phase0-candidates.md";
const HN_TOP = 12;
const USA_TOP = 8;
const DEFAULT_JUDGE_LIMIT = 80;

interface Ranked {
  source: string;
  url: string;
  title: string;
  problem: string;
  snippet: string;
  publishedAt: string;
  scores: Scores;
  ruleTotal: number;
}

const esc = (s: string) => s.replace(/\|/g, "\\|").replace(/\n/g, " ");

function row(c: Ranked, i: number): string {
  const s = c.scores;
  return `| ${i + 1} | ${c.source} | [link](${c.url}) | ${esc(c.problem)} | ${s.frequency.value} | ${s.pain.value} | ${s.messy.value} | ${s.backend.value} | ${s.reachable.value} | ${s.freeData.value} | **${total(s)}** | ${c.ruleTotal} | |`;
}

function detail(c: Ranked, i: number): string {
  const s = c.scores;
  const line = (label: string, x: Scores[keyof Scores]) =>
    `- ${label} ${x.value} (${x.model ? `model ${x.model.name}` : "rule"}): ${x.reason}`;
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
    line("Free data", s.freeData),
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

async function judgeHn(hn: HnCandidate[], limit: number): Promise<{ kept: Ranked[]; dropped: number }> {
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
    const j = await judge(c.title, c.body);
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

async function main() {
  const args = new Set(process.argv.slice(2));
  const t0 = Date.now();
  const year = new Date().getUTCFullYear();
  const [hn, usa] = await Promise.all([scoutHn(365), scoutUsaspending(`${year - 1}-10-01`, `${year}-09-30`)]);
  const fetchSeconds = (Date.now() - t0) / 1000;

  let useModel = !args.has("--no-model");
  if (useModel && !(await ollamaAvailable())) {
    console.warn(`Ollama or model ${JUDGE_MODEL} not available; falling back to rules only.`);
    useModel = false;
  }
  const limit = !useModel ? 0 : args.has("--judge-all") ? hn.length : DEFAULT_JUDGE_LIMIT;
  const { kept: hnRanked, dropped } = await judgeHn(hn, limit);
  const usaRanked: Ranked[] = usa.map((c: UsaCandidate) => ({ ...c, problem: c.title, ruleTotal: total(c.scores) }));

  const byScore = (a: Ranked, b: Ranked) => total(b.scores) - total(a.scores) || b.ruleTotal - a.ruleTotal;
  const top = [...hnRanked.sort(byScore).slice(0, HN_TOP), ...usaRanked.sort(byScore).slice(0, USA_TOP)].sort(byScore);
  const seconds = ((Date.now() - t0) / 1000).toFixed(1);

  const method = useModel
    ? `Hybrid (ADR-002): Pain, Messy, Backend, Reachable for HN by **${JUDGE_MODEL}** (prompt ${PROMPT_VERSION}) on the top ${limit} HN items by rule score; everything else by rules.`
    : "Rules only (model not used).";

  const md = [
    "# Phase 0 candidates (auto-generated)",
    "",
    `Generated ${new Date().toISOString()} by \`npm run scout\` in ${seconds}s. ${method}`,
    "",
    `HN posts found: ${hn.length}; dropped by model as not-a-problem: ${dropped}; USAspending themes: ${usa.length}. Showing top ${HN_TOP} HN + top ${USA_TOP} USAspending.`,
    "",
    "Review each row: change any score you disagree with and fill in **Pursue?** (yes / maybe / no). **Rules** is the rules-only total, kept so your labels can measure whether the model helped.",
    "",
    "| # | Source | URL | Problem | Freq | Pain | Messy | Backend | Reach | Free data | Total | Rules | Pursue? |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
    ...top.map(row),
    "",
    "## Details and score reasons",
    "",
    ...top.map(detail),
    "## Run stats",
    "",
    `Fetch: ${fetchSeconds.toFixed(1)}s. Model: ${judgeStats.judged} judged, ${judgeStats.cacheHits} from cache, ${judgeStats.failures} failures, ${judgeStats.seconds.toFixed(0)}s model time.`,
    "",
    "| Source | HTTP requests | Cache hits | Errors |",
    "| --- | --- | --- | --- |",
    ...Object.entries(stats).map(([k, v]) => `| ${k} | ${v.requests} | ${v.cacheHits} | ${v.errors} |`),
    "",
  ].join("\n");

  const out = await outputPath();
  await writeFile(out, md);
  console.log(`Wrote ${out}: ${top.length} candidates in ${seconds}s`);
  console.log(JSON.stringify({ http: stats, model: judgeStats, dropped }));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
