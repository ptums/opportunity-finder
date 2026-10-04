import { describe, expect, it } from "vitest";
import { applyJudgmentV2, evaluateV2, judgeJsonSchema, JudgmentV2Schema, type RawJudgmentV2 } from "../src/scout/judge-v2.js";
import { scoreText, total } from "../src/scout/score.js";

const TITLE = "How do you reconcile Stripe payouts?";
const BODY =
  "Every month I spend about 6 hours matching Stripe payouts to our bank CSV in Excel. Our agency has 40 clients and our bookkeeper bills us for the time. Is there a tool for this?";

const q = "I spend about 6 hours matching Stripe payouts";
const good: RawJudgmentV2 = {
  g1_current_problem: { pass: true, quote: q },
  g2_need: { pass: true, quote: "Is there a tool for this" },
  g3_not_trivial: { pass: true, quote: "matching Stripe payouts to our bank CSV", tool: "" },
  g4_author_has_problem: { pass: true, quote: "Every month I spend about 6 hours" },
  problem: "Agency bookkeepers match Stripe payouts to bank exports by hand",
  pain: { score: 3, quote: q, why: "six hours monthly" },
  messy: { score: 3, quote: "to our bank CSV in Excel", why: "two systems" },
  backend: { score: 2, quote: "matching Stripe payouts to our bank CSV", why: "matching" },
  reachable: { score: 2, quote: "Our agency has 40 clients", why: "agency owners" },
  buyer: { score: 3, quote: "our bookkeeper bills us for the time", why: "already paying" },
};

describe("JudgmentV2Schema", () => {
  it("accepts a complete judgment", () => {
    expect(JudgmentV2Schema.safeParse(good).success).toBe(true);
  });
  it("rejects out-of-range scores and missing fields", () => {
    expect(JudgmentV2Schema.safeParse({ ...good, buyer: { ...good.buyer, score: 4 } }).success).toBe(false);
    const { g4_author_has_problem: _, ...noG4 } = good;
    expect(JudgmentV2Schema.safeParse(noG4).success).toBe(false);
  });
});

describe("judgeJsonSchema", () => {
  it("sends scores as a hard enum and closes every object", () => {
    const schema = judgeJsonSchema() as any;
    expect(schema.properties.buyer.properties.score).toEqual({ type: "integer", enum: [1, 2, 3] });
    expect(schema.additionalProperties).toBe(false);
    expect(schema.properties.g3_not_trivial.additionalProperties).toBe(false);
    expect(JSON.stringify(schema)).not.toMatch(/minimum|maximum|\$schema/);
  });
});

describe("evaluateV2", () => {
  it("passes an item whose gates and scores all cite the post", () => {
    const ev = evaluateV2(good, TITLE, BODY, "m");
    expect(ev.status).toBe("passed");
    expect(ev.quotesValid).toBe(9);
    expect(ev.criteria.pain.unsupported).toBeUndefined();
  });

  it("gates out a failed gate that has a valid quote", () => {
    const ev = evaluateV2({ ...good, g4_author_has_problem: { pass: false, quote: q } }, TITLE, BODY, "m");
    expect(ev.status).toBe("gated_out");
    expect(ev.gates.g4_author_has_problem.status).toBe("fail");
  });

  it("requires G3 to name the tool when it fails", () => {
    const noTool = evaluateV2({ ...good, g3_not_trivial: { pass: false, quote: q, tool: " " } }, TITLE, BODY, "m");
    expect(noTool.gates.g3_not_trivial.status).toBe("unsupported");
    expect(noTool.status).toBe("needs_review");
    const none = evaluateV2({ ...good, g3_not_trivial: { pass: false, quote: q, tool: "none named" } }, TITLE, BODY, "m");
    expect(none.gates.g3_not_trivial.status).toBe("unsupported");
    const named = evaluateV2({ ...good, g3_not_trivial: { pass: false, quote: q, tool: "QuickBooks bank feeds" } }, TITLE, BODY, "m");
    expect(named.gates.g3_not_trivial).toMatchObject({ status: "fail", note: "QuickBooks bank feeds" });
  });

  it("marks a score with an invented quote unsupported and leaves it out of the total", () => {
    const ev = evaluateV2({ ...good, buyer: { score: 3, quote: "the CFO approved a budget of $50k", why: "x" } }, TITLE, BODY, "m");
    expect(ev.status).toBe("needs_review");
    expect(ev.criteria.buyer.unsupported).toBe(true);
    const rules = scoreText(`${TITLE} ${BODY}`, 300, 1);
    const scores = applyJudgmentV2(rules, ev, 300);
    // Pain 3 + Messy 3 + Backend 2 + Reach 2 + Buyer (unsupported, 0) + Free data (rule)
    expect(total(scores)).toBe(10 + rules.freeData.value);
  });

  it("keeps comment count out of the v2 total", () => {
    const ev = evaluateV2(good, TITLE, BODY, "m");
    const few = total(applyJudgmentV2(scoreText(BODY, 0, 1), ev, 0));
    const many = total(applyJudgmentV2(scoreText(BODY, 309, 1), ev, 309));
    expect(many).toBe(few);
    expect(applyJudgmentV2(scoreText(BODY, 309, 1), ev, 309).frequency.reason).toContain("popularity only");
  });
});
