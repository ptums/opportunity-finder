// Pure metrics for the judge comparison (ADR-003). No I/O so they can be unit tested.
import { KNOWN_FP, type Label, REASON_CODES, type ReasonCode } from "./eval-set.js";

export interface ItemOutcome {
  id: string;
  label: Label | null;
  reason: ReasonCode | null;
  /** null when the judge produced nothing for this item (no cache, failure). */
  shortlisted: boolean | null;
  quotesValid: number;
  quotesTotal: number;
  reasons: string[];
}

export interface JudgeReport {
  items: number;
  judged: number;
  labeled: number;
  agreement: number | null;
  /** Of shortlisted labeled items, share Peter labeled yes/maybe. */
  precision: number | null;
  /** Of items Peter labeled yes/maybe, share the judge shortlisted. */
  recall: number | null;
  fpRateByReason: Record<string, { rate: number | null; n: number }>;
  evidenceValidity: number | null;
  rubricEcho: number | null;
  shortlisted: number;
  knownFpShortlisted: string[];
}

const ratio = (num: number, den: number): number | null => (den === 0 ? null : num / den);

export function report(outcomes: ItemOutcome[], echoes: (reason: string) => boolean): JudgeReport {
  const judged = outcomes.filter((o) => o.shortlisted !== null);
  const labeled = judged.filter((o) => o.label);
  const positive = (o: ItemOutcome) => o.label === "yes" || o.label === "maybe";
  const agree = labeled.filter((o) => o.shortlisted === positive(o)).length;
  const tp = labeled.filter((o) => o.shortlisted && positive(o)).length;

  const fpRateByReason: JudgeReport["fpRateByReason"] = {};
  for (const code of [...REASON_CODES, null]) {
    const group = labeled.filter((o) => o.label === "no" && o.reason === code);
    fpRateByReason[code ?? "uncoded"] = { rate: ratio(group.filter((o) => o.shortlisted).length, group.length), n: group.length };
  }

  const quotesTotal = judged.reduce((s, o) => s + o.quotesTotal, 0);
  const reasons = judged.flatMap((o) => o.reasons);
  return {
    items: outcomes.length,
    judged: judged.length,
    labeled: labeled.length,
    agreement: ratio(agree, labeled.length),
    precision: ratio(tp, labeled.filter((o) => o.shortlisted).length),
    recall: ratio(tp, labeled.filter(positive).length),
    fpRateByReason,
    evidenceValidity: ratio(judged.reduce((s, o) => s + o.quotesValid, 0), quotesTotal),
    rubricEcho: ratio(reasons.filter(echoes).length, reasons.length),
    shortlisted: judged.filter((o) => o.shortlisted).length,
    knownFpShortlisted: judged.filter((o) => o.shortlisted && KNOWN_FP[o.id]).map((o) => KNOWN_FP[o.id]!),
  };
}

export const pct = (x: number | null): string => (x === null ? "n/a" : `${Math.round(x * 100)}%`);
