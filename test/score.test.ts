import { describe, expect, it } from "vitest";
import { htmlToText, isLaunchPost } from "../src/scout/hn.js";
import { countNameVariants, normalizeOrgName, scoreText, total } from "../src/scout/score.js";
import { scoreTheme } from "../src/scout/usaspending.js";

describe("scoreText", () => {
  it("gives pain 3 for stated hours", () => {
    const s = scoreText("I spend 5 hours a week reconciling spreadsheets", 0, 1);
    expect(s.pain.value).toBe(3);
    expect(s.pain.reason).toContain("5 hours a week");
  });

  it("gives pain 3 for stated dollars", () => {
    expect(scoreText("we pay $2,000 per month for this", 0, 1).pain.value).toBe(3);
  });

  it("gives pain 2 for a pain word without a cost", () => {
    expect(scoreText("this is so tedious", 0, 1).pain.value).toBe(2);
  });

  it("gives pain 1 with no signal", () => {
    expect(scoreText("what is your favorite editor", 0, 1).pain.value).toBe(1);
  });

  it("counts distinct messy-data words", () => {
    expect(scoreText("CSV export, then reconcile duplicates", 0, 1).messy.value).toBe(3);
    expect(scoreText("an excel file", 0, 1).messy.value).toBe(2);
    expect(scoreText("nothing here", 0, 1).messy.value).toBe(1);
  });

  it("scores frequency from comments or phrase matches", () => {
    expect(scoreText("x", 60, 1).frequency.value).toBe(3);
    expect(scoreText("x", 0, 3).frequency.value).toBe(3);
    expect(scoreText("x", 12, 1).frequency.value).toBe(2);
    expect(scoreText("x", 0, 1).frequency.value).toBe(1);
  });

  it("totals within 6-18", () => {
    const t = total(scoreText("anything", 0, 1));
    expect(t).toBeGreaterThanOrEqual(6);
    expect(t).toBeLessThanOrEqual(18);
  });
});

describe("normalizeOrgName / countNameVariants", () => {
  it("strips punctuation and legal suffixes", () => {
    expect(normalizeOrgName("ACME, INC.")).toBe("acme");
    expect(normalizeOrgName("Acme Corporation")).toBe("acme");
    expect(normalizeOrgName("Smith & Jones LLC")).toBe("smith and jones");
  });

  it("counts names with more than one spelling", () => {
    expect(countNameVariants(["ACME, INC.", "Acme Inc", "ACME, INC.", "Other LLC", ""])).toBe(1);
    expect(countNameVariants(["A", "B"])).toBe(0);
  });
});

describe("scoreTheme", () => {
  it("tiers agencies, spend, and variants", () => {
    const s = scoreTheme(300, 12, 25e6, 4);
    expect([s.frequency.value, s.pain.value, s.messy.value]).toEqual([3, 3, 3]);
    const low = scoreTheme(5, 1, 50e3, 0);
    expect([low.frequency.value, low.pain.value, low.messy.value]).toEqual([1, 1, 1]);
  });
});

describe("htmlToText", () => {
  it("decodes HN-escaped HTML", () => {
    expect(htmlToText("I&#x27;m <i>so</i> tired<p>of CSV &amp; Excel")).toBe("I'm so tired of CSV & Excel");
  });
});

describe("isLaunchPost", () => {
  it("flags launches and keeps questions", () => {
    expect(isLaunchPost("I built an API to stop manual data entry")).toBe(true);
    expect(isLaunchPost("XC Scribe – AI product description generator")).toBe(true);
    expect(isLaunchPost("Show HN: my app")).toBe(true);
    expect(isLaunchPost("Ask HN: How do you manage invoices?")).toBe(false);
    expect(isLaunchPost("Does \"Zapier for payment automation\" exist?")).toBe(false);
  });
});
