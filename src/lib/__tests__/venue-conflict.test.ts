import { describe, expect, it } from "vitest";
import { findConflicts, overlaps } from "@/lib/venue-conflict";

function at(iso: string): Date {
  return new Date(iso);
}

describe("overlaps", () => {
  it("detects a real overlap", () => {
    expect(
      overlaps(at("2026-09-01T18:00:00Z"), at("2026-09-01T19:30:00Z"), at("2026-09-01T19:00:00Z"), at("2026-09-01T20:00:00Z"))
    ).toBe(true);
  });

  it("treats a touching boundary as no conflict (half-open)", () => {
    expect(
      overlaps(at("2026-09-01T18:00:00Z"), at("2026-09-01T19:00:00Z"), at("2026-09-01T19:00:00Z"), at("2026-09-01T20:00:00Z"))
    ).toBe(false);
  });

  it("treats an exact overlap as a conflict", () => {
    expect(
      overlaps(at("2026-09-01T18:00:00Z"), at("2026-09-01T19:00:00Z"), at("2026-09-01T18:00:00Z"), at("2026-09-01T19:00:00Z"))
    ).toBe(true);
  });

  it("treats fully disjoint intervals as no conflict", () => {
    expect(
      overlaps(at("2026-09-01T18:00:00Z"), at("2026-09-01T19:00:00Z"), at("2026-09-01T20:00:00Z"), at("2026-09-01T21:00:00Z"))
    ).toBe(false);
  });
});

describe("findConflicts", () => {
  it("returns only the items that overlap the candidate", () => {
    const items = [
      { id: "a", startsAt: at("2026-09-01T10:00:00Z"), endsAt: at("2026-09-01T11:00:00Z") },
      { id: "b", startsAt: at("2026-09-01T18:00:00Z"), endsAt: at("2026-09-01T19:00:00Z") },
    ];
    const conflicts = findConflicts(items, {
      startsAt: at("2026-09-01T18:30:00Z"),
      endsAt: at("2026-09-01T20:00:00Z"),
    });
    expect(conflicts.map((item) => item.id)).toEqual(["b"]);
  });
});
