// Build or refresh the frozen evaluation set (ADR-003).
//   npm run eval:export             # first run: freeze the 80 posts + write docs/eval-labels.xlsx
//   npm run eval:export             # later runs: keep the items, report label counts and problems
//   npm run eval:export -- --rebuild  # re-select the items (only if Peter asks)
// Selection matches the Phase 0 judge run: the top 80 HN posts by rule score, plus any known
// false positive that fell outside them. No author fields are read or stored.
import { access, mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { scoutHn } from "./hn.js";
import { total } from "./score.js";
import {
  type EvalFixture, type EvalItem, FIXTURE, KNOWN_FP, LABELS_XLSX, readFixture, readLabels, withLabels, writeLabelWorkbook,
} from "./eval-set.js";

const TOP = 80;

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function selectItems(): Promise<EvalItem[]> {
  const hn = await scoutHn(365);
  const byRule = [...hn].sort((a, b) => total(b.scores) - total(a.scores));
  const chosen = byRule.slice(0, TOP);
  for (const c of hn) if (KNOWN_FP[c.id] && !chosen.includes(c)) chosen.push(c);
  return chosen.map((c) => ({
    id: c.id,
    url: c.url,
    title: c.title,
    body: c.body,
    publishedAt: c.publishedAt,
    comments: c.comments,
    phrases: c.phrases,
    label: null,
    reason: null,
  }));
}

async function main() {
  const rebuild = process.argv.includes("--rebuild");
  let fixture: EvalFixture;
  if (!rebuild && (await exists(FIXTURE))) {
    fixture = await readFixture();
  } else {
    fixture = {
      createdAt: new Date().toISOString(),
      selection: `top ${TOP} HN posts by rule score (Phase 0 scout, 365 days) plus known false positives`,
      items: await selectItems(),
    };
  }

  // The repo is public: the committed fixture carries posts only. Labels stay in the local,
  // gitignored docs/eval-labels.xlsx and are merged in at eval time (see withLabels).
  for (const it of fixture.items) {
    it.label = null;
    it.reason = null;
  }
  await mkdir(dirname(FIXTURE), { recursive: true });
  await writeFile(FIXTURE, `${JSON.stringify(fixture, null, 2)}\n`);
  const { labels, problems } = await readLabels();
  const merged = withLabels(fixture, labels);
  if (!(await exists(LABELS_XLSX))) await writeLabelWorkbook(LABELS_XLSX, fixture.items);

  const labeled = merged.items.filter((i) => i.label).length;
  const missingFp = Object.keys(KNOWN_FP).filter((id) => !fixture.items.some((i) => i.id === id));
  console.log(`${FIXTURE}: ${fixture.items.length} items, ${labeled} labeled. Labels from ${LABELS_XLSX}.`);
  if (missingFp.length) console.log(`Known false positives not in the set: ${missingFp.map((id) => KNOWN_FP[id]).join(", ")}`);
  for (const p of problems) console.log(`label problem: ${p}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
