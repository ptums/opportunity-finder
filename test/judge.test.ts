import { describe, expect, it } from "vitest";
import { parseJudgment, PROMPT_VERSION } from "../src/scout/judge.js";
import { applyJudgment, scoreText } from "../src/scout/score.js";

const valid = {
  is_problem: true,
  problem: "Bookkeepers reconcile bank exports by hand",
  pain: 3, pain_why: '"5 hours a week"',
  messy: 3, messy_why: "bank CSV vs QuickBooks",
  backend: 2, backend_why: "matching transactions",
  reachable: 2, reachable_why: "bookkeeper communities",
};

describe("parseJudgment", () => {
  it("accepts a valid judgment and tags model + prompt version", () => {
    const j = parseJudgment(valid, "qwen3:8b");
    expect(j?.pain).toBe(3);
    expect(j?.model).toBe("qwen3:8b");
    expect(j?.promptVersion).toBe(PROMPT_VERSION);
  });

  it("rejects out-of-range scores, missing fields, and non-objects", () => {
    expect(parseJudgment({ ...valid, pain: 4 }, "m")).toBeNull();
    expect(parseJudgment({ ...valid, reachable: "2" }, "m")).toBeNull();
    expect(parseJudgment({ ...valid, problem: "  " }, "m")).toBeNull();
    expect(parseJudgment({ ...valid, is_problem: false, problem: "" }, "m")?.isProblem).toBe(false);
    const { is_problem: _, ...noFlag } = valid;
    expect(parseJudgment(noFlag, "m")).toBeNull();
    expect(parseJudgment("nope", "m")).toBeNull();
  });
});

describe("applyJudgment", () => {
  it("replaces judgment criteria and keeps frequency and free data as rules", () => {
    const rules = scoreText("I spend 5 hours a week", 60, 1);
    const merged = applyJudgment(rules, parseJudgment({ ...valid, pain: 1 }, "qwen3:8b")!);
    expect(merged.pain).toMatchObject({ value: 1, model: { name: "qwen3:8b" } });
    expect(merged.reachable.model?.promptVersion).toBe(PROMPT_VERSION);
    expect(merged.frequency).toEqual(rules.frequency);
    expect(merged.freeData).toEqual(rules.freeData);
    expect(merged.frequency.model).toBeUndefined();
  });
});
