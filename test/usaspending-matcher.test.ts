// Step 5 (report only): is "0 vendor names with multiple spellings" a matcher bug?
// These tests pin the matcher's behavior on known variants; scoring is unchanged.
import { describe, expect, it } from "vitest";
import { countNameVariants, normalizeOrgName } from "../src/scout/score.js";

describe("USAspending vendor-name matcher", () => {
  it("normalizes the three ACME spellings to one key", () => {
    expect(normalizeOrgName("ACME INC")).toBe("acme");
    expect(normalizeOrgName("ACME, INC.")).toBe("acme");
    expect(normalizeOrgName("Acme Incorporated")).toBe("acme");
  });

  it("counts them as one vendor with multiple spellings", () => {
    expect(countNameVariants(["ACME INC", "ACME, INC.", "Acme Incorporated"])).toBe(1);
  });

  it("counts identical spellings as zero variants", () => {
    expect(countNameVariants(["ACME INC", "ACME INC", "ACME INC"])).toBe(0);
  });

  it("separates different vendors and handles & / LLC / Corp", () => {
    expect(countNameVariants(["Smith & Jones LLC", "SMITH AND JONES, L.L.C.", "Booz Allen Hamilton Inc", "BOOZ ALLEN HAMILTON INC."])).toBe(2);
  });
});
