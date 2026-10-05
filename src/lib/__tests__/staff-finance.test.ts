import { describe, expect, it } from "vitest";
import {
  hasStaffCompensation,
  staffObligationMonths,
  staffPeriodKeys,
} from "../staff-finance";

const NOW = new Date("2026-09-15T12:00:00Z");

function comp(over: Partial<Parameters<typeof hasStaffCompensation>[0]> = {}) {
  return {
    valid_from: "2026-01-01",
    valid_until: null,
    monthly_amount: 50_000,
    currency: "RSD",
    ...over,
  };
}

describe("hasStaffCompensation", () => {
  it("is true only for a positive monthly amount with a start date", () => {
    expect(hasStaffCompensation(comp())).toBe(true);
  });

  it("is false for 'Bez naknade' (NULL amount) — no financial obligation", () => {
    expect(hasStaffCompensation(comp({ monthly_amount: null }))).toBe(false);
  });

  it("is false for a zero amount", () => {
    expect(hasStaffCompensation(comp({ monthly_amount: 0 }))).toBe(false);
  });

  it("is false when no start date is set (the month cannot be scoped)", () => {
    expect(hasStaffCompensation(comp({ valid_from: null }))).toBe(false);
  });
});

describe("staffObligationMonths", () => {
  it("covers every month from valid_from to valid_until inclusive", () => {
    const months = staffObligationMonths(
      comp({ valid_from: "2026-01-15", valid_until: "2026-04-20" }),
      NOW
    );
    expect(months).toEqual([
      { year: 2026, month: 1 },
      { year: 2026, month: 2 },
      { year: 2026, month: 3 },
      { year: 2026, month: 4 },
    ]);
  });

  it("does not shift a 1st-of-month start into the previous month (UTC math)", () => {
    const months = staffObligationMonths(
      comp({ valid_from: "2026-03-01" }),
      NOW
    );
    expect(months[0]).toEqual({ year: 2026, month: 3 });
  });

  it("caps an open-ended engagement at the current month + 11", () => {
    const months = staffObligationMonths(comp({ valid_from: "2026-01-01" }), NOW);
    // Jan 2026 .. Aug 2027: now is Sep 2026, horizon = Sep + 11 months = Aug 2027.
    expect(months).toHaveLength(20);
    expect(months[0]).toEqual({ year: 2026, month: 1 });
    expect(months.at(-1)).toEqual({ year: 2027, month: 8 });
  });

  it("returns nothing for a 'Bez naknade' compensation", () => {
    expect(
      staffObligationMonths(comp({ monthly_amount: null }), NOW)
    ).toEqual([]);
  });

  it("returns nothing when valid_until precedes valid_from (no negative range)", () => {
    expect(
      staffObligationMonths(
        comp({ valid_from: "2026-05-01", valid_until: "2026-01-01" }),
        NOW
      )
    ).toHaveLength(0);
  });
});

describe("staffPeriodKeys", () => {
  it("produces zero-padded 'YYYY-MM' keys", () => {
    expect(
      staffPeriodKeys(
        comp({ valid_from: "2026-01-01", valid_until: "2026-01-31" }),
        NOW
      )
    ).toEqual(["2026-01"]);
  });

  it("emits one key per month across a window", () => {
    expect(
      staffPeriodKeys(
        comp({ valid_from: "2025-11-01", valid_until: "2026-02-28" }),
        NOW
      )
    ).toEqual(["2025-11", "2025-12", "2026-01", "2026-02"]);
  });
});