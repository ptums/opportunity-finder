import { describe, expect, it } from "vitest";
import { checkQuote, normalizeForMatch, rubricEchoChecker } from "../src/scout/evidence.js";
import { PROMPT_V2 } from "../src/scout/judge-v2.js";

const POST =
  "Title: How do you reconcile Stripe payouts?\n\nPost: Every month I spend   about 6 hours matching “Stripe payouts” to our bank CSV in Excel. Our bookkeeper hates it.";

describe("checkQuote", () => {
  it("accepts an exact quote", () => {
    expect(checkQuote("I spend about 6 hours matching", POST).valid).toBe(true);
  });

  it("ignores case, whitespace runs, quote characters, and edge punctuation", () => {
    expect(checkQuote('  every MONTH i spend about 6 hours  ', POST).valid).toBe(true);
    expect(checkQuote('matching "Stripe payouts" to our bank CSV', POST).valid).toBe(true);
    expect(checkQuote("Our bookkeeper hates it.", POST).valid).toBe(true);
  });

  it("ignores punctuation such as list bullets and dashes", () => {
    const list = "Post: Stripe Connect: Only splits to one account - Zapier: Can't actually move money. 50% to co-founder • 10% across 3 contractors";
    expect(checkQuote("Stripe Connect: Only splits to one account. Zapier: Can't actually move money", list).valid).toBe(true);
    expect(checkQuote("50% to co-founder, 10% across 3 contractors", list).valid).toBe(true);
  });

  it("rejects an invented quote", () => {
    expect(checkQuote("we lose $10,000 a year to reconciliation errors", POST)).toEqual({ valid: false, why: "not in post" });
  });

  it("rejects a paraphrased quote", () => {
    expect(checkQuote("I spend roughly 6 hours matching", POST)).toEqual({ valid: false, why: "not in post" });
    expect(checkQuote("matching Stripe payouts to the bank CSV", POST)).toEqual({ valid: false, why: "not in post" });
  });

  it("rejects a quote copied from the rubric instead of the post", () => {
    const fromRubric = "needs ongoing data collection, matching, and storage";
    expect(PROMPT_V2).toContain(fromRubric);
    expect(checkQuote(fromRubric, POST)).toEqual({ valid: false, why: "not in post" });
  });

  it("enforces 4 to 25 words", () => {
    expect(checkQuote("bookkeeper hates it", POST)).toEqual({ valid: false, why: "too short" });
    expect(checkQuote("", POST)).toEqual({ valid: false, why: "empty" });
    expect(checkQuote(Array(26).fill("word").join(" "), POST)).toEqual({ valid: false, why: "too long" });
  });
});

describe("normalizeForMatch", () => {
  it("strips quotes and punctuation but keeps $ and %", () => {
    expect(normalizeForMatch(`“A” ‘b’ "c" 'd' \`e\` • $15K - 30%.`)).toBe("a b c d e $15k 30%");
  });
});

describe("rubricEchoChecker", () => {
  const echoes = rubricEchoChecker(PROMPT_V2);
  it("flags reasons that repeat 5+ words of the rubric", () => {
    expect(echoes("Needs ongoing data collection, matching, and storage.")).toBe(true);
  });
  it("passes reasons written about the post", () => {
    expect(echoes("Bookkeeper spends six hours monthly matching payouts by hand")).toBe(false);
  });
});
