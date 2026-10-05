import { describe, expect, it } from "vitest";
import { parseFeed, preFilter } from "../src/scout/appstore.js";

const long = "We still schedule every technician by hand because the app cannot assign jobs by skill or travel time and our office manager spends hours on it each week.";
const entry = (rating: number, updated: string, content = long) => ({
  id: { label: `r${rating}${updated}` }, title: { label: "Scheduling is manual" }, content: { label: content },
  updated: { label: updated }, "im:rating": { label: String(rating) }, "im:version": { label: "1.0" },
  "im:voteSum": { label: "3" }, author: { name: { label: "Someone" }, uri: { label: "https://example.org/u" } },
});

describe("parseFeed", () => {
  it("reads reviews and never copies the author", () => {
    const [r] = parseFeed({ feed: { entry: [entry(2, "2026-09-01T00:00:00-07:00")] } }, 1);
    expect(r).toMatchObject({ rating: 2, votes: 3, publishedAt: "2026-09-01" });
    expect(JSON.stringify(r)).not.toContain("Someone");
  });
  it("handles a single entry and an empty feed", () => {
    expect(parseFeed({ feed: { entry: entry(1, "2026-09-01") } }, 1)).toHaveLength(1);
    expect(parseFeed({ feed: {} }, 1)).toEqual([]);
  });
});

describe("preFilter", () => {
  const now = Date.parse("2026-10-05T00:00:00Z");
  it("keeps recent low-rated reviews with enough words", () => {
    const reviews = parseFeed({ feed: { entry: [
      entry(2, "2026-09-01"), entry(5, "2026-09-02"), entry(1, "2024-01-01"), entry(3, "2026-09-03", "too short to quote"),
    ] } }, 1);
    expect(preFilter(reviews, now).map((r) => r.rating)).toEqual([2]);
  });
});
