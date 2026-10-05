import { describe, it, expect } from "vitest";
import {
  obligationMonthsFor,
  obligationState,
  monthStatusFor,
  seasonMonthPlayersLabel,
  obligationBreakdownLabel,
  parsePeriod,
  periodKey,
  normalizeCustomMonths,
  planObligationReconciliation,
  sumPayments,
  sumActivePayments,
  isPaymentReversed,
  adjustmentTotals,
  adjustedExpectedAmount,
  isAdjustmentReversed,
  validateAdjustmentAmount,
  validatePaymentAmount,
  formatAmount,
  formatNumber,
} from "../first-team";
import type {
  ContractFinance,
  MonthObligationSummary,
  SeasonFinance,
  SeasonMonthPlayerLabels,
} from "../first-team";

const contract = (
  over: Partial<ContractFinance> = {}
): ContractFinance => ({
  valid_from: "2026-08-15",
  valid_until: "2027-06-30",
  monthly_salary: 1000,
  currency: "RSD",
  pay_schedule: "all_year",
  custom_months: null,
  ...over,
});

describe("obligationMonthsFor", () => {
  it("all_year yields every month inside the contract window", () => {
    const months = obligationMonthsFor(contract(), { competition_months: null });
    expect(months).toEqual([
      { year: 2026, month: 8 },
      { year: 2026, month: 9 },
      { year: 2026, month: 10 },
      { year: 2026, month: 11 },
      { year: 2026, month: 12 },
      { year: 2027, month: 1 },
      { year: 2027, month: 2 },
      { year: 2027, month: 3 },
      { year: 2027, month: 4 },
      { year: 2027, month: 5 },
      { year: 2027, month: 6 },
    ]);
  });

  it("competition_months only includes months in the season set", () => {
    const season: SeasonFinance = {
      competition_months: [8, 9, 10, 11, 3, 4, 5],
    };
    const months = obligationMonthsFor(
      contract({ pay_schedule: "competition_months" }),
      season
    );
    expect(months).toEqual([
      { year: 2026, month: 8 },
      { year: 2026, month: 9 },
      { year: 2026, month: 10 },
      { year: 2026, month: 11 },
      { year: 2027, month: 3 },
      { year: 2027, month: 4 },
      { year: 2027, month: 5 },
    ]);
  });

  it("competition_months with unset season months yields none", () => {
    const months = obligationMonthsFor(
      contract({ pay_schedule: "competition_months" }),
      { competition_months: null }
    );
    expect(months).toEqual([]);
  });

  it("custom_months only includes the contract's own months", () => {
    const months = obligationMonthsFor(
      contract({ pay_schedule: "custom_months", custom_months: [9, 12, 3] }),
      { competition_months: null }
    );
    expect(months).toEqual([
      { year: 2026, month: 9 },
      { year: 2026, month: 12 },
      { year: 2027, month: 3 },
    ]);
  });

  it("no start date -> no obligations", () => {
    const months = obligationMonthsFor(
      contract({ valid_from: null }),
      { competition_months: null }
    );
    expect(months).toEqual([]);
  });
});

describe("obligationState", () => {
  const now = new Date("2026-10-01T00:00:00Z");

  it("paid when paid >= expected", () => {
    expect(obligationState("2026-09", 1000, 1000, now).status).toBe("paid");
    expect(obligationState("2026-09", 1000, 1200, now).status).toBe("paid");
  });

  it("partial when 0 < paid < expected", () => {
    const s = obligationState("2026-09", 1000, 600, now);
    expect(s.status).toBe("partial");
    expect(s.remaining).toBe(400);
  });

  it("due when nothing paid and period not overdue", () => {
    expect(obligationState("2026-10", 1000, 0, now).status).toBe("due");
  });

  it("late when nothing paid and period is past", () => {
    expect(obligationState("2026-08", 1000, 0, now).status).toBe("late");
  });

  it("remaining never negative", () => {
    expect(obligationState("2026-09", 1000, 1500, now).remaining).toBe(0);
  });
});

describe("statuses", () => {
  const now = new Date("2026-10-15T00:00:00Z");
  it("due when unpaid and not yet overdue", () => {
    expect(obligationState("2026-10", 1000, 0, now).status).toBe("due");
  });
  it("partial when partially paid", () => {
    expect(obligationState("2026-10", 1000, 400, now).status).toBe("partial");
  });
  it("late when unpaid and the month has passed", () => {
    expect(obligationState("2026-09", 1000, 0, now).status).toBe("late");
  });
  it("paid when fully paid", () => {
    expect(obligationState("2026-09", 1000, 1000, now).status).toBe("paid");
  });
  it("a future month is never late", () => {
    expect(obligationState("2026-12", 1000, 0, now).status).toBe("due");
  });
});

describe("monthStatusFor (season overview rollup)", () => {
  const NOW = new Date("2026-09-15T12:00:00Z");
  const base: MonthObligationSummary = {
    playerCount: 2,
    paidCount: 2,
    partialCount: 0,
    unpaidCount: 0,
    lateCount: 0,
    expected: 300000,
    paid: 300000,
    remaining: 0,
  };

  it("paid when every obligation of the month is settled", () => {
    expect(monthStatusFor(base, "2026-09", NOW)).toBe("paid");
    // Also for a month that has already passed.
    expect(monthStatusFor(base, "2026-08", NOW)).toBe("paid");
  });

  it("future when the obligation month has not started", () => {
    expect(
      monthStatusFor(
        { ...base, paidCount: 0, paid: 0, remaining: 300000 },
        "2026-10",
        NOW
      )
    ).toBe("future");
  });

  it("late when at least one obligation is overdue with nothing paid", () => {
    expect(
      monthStatusFor(
        {
          ...base,
          paidCount: 1,
          partialCount: 1,
          unpaidCount: 1,
          lateCount: 1,
          paid: 150000,
          remaining: 150000,
        },
        "2026-08",
        NOW
      )
    ).toBe("late");
  });

  it("partial when money was recorded but obligations remain open (not late)", () => {
    expect(
      monthStatusFor(
        { ...base, paidCount: 1, partialCount: 1, paid: 150000, remaining: 150000 },
        "2026-08",
        NOW
      )
    ).toBe("partial");
  });

  it("due when nothing was recorded and the month is not overdue", () => {
    expect(
      monthStatusFor(
        {
          ...base,
          paidCount: 0,
          partialCount: 0,
          unpaidCount: 2,
          paid: 0,
          remaining: 300000,
        },
        "2026-09",
        NOW
      )
    ).toBe("due");
  });
});

describe("seasonMonthPlayersLabel (overview Igrači cell wording)", () => {
  const playerLabels: SeasonMonthPlayerLabels = {
    playersCount: (count) => `${count} igrač(a)`,
    playersPaid: "plaćeno",
    playersPartial: (count) => `${count} delimično`,
    playersUnpaid: (count) => `${count} nije plaćen(o)`,
    allSettled: "Sve izmireno",
    futurePlayersNote: "Buduća obaveza",
  };

  it("a future month never reads as unpaid", () => {
    const label = seasonMonthPlayersLabel(
      {
        status: "future",
        playerCount: 1,
        paidCount: 0,
        partialCount: 0,
        unpaidCount: 1,
      },
      playerLabels
    );
    expect(label).toEqual({ main: "1 igrač(a)", note: "Buduća obaveza" });
    expect(`${label.main} ${label.note}`).not.toMatch(/nije plaćen|delimično/);
  });

  it("a due month reads as paid fraction + not paid", () => {
    expect(
      seasonMonthPlayersLabel(
        { status: "due", playerCount: 1, paidCount: 0, partialCount: 0, unpaidCount: 1 },
        playerLabels
      )
    ).toEqual({ main: "0/1 plaćeno", note: "1 nije plaćen(o)" });
  });

  it("a partial month reads as paid fraction + partial", () => {
    expect(
      seasonMonthPlayersLabel(
        { status: "partial", playerCount: 1, paidCount: 0, partialCount: 1, unpaidCount: 0 },
        playerLabels
      )
    ).toEqual({ main: "0/1 plaćeno", note: "1 delimično" });
  });

  it("a late month combines partial and not-paid players", () => {
    expect(
      seasonMonthPlayersLabel(
        { status: "late", playerCount: 4, paidCount: 2, partialCount: 1, unpaidCount: 1 },
        playerLabels
      )
    ).toEqual({ main: "2/4 plaćeno", note: "1 delimično · 1 nije plaćen(o)" });
  });

  it("a settled month reads as fully paid + all settled", () => {
    expect(
      seasonMonthPlayersLabel(
        { status: "paid", playerCount: 1, paidCount: 1, partialCount: 0, unpaidCount: 0 },
        playerLabels
      )
    ).toEqual({ main: "1/1 plaćeno", note: "Sve izmireno" });
  });
});

describe("obligationBreakdownLabel (why the month's obligation differs)", () => {
  const labels = { base: "Osnovna", bonus: "Bonus", deduction: "Odbitak" };

  it("returns null without active corrections", () => {
    expect(
      obligationBreakdownLabel(150000, { bonus: 0, deduction: 0 }, labels)
    ).toBeNull();
  });

  it("shows base + bonus by type", () => {
    expect(
      obligationBreakdownLabel(150000, { bonus: 20000, deduction: 0 }, labels)
    ).toBe("Osnovna 150.000 · Bonus +20.000");
  });

  it("shows base + deduction by type", () => {
    expect(
      obligationBreakdownLabel(150000, { bonus: 0, deduction: 15000 }, labels)
    ).toBe("Osnovna 150.000 · Odbitak \u221215.000");
  });

  it("shows both corrections in order", () => {
    expect(
      obligationBreakdownLabel(150000, { bonus: 20000, deduction: 15000 }, labels)
    ).toBe("Osnovna 150.000 · Bonus +20.000 · Odbitak \u221215.000");
  });
});

describe("validatePaymentAmount", () => {
  it("accepts a positive amount up to the remaining balance", () => {
    expect(validatePaymentAmount(1000, 1000)).toEqual({ ok: true });
    expect(validatePaymentAmount(400, 1000)).toEqual({ ok: true });
  });
  it("rejects zero/negative/non-integer", () => {
    expect(validatePaymentAmount(0, 1000).ok).toBe(false);
    expect(validatePaymentAmount(-5, 1000).ok).toBe(false);
    expect(validatePaymentAmount(10.5, 1000).ok).toBe(false);
  });
  it("rejects overpayment", () => {
    const result = validatePaymentAmount(1200, 1000);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("1000");
  });
});

describe("planObligationReconciliation", () => {
  const existing = (
    id: string,
    period: string,
    expected_amount: number,
    currency: string,
    paid: number
  ) => ({ id, period, expected_amount, currency, paid });

  it("inserts missing scheduled months", () => {
    const plan = planObligationReconciliation(
      ["2026-09", "2026-10"],
      [existing("o1", "2026-09", 1000, "RSD", 0)],
      1000,
      "RSD"
    );
    expect(plan.insert).toEqual([
      { period: "2026-10", expected: 1000, currency: "RSD" },
    ]);
    expect(plan.update).toHaveLength(0);
    expect(plan.remove).toHaveLength(0);
  });

  it("updates an UNPAID obligation when the salary changes", () => {
    const plan = planObligationReconciliation(
      ["2026-09"],
      [existing("o1", "2026-09", 1000, "RSD", 0)],
      1500,
      "RSD"
    );
    expect(plan.update).toEqual([{ id: "o1", expected: 1500, currency: "RSD" }]);
    expect(plan.keep).toHaveLength(0);
  });

  it("removes an UNPAID obligation no longer in the schedule", () => {
    const plan = planObligationReconciliation(
      ["2026-09"],
      [
        existing("o1", "2026-09", 1000, "RSD", 0),
        existing("o2", "2026-10", 1000, "RSD", 0),
      ],
      1000,
      "RSD"
    );
    expect(plan.remove).toEqual(["o2"]);
  });

  it("never touches an obligation that has payment history", () => {
    const plan = planObligationReconciliation(
      ["2026-09"], // 2026-10 dropped from schedule, but it was paid
      [
        existing("o1", "2026-09", 1000, "RSD", 1000), // paid, salary later changed
        existing("o2", "2026-10", 1000, "RSD", 500), // partial, now unscheduled
      ],
      2000,
      "EUR"
    );
    expect(plan.update).toHaveLength(0);
    expect(plan.remove).toHaveLength(0);
    expect(plan.keep.sort()).toEqual(["o1", "o2"]);
  });

  it("updates currency on an unpaid obligation", () => {
    const plan = planObligationReconciliation(
      ["2026-09"],
      [existing("o1", "2026-09", 1000, "RSD", 0)],
      1000,
      "EUR"
    );
    expect(plan.update).toEqual([{ id: "o1", expected: 1000, currency: "EUR" }]);
  });
});

describe("helpers", () => {
  it("parsePeriod / periodKey round-trip", () => {
    expect(parsePeriod("2026-09")).toEqual({ year: 2026, month: 9 });
    expect(periodKey(2026, 9)).toBe("2026-09");
  });

  it("normalizeCustomMonths dedupes and bounds", () => {
    expect(normalizeCustomMonths("9, 12, 3, 9, 20")).toEqual([9, 12, 3]);
    expect(normalizeCustomMonths("")).toBeNull();
    expect(normalizeCustomMonths(null)).toBeNull();
    expect(normalizeCustomMonths("abc")).toBeNull();
  });

  it("sumPayments totals", () => {
    expect(sumPayments([300, 400, 300])).toBe(1000);
    expect(sumPayments([])).toBe(0);
  });
});

describe("reversal ('Poništi isplatu') sums", () => {
  it("isPaymentReversed flags only stamped rows", () => {
    expect(isPaymentReversed({ amount: 100, reversed_at: null })).toBe(false);
    expect(isPaymentReversed({ amount: 100 })).toBe(false);
    expect(
      isPaymentReversed({ amount: 100, reversed_at: "2026-09-11T10:00:00Z" })
    ).toBe(true);
  });

  it("reversed payments are excluded from the paid total", () => {
    const payments = [
      { amount: 150000, reversed_at: "2026-09-11T10:00:00Z" },
    ];
    expect(sumActivePayments(payments)).toBe(0);
  });

  it("partial payment + reversal of the wrong one yields the correct sum", () => {
    const payments = [
      { amount: 150000, reversed_at: null }, // wrong whole-month entry
      { amount: 60000, reversed_at: null }, // correct partial
    ];
    // Reverse the wrong entry:
    const after = payments.map((p, i) =>
      i === 0 ? { ...p, reversed_at: "2026-09-11T10:00:00Z" } : p
    );
    expect(sumActivePayments(payments)).toBe(210000);
    expect(sumActivePayments(after)).toBe(60000);
  });

  it("remaining reverts and a paid obligation becomes late after reversal", () => {
    const now = new Date("2026-09-11T12:00:00Z");
    // 150.000 RSD obligation fully paid by one (mistaken) payment:
    const paid = obligationState(
      "2026-08",
      150000,
      sumActivePayments([{ amount: 150000, reversed_at: null }]),
      now
    );
    expect(paid.status).toBe("paid");
    expect(paid.remaining).toBe(0);
    // After the reversal the row still exists but counts as zero paid:
    const reversed = obligationState(
      "2026-08",
      150000,
      sumActivePayments([{ amount: 150000, reversed_at: "2026-09-11T12:00:00Z" }]),
      now
    );
    expect(reversed.paid).toBe(0);
    expect(reversed.remaining).toBe(150000);
    expect(reversed.status).toBe("late"); // August already passed
  });

  it("reversal in the current month makes the obligation due, not late", () => {
    const now = new Date("2026-09-11T12:00:00Z");
    const s = obligationState(
      "2026-09",
      150000,
      sumActivePayments([{ amount: 150000, reversed_at: "2026-09-11T11:00:00Z" }]),
      now
    );
    expect(s.status).toBe("due");
    expect(s.remaining).toBe(150000);
  });

  it("partial obligation stays partial with a corrected remaining after reversal", () => {
    const now = new Date("2026-09-11T12:00:00Z");
    const payments = [
      { amount: 50000, reversed_at: null },
      { amount: 100000, reversed_at: "2026-09-11T12:00:00Z" },
    ];
    const s = obligationState("2026-09", 150000, sumActivePayments(payments), now);
    expect(s.paid).toBe(50000);
    expect(s.remaining).toBe(100000);
    expect(s.status).toBe("partial");
  });
});

describe("planObligationReconciliation with reversed payments", () => {
  it("keeps an obligation whose payments were ALL reversed (evidence survives)", () => {
    const plan = planObligationReconciliation(
      ["2026-09"],
      [
        { id: "o1", period: "2026-09", expected_amount: 150000, currency: "RSD", paid: 0, hasHistory: true },
        { id: "o2", period: "2026-10", expected_amount: 150000, currency: "RSD", paid: 0, hasHistory: true },
      ],
      200000,
      "RSD"
    );
    expect(plan.remove).toHaveLength(0); // off-schedule but history stays
    expect(plan.update).toHaveLength(0); // on-schedule but history is immutable
    expect(plan.keep.sort()).toEqual(["o1", "o2"]);
  });

  it("removes obligations with NO payment rows at all, reversed history elsewhere", () => {
    const plan = planObligationReconciliation(
      ["2026-09"],
      [
        { id: "o1", period: "2026-09", expected_amount: 150000, currency: "RSD", paid: 0, hasHistory: false },
        { id: "o2", period: "2026-10", expected_amount: 150000, currency: "RSD", paid: 0, hasHistory: false },
      ],
      150000,
      "RSD"
    );
    expect(plan.remove).toEqual(["o2"]);
    expect(plan.update).toHaveLength(0);
    expect(plan.keep).toEqual(["o1"]);
  });
});

describe("adjustment totals (+bonus / -deduction)", () => {
  it("bonus increases the adjusted amount", () => {
    const totals = adjustmentTotals([{ type: "bonus", amount: 20000, reversed_at: null }]);
    expect(adjustedExpectedAmount(150000, totals)).toBe(170000);
  });

  it("deduction decreases the adjusted amount", () => {
    const totals = adjustmentTotals([{ type: "deduction", amount: 10000, reversed_at: null }]);
    expect(adjustedExpectedAmount(150000, totals)).toBe(140000);
  });

  it("multiple adjustments of both kinds sum correctly", () => {
    const totals = adjustmentTotals([
      { type: "bonus", amount: 20000, reversed_at: null },
      { type: "bonus", amount: 5000, reversed_at: null },
      { type: "deduction", amount: 10000, reversed_at: null },
      { type: "deduction", amount: 2000, reversed_at: null },
    ]);
    expect(totals).toEqual({ bonus: 25000, deduction: 12000 });
    expect(adjustedExpectedAmount(150000, totals)).toBe(163000);
  });

  it("reversed bonuses are not counted", () => {
    const totals = adjustmentTotals([
      { type: "bonus", amount: 20000, reversed_at: "2026-09-11T10:00:00Z" },
    ]);
    expect(totals.bonus).toBe(0);
    expect(adjustedExpectedAmount(150000, totals)).toBe(150000);
  });

  it("reversed deductions are not counted", () => {
    const totals = adjustmentTotals([
      { type: "deduction", amount: 10000, reversed_at: "2026-09-11T10:00:00Z" },
    ]);
    expect(totals.deduction).toBe(0);
    expect(adjustedExpectedAmount(150000, totals)).toBe(150000);
  });

  it("isAdjustmentReversed flags only stamped rows", () => {
    expect(isAdjustmentReversed({ type: "bonus", amount: 1 })).toBe(false);
    expect(isAdjustmentReversed({ type: "bonus", amount: 1, reversed_at: null })).toBe(false);
    expect(
      isAdjustmentReversed({ type: "bonus", amount: 1, reversed_at: "2026-09-11T10:00:00Z" })
    ).toBe(true);
  });

  it("adjusted amount is floored at zero (legacy safety net)", () => {
    expect(adjustedExpectedAmount(10000, { bonus: 0, deduction: 30000 })).toBe(0);
  });
});

describe("validateAdjustmentAmount", () => {
  it("accepts a positive integer bonus of any size", () => {
    expect(validateAdjustmentAmount(20000, "bonus", 150000)).toEqual({ ok: true });
  });

  it("rejects zero, negative and non-integer amounts", () => {
    expect(validateAdjustmentAmount(0, "bonus", 150000).ok).toBe(false);
    expect(validateAdjustmentAmount(-5, "deduction", 150000).ok).toBe(false);
    expect(validateAdjustmentAmount(10.5, "deduction", 150000).ok).toBe(false);
  });

  it("a deduction may bring the obligation down to exactly zero", () => {
    expect(validateAdjustmentAmount(150000, "deduction", 150000)).toEqual({ ok: true });
  });

  it("a deduction may not push the obligation below zero", () => {
    const result = validateAdjustmentAmount(150001, "deduction", 150000);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("ispod 0");
  });

  it("bonus has no floor constraint", () => {
    expect(validateAdjustmentAmount(1000000, "bonus", 0).ok).toBe(true);
  });
});

describe("statuses with adjustments", () => {
  const now = new Date("2026-10-15T00:00:00Z");

  it("bonus over a fully paid base leaves a remaining balance (not paid)", () => {
    // base 150.000 + bonus 20.000, paid only the base 150.000
    const s = obligationState("2026-09", 170000, 150000, now);
    expect(s.remaining).toBe(20000);
    expect(s.status).toBe("partial");
  });

  it("adjusted total fully paid -> paid", () => {
    const s = obligationState("2026-09", 160000, 160000, now);
    expect(s.remaining).toBe(0);
    expect(s.status).toBe("paid");
  });

  it("unpaid adjusted month in the past -> late", () => {
    const s = obligationState("2026-09", 160000, 0, now);
    expect(s.status).toBe("late");
  });

  it("partial payment over an adjusted month -> partial with corrected remaining", () => {
    const s = obligationState("2026-09", 160000, 50000, now);
    expect(s.remaining).toBe(110000);
    expect(s.status).toBe("partial");
  });

  it("a month deducted to zero is settled (paid) with nothing remaining", () => {
    const s = obligationState("2026-09", 0, 0, now);
    expect(s.remaining).toBe(0);
    expect(s.status).toBe("paid");
  });
});

describe("planObligationReconciliation with adjustments", () => {
  it("never deletes an obligation with an ACTIVE adjustment (off-schedule)", () => {
    const plan = planObligationReconciliation(
      ["2026-09"],
      [
        { id: "o1", period: "2026-09", expected_amount: 150000, currency: "RSD", paid: 0, hasAdjustments: true },
        { id: "o2", period: "2026-10", expected_amount: 150000, currency: "RSD", paid: 0, hasAdjustments: true },
      ],
      150000,
      "RSD"
    );
    expect(plan.remove).toHaveLength(0);
    expect(plan.keep.sort()).toEqual(["o1", "o2"]);
  });

  it("never deletes an obligation with REVERSED adjustment history", () => {
    const plan = planObligationReconciliation(
      ["2026-09"],
      [
        { id: "o2", period: "2026-10", expected_amount: 150000, currency: "RSD", paid: 0, hasAdjustments: true },
      ],
      150000,
      "RSD"
    );
    expect(plan.remove).toHaveLength(0);
    expect(plan.keep).toEqual(["o2"]);
  });

  it("still updates an unpaid, adjustment-only obligation when the salary changes", () => {
    const plan = planObligationReconciliation(
      ["2026-09"],
      [
        {
          id: "o1",
          period: "2026-09",
          expected_amount: 150000,
          currency: "RSD",
          paid: 0,
          hasAdjustments: true,
          adjustmentNet: -10000,
        },
      ],
      200000,
      "RSD"
    );
    expect(plan.update).toEqual([{ id: "o1", expected: 200000, currency: "RSD" }]);
  });

  it("keeps the old base when the new salary would break the deduction floor", () => {
    const plan = planObligationReconciliation(
      ["2026-09"],
      [
        {
          id: "o1",
          period: "2026-09",
          expected_amount: 150000,
          currency: "RSD",
          paid: 0,
          hasAdjustments: true,
          adjustmentNet: -100000,
        },
      ],
      50000,
      "RSD"
    );
    // 50.000 - 100.000 < 0 -> rewrite would violate the ">= 0" invariant.
    expect(plan.update).toHaveLength(0);
    expect(plan.keep).toEqual(["o1"]);
  });

  it("blocks base updates when there is payment history even with adjustments", () => {
    const plan = planObligationReconciliation(
      ["2026-09"],
      [
        {
          id: "o1",
          period: "2026-09",
          expected_amount: 150000,
          currency: "RSD",
          paid: 50000,
          hasAdjustments: true,
          adjustmentNet: 20000,
        },
      ],
      200000,
      "RSD"
    );
    expect(plan.update).toHaveLength(0);
    expect(plan.keep).toEqual(["o1"]);
  });
});

describe("money formatting", () => {
  it("groups amounts and appends the currency glued to the number", () => {
    // Non-breaking space: the code can never wrap or drift away from the amount.
    expect(formatAmount(170000, "RSD")).toBe("170.000\u00A0RSD");
    expect(formatAmount(1450, "EUR")).toBe("1.450\u00A0EUR");
    expect(formatAmount(0, "RSD")).toBe("0\u00A0RSD");
    expect(formatAmount(null, "RSD")).toBe("—");
  });

  it("formatNumber stays currency-free for money inputs", () => {
    expect(formatNumber(150000)).toBe("150.000");
  });
});