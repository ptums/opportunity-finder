// Phase 0 labeling workbook: Peter edits scores and Pursue? in Excel; totals, bands, and
// the precision/override metrics recalculate with formulas.
import { access } from "node:fs/promises";
import ExcelJS from "exceljs";
import { total, type Scores } from "./score.js";

export interface Ranked {
  source: string;
  url: string;
  title: string;
  problem: string;
  snippet: string;
  publishedAt: string;
  scores: Scores;
  ruleTotal: number;
}

export interface WorkbookMeta {
  generatedAt: string;
  method: string;
}

const FONT = "Arial";
const CRITERIA: [keyof Scores, string][] = [
  ["frequency", "Freq"],
  ["pain", "Pain"],
  ["messy", "Messy"],
  ["backend", "Backend"],
  ["reachable", "Reach"],
  ["freeData", "Free data"],
];
// Light blue marks cells Peter types into; yellow is reserved for "neutral" in the color scale.
const INPUT_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDDEBF7" } };
// Excel's standard good / neutral / bad styles. Higher scores are better.
const GOOD = { font: { color: { argb: "FF006100" } }, fill: { type: "pattern", pattern: "solid", bgColor: { argb: "FFC6EFCE" } } } as const;
const NEUTRAL = { font: { color: { argb: "FF9C5700" } }, fill: { type: "pattern", pattern: "solid", bgColor: { argb: "FFFFEB9C" } } } as const;
const BAD = { font: { color: { argb: "FF9C0006" } }, fill: { type: "pattern", pattern: "solid", bgColor: { argb: "FFFFC7CE" } } } as const;
const HEADER_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F3864" } };
const REF_FONT = { name: FONT, size: 10, color: { argb: "FF7F7F7F" } };
const FIRST = 5; // first data row on Candidates

const col = (n: number) => String.fromCharCode(64 + n); // 1 -> A (fine for < 27 columns)

function styleHeader(row: ExcelJS.Row) {
  row.eachCell((c) => {
    c.font = { name: FONT, bold: true, color: { argb: "FFFFFFFF" } };
    c.fill = HEADER_FILL;
    c.alignment = { vertical: "middle", wrapText: true };
  });
  row.height = 30;
}

/** True if Peter has already filled in any Pursue? cell. */
export async function workbookHasLabels(path: string): Promise<boolean> {
  try {
    await access(path);
  } catch {
    return false;
  }
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(path);
  const ws = wb.getWorksheet("Candidates");
  if (!ws) return false;
  for (let r = FIRST; r <= ws.rowCount; r++) {
    if (String(ws.getCell(`M${r}`).value ?? "").trim()) return true;
  }
  return false;
}

export async function writeWorkbook(path: string, rows: Ranked[], meta: WorkbookMeta): Promise<void> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "opportunity-finder scout";
  // exceljs stores formulas without cached results; make Excel compute everything on open.
  wb.calcProperties = { fullCalcOnLoad: true };
  const last = FIRST + rows.length - 1;
  const rng = (c: string) => `Candidates!$${c}$${FIRST}:$${c}$${last}`;

  // Rules-only rank, so the Summary can compare it with the scout's ranking.
  const rulesRank = new Map(
    [...rows.keys()].sort((a, b) => rows[b]!.ruleTotal - rows[a]!.ruleTotal || a - b).map((idx, rank) => [idx, rank + 1]),
  );

  // --- Candidates -----------------------------------------------------------
  const ws = wb.addWorksheet("Candidates", { views: [{ state: "frozen", xSplit: 3, ySplit: FIRST - 1 }] });
  ws.getCell("A1").value = "Phase 0 candidates";
  ws.getCell("A1").font = { name: FONT, bold: true, size: 14 };
  ws.getCell("A2").value =
    "You can edit the six score columns (1–3), Pursue? and Notes (light blue). Total, Band, and the Summary sheet recalculate. " +
    "Example: Pursue? = maybe, Notes = \"talk to 2 bookkeepers before deciding\". Grey columns are the scout's original output for comparison.";
  ws.getCell("A3").value =
    "Colors: higher is better. Green = good (score 3, Total 15+, Shortlist). Yellow = neutral (score 2, Total 10–14). Red = weak (score 1, Total under 10, Drop).";
  ws.getCell("A3").font = { name: FONT, bold: true, size: 10 };
  ws.mergeCells("A3:S3");
  ws.getCell("A2").font = { name: FONT, italic: true, size: 10 };
  ws.mergeCells("A2:S2");
  ws.getRow(2).height = 30;
  ws.getCell("A2").alignment = { wrapText: true, vertical: "top" };

  const headers = [
    "#", "Source", "Problem", "Link",
    ...CRITERIA.map(([, label]) => label),
    "Total", "Band", "Pursue?", "Notes", "Scores changed",
    "Scout total", "Rules-only total", "Rules-only rank", "Original title",
  ];
  ws.getRow(FIRST - 1).values = headers;
  styleHeader(ws.getRow(FIRST - 1));

  rows.forEach((c, i) => {
    const r = FIRST + i;
    const reasonsRow = 2 + i;
    const row = ws.getRow(r);
    row.values = [
      i + 1,
      c.source,
      c.problem,
      { text: "open", hyperlink: c.url },
      ...CRITERIA.map(([k]) => c.scores[k].value),
      { formula: `SUM(E${r}:J${r})` },
      { formula: `IF(K${r}>=15,"Shortlist",IF(K${r}<10,"Drop","Middle"))` },
      null,
      null,
      {
        // Count of scores that differ from the scout's originals on the Score reasons sheet.
        formula: CRITERIA.map((_, k) => `(${col(5 + k)}${r}<>'Score reasons'!${col(3 + 3 * k)}${reasonsRow})`).join("+"),
      },
      total(c.scores),
      c.ruleTotal,
      rulesRank.get(i)!,
      c.title,
    ];
    row.eachCell({ includeEmpty: true }, (cell, n) => {
      cell.font = { name: FONT, size: 10 };
      cell.alignment = { vertical: "top", wrapText: n === 3 || n === 14 || n === 19 };
    });
    for (const n of [13, 14]) ws.getCell(r, n).fill = INPUT_FILL;
    for (const n of [16, 17, 18, 19]) ws.getCell(r, n).font = REF_FONT;
    ws.getCell(r, 4).font = { name: FONT, size: 10, color: { argb: "FF0563C1" }, underline: true };
    ws.getCell(r, 11).font = { name: FONT, size: 10, bold: true };
  });

  for (let r = FIRST; r <= last; r++) {
    for (let n = 5; n <= 10; n++) {
      ws.getCell(r, n).dataValidation = {
        type: "whole", operator: "between", formulae: [1, 3], allowBlank: false,
        showErrorMessage: true, errorTitle: "Score", error: "Scores are whole numbers from 1 to 3.",
      };
    }
    ws.getCell(r, 13).dataValidation = {
      type: "list", formulae: ['"yes,maybe,no"'], allowBlank: true,
      showErrorMessage: true, errorTitle: "Pursue?", error: "Choose yes, maybe, or no.",
    };
  }
  const cf = (ref: string, rules: ExcelJS.ConditionalFormattingRule[]) => ws.addConditionalFormatting({ ref, rules });
  cf(`E${FIRST}:J${last}`, [
    { type: "cellIs", operator: "equal", formulae: ["3"], priority: 1, style: GOOD },
    { type: "cellIs", operator: "equal", formulae: ["2"], priority: 2, style: NEUTRAL },
    { type: "cellIs", operator: "equal", formulae: ["1"], priority: 3, style: BAD },
  ]);
  cf(`K${FIRST}:K${last}`, [
    { type: "cellIs", operator: "greaterThan", formulae: ["14"], priority: 4, style: GOOD },
    { type: "cellIs", operator: "between", formulae: ["10", "14"], priority: 5, style: NEUTRAL },
    { type: "cellIs", operator: "lessThan", formulae: ["10"], priority: 6, style: BAD },
  ]);
  // Exact-match expressions rather than "containsText" rules: exceljs omits the rule's text
  // attribute, and plain formulas behave the same in Excel, Numbers, and LibreOffice.
  const byText = (c: string, good: string, neutral: string, bad: string, p: number) =>
    cf(`${c}${FIRST}:${c}${last}`, [
      { type: "expression", formulae: [`$${c}${FIRST}="${good}"`], priority: p, style: GOOD },
      { type: "expression", formulae: [`$${c}${FIRST}="${neutral}"`], priority: p + 1, style: NEUTRAL },
      { type: "expression", formulae: [`$${c}${FIRST}="${bad}"`], priority: p + 2, style: BAD },
    ]);
  byText("L", "Shortlist", "Middle", "Drop", 7);
  byText("M", "yes", "maybe", "no", 10);
  [5, 13, 60, 7, 7, 7, 8, 9, 8, 9, 8, 11, 9, 30, 10, 9, 10, 10, 45].forEach((w, i) => (ws.getColumn(i + 1).width = w));
  ws.autoFilter = `A${FIRST - 1}:S${last}`;

  // --- Score reasons (scout's original scores; also the baseline for "Scores changed") ---
  const rs = wb.addWorksheet("Score reasons", { views: [{ state: "frozen", xSplit: 2, ySplit: 1 }] });
  rs.getRow(1).values = ["#", "Problem", ...CRITERIA.flatMap(([, l]) => [`${l} (orig)`, `${l} method`, `${l} reason`])];
  styleHeader(rs.getRow(1));
  rows.forEach((c, i) => {
    const row = rs.getRow(2 + i);
    row.values = [
      i + 1,
      c.problem,
      ...CRITERIA.flatMap(([k]) => {
        const s = c.scores[k];
        return [s.value, s.model ? `${s.model.name} (${s.model.promptVersion})` : "rule", s.reason];
      }),
    ];
    row.eachCell((cell) => {
      cell.font = { name: FONT, size: 10 };
      cell.alignment = { vertical: "top", wrapText: true };
    });
  });
  rs.getColumn(1).width = 5;
  rs.getColumn(2).width = 45;
  CRITERIA.forEach((_, k) => {
    rs.getColumn(3 + 3 * k).width = 8;
    rs.getColumn(4 + 3 * k).width = 16;
    rs.getColumn(5 + 3 * k).width = 40;
  });

  // --- Summary --------------------------------------------------------------
  const sm = wb.addWorksheet("Summary");
  sm.getColumn(1).width = 46;
  sm.getColumn(2).width = 14;
  sm.getColumn(3).width = 70;
  const pursue = rng("M");
  const lines: [string, ExcelJS.CellValue, string, string?][] = [
    ["Phase 0 summary", null, ""],
    ["Inputs (fill in)", null, ""],
    ["Manual search minutes before abandoning", null, "From your timer: start 10:39 PM on 2026-10-03 to when you stopped. Enter minutes.", "input"],
    ["Minutes spent reviewing this workbook", null, "Start a timer when you open this file; enter minutes when done.", "input"],
    ["Results (formulas)", null, ""],
    ["Candidates", { formula: `COUNTA(${rng("C")})` }, "Rows on the Candidates sheet."],
    ["Labeled", { formula: `COUNTIF(${pursue},"yes")+COUNTIF(${pursue},"maybe")+COUNTIF(${pursue},"no")` }, "Rows with Pursue? filled in."],
    ["Pursue = yes", { formula: `COUNTIF(${pursue},"yes")` }, ""],
    ["Pursue = maybe", { formula: `COUNTIF(${pursue},"maybe")` }, ""],
    ["Pursue = no", { formula: `COUNTIF(${pursue},"no")` }, ""],
    ["Precision of top 20 (yes ÷ candidates)", { formula: "IF(B6=0,0,B8/B6)" }, "REQUIREMENTS §9: share of the top 20 you label interesting.", "pct"],
    ["Precision, lenient (yes + maybe ÷ candidates)", { formula: "IF(B6=0,0,(B8+B9)/B6)" }, "", "pct"],
    ["Top 10 by scout ranking: share yes", { formula: `COUNTIFS(${rng("A")},"<=10",${pursue},"yes")/10` }, "Hybrid ranking (rows 1–10 as delivered).", "pct"],
    ["Top 10 by rules-only ranking: share yes", { formula: `COUNTIFS(${rng("R")},"<=10",${pursue},"yes")/10` }, "Same rows ranked by rules only. Higher than the line above means the model didn't help.", "pct"],
    ["Shortlist (Total ≥ 15) after your edits", { formula: `COUNTIF(${rng("K")},">=15")` }, ""],
    ["Scores you changed", { formula: `SUM(${rng("O")})` }, "FR-18: overrides are labels for measuring scoring quality."],
    ["Hours per qualified opportunity (assisted)", { formula: "IF(B8=0,0,B4/60/B8)" }, "Review minutes ÷ 60 ÷ yes count. 0 until you enter minutes and label.", "num"],
    ["Run info", null, ""],
    ["Generated", meta.generatedAt, ""],
    ["Scoring method", meta.method, ""],
  ];
  lines.forEach(([label, value, note, kind], i) => {
    const row = sm.getRow(i + 1);
    row.values = [label, value, note];
    row.eachCell({ includeEmpty: true }, (c) => (c.font = { name: FONT, size: 10 }));
    row.getCell(3).alignment = { wrapText: true, vertical: "top" };
    if (value === null && !kind) row.getCell(1).font = { name: FONT, bold: true, size: i === 0 ? 14 : 11 };
    if (kind === "input") row.getCell(2).fill = INPUT_FILL;
    if (kind === "pct") row.getCell(2).numFmt = "0%";
    if (kind === "num") row.getCell(2).numFmt = "0.00";
  });

  // --- Rubric ---------------------------------------------------------------
  const rb = wb.addWorksheet("Rubric");
  rb.getRow(1).values = ["Criterion", "1", "2", "3", "Scored by"];
  styleHeader(rb.getRow(1));
  [
    ["Frequency", "Seen once", "2–3 times, or in 2 places", "Recurring across sources or many comments", "Rule"],
    ["Pain", "Annoyance, no cost stated", "Time or money cost implied", "Hours or dollars stated", "Model (HN), rule (USAspending)"],
    ["Messy data", "One clean source", "Some variants or missing fields", "Several sources, no shared key", "Model (HN), rule (USAspending)"],
    ["Backend weight", "Mostly UI / forms", "Some ingestion or matching", "Real ingestion, matching, storage", "Model (HN), rule (USAspending)"],
    ["Reachable", "Can't say where they are", "Know a community", "Could message 5 this week", "Model (HN), rule (USAspending)"],
    ["Free data", "Needs paid/private data", "Partly public", "Prototype fully on public data", "Rule"],
    ["Total", "6–18", "≥ 15 = Shortlist", "< 10 = Drop", ""],
  ].forEach((v, i) => {
    const row = rb.getRow(2 + i);
    row.values = v;
    row.eachCell((c) => {
      c.font = { name: FONT, size: 10 };
      c.alignment = { wrapText: true, vertical: "top" };
    });
  });
  ([[2, BAD], [3, NEUTRAL], [4, GOOD]] as const).forEach(([n, st]) => {
    const c = rb.getCell(1, n);
    c.fill = { type: "pattern", pattern: "solid", fgColor: st.fill.bgColor };
    c.font = { name: FONT, bold: true, color: st.font.color };
  });
  rb.getCell("A10").value = "Higher is better: 3 is the strongest score on every criterion, 1 the weakest.";
  rb.getCell("A10").font = { name: FONT, italic: true, size: 10 };
  [16, 26, 30, 34, 30].forEach((w, i) => (rb.getColumn(i + 1).width = w));

  wb.views = [{ activeTab: 0, x: 0, y: 0, width: 20000, height: 12000, firstSheet: 0, visibility: "visible" }];
  await wb.xlsx.writeFile(path);
}
