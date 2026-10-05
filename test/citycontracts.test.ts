import { describe, expect, it } from "vitest";
import { htmlText, parseChicago, parseNyc, preFilter, toCandidate, type CityContract } from "../src/scout/citycontracts.js";

const row = (over: Partial<CityContract>): CityContract => ({
  city: "Chicago", department: "DEPARTMENT OF FINANCE", category: "SOFTWARE",
  description: "Software for parking ticket billing and payment plan tracking", amount: 120000,
  date: "2026-09-01", url: "https://example.org", key: "chicago:1", ...over,
});

describe("city contract parsing", () => {
  it("maps Chicago rows and never reads vendor fields", () => {
    const [c] = parseChicago([{
      purchase_order_description: "Records digitization services for building permits",
      purchase_order_contract_number: "123", contract_type: "PRO SERV CONSULTING UNDER $250,000",
      approval_date: "2026-09-30T00:00:00.000", department: "DEPT OF BUILDINGS", award_amount: "90000",
      contract_pdf: { url: "https://example.org/c.pdf" },
    }]);
    expect(c).toMatchObject({ city: "Chicago", amount: 90000, date: "2026-09-30", url: "https://example.org/c.pdf", key: "chicago:123" });
  });

  it("maps NYC rows, strips HTML, and merges short title with description", () => {
    const [c] = parseNyc([{
      request_id: "2026091001", start_date: "2026-09-10T00:00:00.000", agency_name: "Housing Preservation",
      short_title: "Inspection scheduling system", additional_description_1: "<p>Vendor will provide&nbsp;scheduling for inspectors.</p>",
      category_description: "Services (other than human services)", contract_amount: "500000",
    }]);
    expect(c!.description).toBe("Inspection scheduling system. Vendor will provide scheduling for inspectors.");
    expect(c!.url).toBe("https://a856-cityrecord.nyc.gov/RequestDetail/2026091001");
    expect(htmlText("a&amp;b <b>c</b>")).toBe("a&b c");
  });
});

describe("preFilter", () => {
  it("keeps one row per contract, newest first, and drops short descriptions", () => {
    const out = preFilter([
      row({ key: "chicago:1", date: "2026-08-01" }),
      row({ key: "chicago:1", date: "2026-09-01" }),
      row({ key: "chicago:2", description: "DEMOLITION" }),
      row({ key: "chicago:3", date: "2026-09-15" }),
    ]);
    expect(out.map((r) => [r.key, r.date])).toEqual([["chicago:3", "2026-09-15"], ["chicago:1", "2026-09-01"]]);
  });

  it("drops police, courts and corrections (out of scope)", () => {
    const out = preFilter([row({ key: "a", department: "Police Department" }), row({ key: "b", department: "NYPD" }), row({ key: "c" })]);
    expect(out.map((r) => r.key)).toEqual(["c"]);
  });

  it("builds a candidate with city context and amount in the body", () => {
    const c = toCandidate(row({}));
    expect(c.title).toMatch(/^\[Chicago · DEPARTMENT OF FINANCE\] Software for parking/);
    expect(c.body).toContain("Amount: $120,000");
    expect(c.scores.freeData.value).toBe(3);
  });
});
