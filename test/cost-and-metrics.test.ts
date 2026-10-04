import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { checkCaps, costUsd, estimateRun, estimateTokens, parseSpent, spentFor } from "../src/scout/cost.js";
import { type ItemOutcome, report } from "../src/scout/eval-metrics.js";
import { scoreText } from "../src/scout/score.js";
import { workbookHasLabels, writeWorkbook } from "../src/scout/workbook.js";

describe("cost", () => {
  it("prices tokens per million", () => {
    expect(costUsd("claude-haiku-4-5-20251001", 1_000_000, 0)).toBe(1);
    expect(costUsd("claude-sonnet-5-5", 0, 1_000_000)).toBe(10);
    expect(() => costUsd("unknown-model", 1, 1)).toThrow();
  });

  it("estimates pessimistically: 20% input margin, full output ceiling", () => {
    expect(estimateTokens(3500)).toBe(1200);
    const est = estimateRun("claude-haiku-4-5-20251001", [3500, 3500], 1500);
    expect(est).toMatchObject({ items: 2, inputTokens: 2400, outputTokens: 3000 });
    expect(est.usd).toBeCloseTo((2400 * 1 + 3000 * 5) / 1e6);
  });

  it("enforces the per-run and total caps", () => {
    expect(() => checkCaps(4.99, 0)).not.toThrow();
    expect(() => checkCaps(5.01, 0)).toThrow(/per-run cap/);
    expect(() => checkCaps(1, 19.5)).toThrow(/total cap/);
  });

  it("sums actual spend, falling back to the estimate", () => {
    const md = [
      "| Date | Model | Prompt version | Items | Input tokens | Output tokens | Estimated cost | Actual cost | Note |",
      "| --- | --- | --- | --- | --- | --- | --- | --- | --- |",
      "| 2026-10-04 | m | judge-v2 | 3 | 1 | 1 | $0.0300 | $0.0100 | smoke |",
      "| 2026-10-05 | m | judge-v2 | 80 | 1 | 1 | $0.5000 | n/a | x |",
    ].join("\n");
    expect(parseSpent(md)).toBeCloseTo(0.51);
    expect(spentFor(md, "m", "judge-v2")).toBeCloseTo(0.51);
    expect(spentFor(md, "other", "judge-v2")).toBe(0);
  });
});

describe("report", () => {
  const o = (id: string, label: ItemOutcome["label"], reason: ItemOutcome["reason"], shortlisted: boolean | null): ItemOutcome => ({
    id, label, reason, shortlisted, quotesValid: 2, quotesTotal: 4, reasons: ["about this post"],
  });

  it("computes agreement, false positives by reason, evidence, and known FPs", () => {
    const r = report(
      [
        o("1", "yes", null, true),
        o("2", "no", "nostalgia", true),
        o("45823234", "no", "nostalgia", true), // known FP #3
        o("4", "no", "no_buyer", false),
        o("5", null, null, true), // unlabeled
        o("6", "no", "other", null), // not judged
      ],
      () => false,
    );
    expect(r.judged).toBe(5);
    expect(r.labeled).toBe(4);
    expect(r.agreement).toBeCloseTo(2 / 4);
    // Shortlisted and labeled: "1" (yes), "2" and "45823234" (no). Labeled positive: "1".
    expect(r.precision).toBeCloseTo(1 / 3);
    expect(r.recall).toBe(1);
    expect(r.fpRateByReason.uncoded).toEqual({ rate: null, n: 0 });
    expect(r.fpRateByReason.nostalgia).toEqual({ rate: 1, n: 2 });
    expect(r.fpRateByReason.no_buyer).toEqual({ rate: 0, n: 1 });
    expect(r.fpRateByReason.off_lane).toEqual({ rate: null, n: 0 });
    expect(r.evidenceValidity).toBeCloseTo(0.5);
    expect(r.knownFpShortlisted).toEqual(["#3"]);
  });

  it("reports n/a agreement with no labels", () => {
    expect(report([o("1", null, null, true)], () => true)).toMatchObject({ agreement: null, rubricEcho: 1 });
  });
});

describe("workbookHasLabels", () => {
  it("finds the Pursue? column by header in the v2 layout", async () => {
    const dir = await mkdtemp(join(tmpdir(), "of-wb-"));
    const path = join(dir, "w.xlsx");
    const row = {
      source: "HN", url: "https://news.ycombinator.com/item?id=1", title: "t", problem: "p", snippet: "s",
      publishedAt: "2026-10-04", scores: scoreText("x", 0, 1), ruleTotal: 8,
    };
    await writeWorkbook(path, [row], { generatedAt: "now", method: "test" });
    expect(await workbookHasLabels(path)).toBe(false);

    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(path);
    wb.getWorksheet("Candidates")!.getCell("N5").value = "maybe";
    await wb.xlsx.writeFile(path);
    expect(await workbookHasLabels(path)).toBe(true);
  });
});
