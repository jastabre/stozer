import { describe, expect, it } from "vitest";
import { isValidSeasonRange, SEASON_RANGE_ERROR } from "@/lib/season";

describe("isValidSeasonRange", () => {
  it("accepts a normal football season range", () => {
    expect(isValidSeasonRange("2026-07-01", "2027-06-30")).toBe(true);
  });

  it("rejects an end on or before the start", () => {
    expect(isValidSeasonRange("2026-07-01", "2026-07-01")).toBe(false);
    expect(isValidSeasonRange("2027-06-30", "2026-07-01")).toBe(false);
  });

  it("rejects missing dates", () => {
    expect(isValidSeasonRange("", "2027-06-30")).toBe(false);
    expect(isValidSeasonRange("2026-07-01", "")).toBe(false);
    expect(isValidSeasonRange(null, null)).toBe(false);
    expect(isValidSeasonRange(undefined, "2027-06-30")).toBe(false);
  });

  it("exposes the user-facing range message", () => {
    expect(SEASON_RANGE_ERROR).toContain("Kraj sezone");
  });
});
