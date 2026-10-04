// Frozen evaluation set for the judge comparison (ADR-003).
// Items are post text + metadata only (no authors). Labels come from Peter's labeling workbook,
// which is gitignored (public repo) and merged in at eval time.
import { access, readFile } from "node:fs/promises";
import ExcelJS from "exceljs";

export const FIXTURE = "test/fixtures/eval-set.json";
export const LABELS_XLSX = "docs/eval-labels.xlsx";

export const REASON_CODES = ["nostalgia", "no_buyer", "off_the_shelf", "off_lane", "not_a_need", "other"] as const;
export type ReasonCode = (typeof REASON_CODES)[number];
export type Label = "yes" | "maybe" | "no";

/** Known false positives from the Phase 0 review, by row number in docs/phase0-candidates.xlsx. */
export const KNOWN_FP: Record<string, string> = {
  "46238354": "#1",
  "45823234": "#3",
  "49078318": "#5",
  "46508942": "#6",
  "47139307": "#8",
  "46197005": "#9",
};

export interface EvalItem {
  id: string;
  url: string;
  title: string;
  body: string;
  publishedAt: string;
  comments: number;
  phrases: string[];
  label: Label | null;
  reason: ReasonCode | null;
}

export interface EvalFixture {
  createdAt: string;
  selection: string;
  items: EvalItem[];
}

export async function readFixture(path = FIXTURE): Promise<EvalFixture> {
  return JSON.parse(await readFile(path, "utf8")) as EvalFixture;
}

/** Merge Peter's labels (local only) into the posts-only fixture. */
export function withLabels(
  fixture: EvalFixture,
  labels: Map<string, { label: Label; reason: ReasonCode | null }>,
): EvalFixture {
  return {
    ...fixture,
    items: fixture.items.map((it) => ({ ...it, label: labels.get(it.id)?.label ?? null, reason: labels.get(it.id)?.reason ?? null })),
  };
}

const LABEL_COL = 6;
const REASON_COL = 7;
const FIRST_ROW = 3;

/** Read Peter's labels by HN id. Invalid values are reported, never guessed. */
export async function readLabels(
  path = LABELS_XLSX,
): Promise<{ labels: Map<string, { label: Label; reason: ReasonCode | null }>; problems: string[] }> {
  const labels = new Map<string, { label: Label; reason: ReasonCode | null }>();
  const problems: string[] = [];
  try {
    await access(path);
  } catch {
    return { labels, problems };
  }
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(path);
  const ws = wb.getWorksheet("Labels");
  if (!ws) return { labels, problems: [`${path} has no "Labels" sheet`] };
  for (let r = FIRST_ROW; r <= ws.rowCount; r++) {
    const id = String(ws.getCell(r, 2).value ?? "").trim();
    const label = String(ws.getCell(r, LABEL_COL).value ?? "").trim().toLowerCase();
    const reason = String(ws.getCell(r, REASON_COL).value ?? "").trim().toLowerCase();
    if (!id || !label) continue;
    if (label !== "yes" && label !== "maybe" && label !== "no") {
      problems.push(`row ${r}: label "${label}" is not yes/maybe/no`);
      continue;
    }
    if (reason && !(REASON_CODES as readonly string[]).includes(reason)) {
      problems.push(`row ${r}: reason "${reason}" is not one of ${REASON_CODES.join(", ")}`);
      continue;
    }
    if (label === "no" && !reason) problems.push(`row ${r}: "no" without a reason code (kept, reason blank)`);
    labels.set(id, { label, reason: (reason || null) as ReasonCode | null });
  }
  return { labels, problems };
}

export async function writeLabelWorkbook(path: string, items: EvalItem[]): Promise<void> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Labels", { views: [{ state: "frozen", ySplit: FIRST_ROW - 1 }] });
  ws.getCell("A1").value =
    "Label each post: yes / maybe / no. For every \"no\", pick a reason code. Notes stay on this machine and are never sent to any API.";
  ws.getCell("A1").font = { name: "Arial", italic: true, size: 10 };
  ws.mergeCells("A1:H1");
  ws.getRow(2).values = ["#", "HN id", "Link", "Title", "Start of post", "Label", "Reason code", "Notes"];
  ws.getRow(2).eachCell((c) => {
    c.font = { name: "Arial", bold: true, color: { argb: "FFFFFFFF" } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F3864" } };
  });
  const input: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDDEBF7" } };
  items.forEach((it, i) => {
    const r = FIRST_ROW + i;
    ws.getRow(r).values = [i + 1, it.id, { text: "open", hyperlink: it.url }, it.title, it.body.slice(0, 300), it.label, it.reason, null];
    ws.getRow(r).eachCell({ includeEmpty: true }, (c) => {
      c.font = { name: "Arial", size: 10 };
      c.alignment = { vertical: "top", wrapText: true };
    });
    for (const n of [LABEL_COL, REASON_COL, 8]) ws.getCell(r, n).fill = input;
    ws.getCell(r, LABEL_COL).dataValidation = { type: "list", formulae: ['"yes,maybe,no"'], allowBlank: true };
    ws.getCell(r, REASON_COL).dataValidation = { type: "list", formulae: [`"${REASON_CODES.join(",")}"`], allowBlank: true };
  });
  [5, 10, 7, 45, 70, 9, 14, 30].forEach((w, i) => (ws.getColumn(i + 1).width = w));
  await wb.xlsx.writeFile(path);
}
