import { describe, expect, it } from "vitest";
import {
  listAthleteObligations,
  listAthletePayments,
  listBulkPaymentPlayers,
  listSeasonPaymentMonths,
  reconcileContractObligations,
  reverseObligationAdjustmentRecord,
  reversePaymentRecord,
  type ReconcileContract,
} from "../first-team-data";
import type { Supabase } from "../club-data";

/**
 * Chain-recording fake Supabase. Every `from(table)` starts a chain; each
 * chained call is captured, and awaiting the chain pops the next canned
 * response queued for that table. Lets the reversal wiring (filters, stamps,
 * "no delete") be asserted without a live database.
 */
type RecordedOp = { method: string; args: unknown[] };
interface FakeClient {
  from: (table: string) => unknown;
  chains: { table: string; ops: RecordedOp[] }[];
}

function fakeSupabase(queue: Record<string, { data: unknown; error: { message: string } | null }[]>): FakeClient {
  const chains: { table: string; ops: RecordedOp[] }[] = [];
  const make = (table: string, ops: RecordedOp[]): unknown =>
    new Proxy(function () {}, {
      get(_target, prop: string) {
        if (prop === "then") {
          return (resolve: (v: unknown) => void) => {
            const list = queue[table];
            resolve(list && list.length > 0 ? list.shift() : { data: [], error: null });
          };
        }
        return (...args: unknown[]) => {
          ops.push({ method: prop, args });
          return make(table, ops);
        };
      },
    });
  return {
    from(table: string) {
      const ops: RecordedOp[] = [];
      chains.push({ table, ops });
      return make(table, ops);
    },
    chains,
  };
}

const asClient = (fake: FakeClient) => fake as unknown as Supabase;

const OBLIGATION_2026_08 = {
  id: "o1",
  contract_id: "c1",
  athlete_id: "a1",
  period: "2026-08",
  period_start: "2026-08-01",
  expected_amount: 150000,
  currency: "RSD",
};

describe("listAthleteObligations with reversed payments", () => {
  it("a fully reversed month counts as zero paid and reverts to late", async () => {
    const fake = fakeSupabase({
      salary_obligations: [{ data: [OBLIGATION_2026_08], error: null }],
      contract_payments: [
        {
          data: [{ obligation_id: "o1", amount: 150000, reversed_at: "2026-09-11T10:00:00Z" }],
          error: null,
        },
      ],
    });
    const result = await listAthleteObligations(
      asClient(fake),
      "org1",
      "a1",
      new Date("2026-09-11T12:00:00Z")
    );
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      base: 150000,
      adjusted: 150000,
      bonus: 0,
      deduction: 0,
      paid: 0,
      remaining: 150000,
      status: "late",
    });
    // The sums query must fetch the reversal flag so reversed rows can drop out.
    const paymentsChain = fake.chains.find((c) => c.table === "contract_payments");
    expect(String(paymentsChain?.ops[0]?.args[0])).toContain("reversed_at");
  });

  it("partial + reversed sums only the active payments", async () => {
    const fake = fakeSupabase({
      salary_obligations: [{ data: [OBLIGATION_2026_08], error: null }],
      contract_payments: [
        {
          data: [
            { obligation_id: "o1", amount: 50000, reversed_at: null },
            { obligation_id: "o1", amount: 100000, reversed_at: "2026-09-11T10:00:00Z" },
          ],
          error: null,
        },
      ],
    });
    const result = await listAthleteObligations(
      asClient(fake),
      "org1",
      "a1",
      new Date("2026-09-11T12:00:00Z")
    );
    expect(result[0]).toMatchObject({ paid: 50000, remaining: 100000, status: "partial" });
  });
});

describe("listAthleteObligations with adjustments", () => {
  const active = (type: "bonus" | "deduction", amount: number) => ({
    id: `${type}-${amount}`,
    type,
    amount,
    reason: "test",
    note: null,
    created_at: "2026-09-01T10:00:00Z",
    reversed_at: null,
    reversal_note: null,
  });

  it("applies active bonus and deduction to the adjusted amount and status", async () => {
    const fake = fakeSupabase({
      salary_obligations: [{ data: [OBLIGATION_2026_08], error: null }],
      contract_payments: [{ data: [{ obligation_id: "o1", amount: 50000, reversed_at: null }], error: null }],
      salary_obligation_adjustments: [
        {
          data: [
            { ...active("bonus", 20000), obligation_id: "o1" },
            { ...active("deduction", 10000), obligation_id: "o1" },
          ],
          error: null,
        },
      ],
    });
    const result = await listAthleteObligations(
      asClient(fake),
      "org1",
      "a1",
      new Date("2026-09-11T12:00:00Z")
    );
    expect(result[0]).toMatchObject({
      base: 150000,
      bonus: 20000,
      deduction: 10000,
      adjusted: 160000,
      paid: 50000,
      remaining: 110000,
      status: "partial",
    });
    expect(result[0].adjustments).toHaveLength(2);
  });

  it("ignores reversed adjustments but keeps them in history", async () => {
    const fake = fakeSupabase({
      salary_obligations: [{ data: [OBLIGATION_2026_08], error: null }],
      contract_payments: [{ data: [{ obligation_id: "o1", amount: 150000, reversed_at: null }], error: null }],
      salary_obligation_adjustments: [
        {
          data: [
            {
              ...active("bonus", 20000),
              obligation_id: "o1",
              reversed_at: "2026-09-10T10:00:00Z",
            },
          ],
          error: null,
        },
      ],
    });
    const result = await listAthleteObligations(
      asClient(fake),
      "org1",
      "a1",
      new Date("2026-09-11T12:00:00Z")
    );
    expect(result[0]).toMatchObject({ adjusted: 150000, remaining: 0, status: "paid" });
    expect(result[0].adjustments).toHaveLength(1);
    expect(result[0].adjustments[0].reversed_at).toBe("2026-09-10T10:00:00Z");
  });

  it("a bonus over a fully paid base keeps a remaining balance", async () => {
    const fake = fakeSupabase({
      salary_obligations: [{ data: [OBLIGATION_2026_08], error: null }],
      contract_payments: [{ data: [{ obligation_id: "o1", amount: 150000, reversed_at: null }], error: null }],
      salary_obligation_adjustments: [
        { data: [{ ...active("bonus", 20000), obligation_id: "o1" }], error: null },
      ],
    });
    const result = await listAthleteObligations(
      asClient(fake),
      "org1",
      "a1",
      new Date("2026-09-11T12:00:00Z")
    );
    expect(result[0]).toMatchObject({ adjusted: 170000, paid: 150000, remaining: 20000 });
    expect(result[0].status).not.toBe("paid");
  });
});

describe("listAthletePayments (history)", () => {
  it("keeps the reversed record visible as reversed evidence", async () => {
    const fake = fakeSupabase({
      contract_payments: [
        {
          data: [
            {
              id: "p1",
              amount: 150000,
              currency: "RSD",
              paid_on: "2026-08-15",
              method: "bank",
              note: null,
              reversed_at: "2026-09-11T10:00:00Z",
              reversal_note: null,
              salary_obligations: { period: "2026-08" },
            },
          ],
          error: null,
        },
      ],
    });
    const payments = await listAthletePayments(asClient(fake), "org1", "a1");
    expect(payments).toHaveLength(1);
    expect(payments[0].amount).toBe(150000);
    expect(payments[0].reversed_at).toBe("2026-09-11T10:00:00Z");
    expect(payments[0].period).toBe("2026-08");
  });
});

describe("reversePaymentRecord", () => {
  const UUID = "11111111-1111-1111-1111-111111111111";

  it("stamps reversal metadata with a conditional update and never deletes", async () => {
    const fake = fakeSupabase({
      contract_payments: [{ data: [{ id: UUID }], error: null }],
    });
    const result = await reversePaymentRecord(asClient(fake), "org1", UUID, "user1");
    expect(result).toBe("ok");

    const chain = fake.chains[0];
    expect(chain.table).toBe("contract_payments");
    const methods = chain.ops.map((op) => op.method);
    expect(methods).toEqual(["update", "eq", "eq", "is", "select"]);

    const [update] = chain.ops;
    const stamp = update.args[0] as { reversed_at: string; reversed_by: string };
    expect(stamp.reversed_by).toBe("user1");
    expect(new Date(stamp.reversed_at).toString() !== "Invalid Date").toBe(true);

    // The `reversed_at IS NULL` filter is what makes a double reversal impossible:
    // a second run can only match rows that are still active.
    const isOp = chain.ops.find((op) => op.method === "is");
    expect(isOp?.args).toEqual(["reversed_at", null]);
  });

  it("reports already_reversed when the conditional update matches no row", async () => {
    const fake = fakeSupabase({ contract_payments: [{ data: [], error: null }] });
    await expect(
      reversePaymentRecord(asClient(fake), "org1", UUID, "user1")
    ).resolves.toBe("already_reversed");
  });

  it("never issues a DELETE on contract_payments", async () => {
    const fake = fakeSupabase({
      contract_payments: [{ data: [{ id: UUID }], error: null }],
    });
    await reversePaymentRecord(asClient(fake), "org1", UUID, "user1");
    expect(fake.chains.flatMap((c) => c.ops.map((op) => op.method))).not.toContain("delete");
  });
});

describe("reconcileContractObligations protects reversal evidence", () => {
  it("does not delete an obligation whose only payments were reversed", async () => {
    const fake = fakeSupabase({
      salary_obligations: [
        {
          data: [
            { id: "o1", period: "2026-09", expected_amount: 150000, currency: "RSD" },
            { id: "o2", period: "2026-10", expected_amount: 150000, currency: "RSD" },
          ],
          error: null,
        },
      ],
      contract_payments: [
        {
          data: [
            { obligation_id: "o2", amount: 150000, reversed_at: "2026-11-01T10:00:00Z" },
          ],
          error: null,
        },
      ],
    });
    // Contract only schedules September, so October is off-schedule — but it
    // still carries a reversed payment row, which must not be cascade-killed.
    await reconcileContractObligations(
      asClient(fake),
      "org1",
      {
        id: "c1",
        athlete_id: "a1",
        valid_from: "2026-09-01",
        valid_until: "2026-09-30",
        monthly_salary: 150000,
        currency: "RSD",
        pay_schedule: "all_year",
        custom_months: null,
      } satisfies ReconcileContract,
      null
    );
    const deleteCall = fake.chains.some(
      (c) => c.table === "salary_obligations" && c.ops.some((op) => op.method === "delete")
    );
    expect(deleteCall).toBe(false);
  });

  it("does not delete an obligation that has adjustment history", async () => {
    const fake = fakeSupabase({
      salary_obligations: [
        {
          data: [
            { id: "o1", period: "2026-09", expected_amount: 150000, currency: "RSD" },
            { id: "o2", period: "2026-10", expected_amount: 150000, currency: "RSD" },
          ],
          error: null,
        },
      ],
      contract_payments: [{ data: [], error: null }],
      salary_obligation_adjustments: [
        {
          data: [
            // Active correction on the off-schedule month...
            { obligation_id: "o2", type: "bonus", amount: 20000, reversed_at: null },
          ],
          error: null,
        },
      ],
    });
    await reconcileContractObligations(
      asClient(fake),
      "org1",
      {
        id: "c1",
        athlete_id: "a1",
        valid_from: "2026-09-01",
        valid_until: "2026-09-30",
        monthly_salary: 150000,
        currency: "RSD",
        pay_schedule: "all_year",
        custom_months: null,
      } satisfies ReconcileContract,
      null
    );
    const deleteCall = fake.chains.some(
      (c) => c.table === "salary_obligations" && c.ops.some((op) => op.method === "delete")
    );
    expect(deleteCall).toBe(false);
  });

  it("keeps the obligation even when the only adjustment is reversed", async () => {
    const fake = fakeSupabase({
      salary_obligations: [
        {
          data: [{ id: "o2", period: "2026-10", expected_amount: 150000, currency: "RSD" }],
          error: null,
        },
      ],
      contract_payments: [{ data: [], error: null }],
      salary_obligation_adjustments: [
        {
          data: [
            {
              obligation_id: "o2",
              type: "deduction",
              amount: 10000,
              reversed_at: "2026-11-01T10:00:00Z",
            },
          ],
          error: null,
        },
      ],
    });
    await reconcileContractObligations(
      asClient(fake),
      "org1",
      {
        id: "c1",
        athlete_id: "a1",
        valid_from: "2026-09-01",
        valid_until: "2026-09-30",
        monthly_salary: 150000,
        currency: "RSD",
        pay_schedule: "all_year",
        custom_months: null,
      } satisfies ReconcileContract,
      null
    );
    expect(
      fake.chains.some(
        (c) => c.table === "salary_obligations" && c.ops.some((op) => op.method === "delete")
      )
    ).toBe(false);
  });
});

describe("listBulkPaymentPlayers (adjusted remaining is the payment default)", () => {
  it("remaining = base + active bonuses - active deductions - active paid", async () => {
    const fake = fakeSupabase({
      seasonal_memberships: [
        {
          data: [
            {
              athlete_id: "a1",
              jersey_number: 10,
              athletes: { first_name: "Marko", last_name: "Marković", club_athlete_number: 7 },
            },
          ],
          error: null,
        },
      ],
      contracts: [
        {
          data: [
            {
              id: "c1",
              athlete_id: "a1",
              status: "active",
              monthly_salary: 150000,
              currency: "RSD",
              pay_schedule: "all_year",
              custom_months: null,
              valid_from: "2026-08-01",
              valid_until: "2027-06-30",
            },
          ],
          error: null,
        },
      ],
      salary_obligations: [
        {
          data: [
            {
              id: "o1",
              contract_id: "c1",
              athlete_id: "a1",
              period: "2026-09",
              period_start: "2026-09-01",
              expected_amount: 150000,
              currency: "RSD",
            },
          ],
          error: null,
        },
      ],
      contract_payments: [{ data: [], error: null }],
      salary_obligation_adjustments: [
        {
          data: [
            { obligation_id: "o1", type: "bonus", amount: 20000, reversed_at: null },
            { obligation_id: "o1", type: "deduction", amount: 10000, reversed_at: null },
          ],
          error: null,
        },
      ],
    });

    const players = await listBulkPaymentPlayers(
      asClient(fake),
      "org1",
      "s1",
      "2026-09",
      null,
      new Date("2026-09-11T12:00:00Z")
    );

    expect(players).toHaveLength(1);
    expect(players[0]).toMatchObject({
      base: 150000,
      bonus: 20000,
      deduction: 10000,
      adjusted: 160000,
      paid: 0,
      // The bulk form defaults each amount input to `remaining`:
      remaining: 160000,
      status: "due",
    });
  });

  it("overpayment headroom shrinks to the adjusted remaining after a deduction", async () => {
    const fake = fakeSupabase({
      seasonal_memberships: [
        {
          data: [
            {
              athlete_id: "a1",
              jersey_number: null,
              athletes: { first_name: "Marko", last_name: "Marković", club_athlete_number: 7 },
            },
          ],
          error: null,
        },
      ],
      contracts: [
        {
          data: [
            {
              id: "c1",
              athlete_id: "a1",
              status: "active",
              monthly_salary: 150000,
              currency: "RSD",
              pay_schedule: "all_year",
              custom_months: null,
              valid_from: "2026-08-01",
              valid_until: "2027-06-30",
            },
          ],
          error: null,
        },
      ],
      salary_obligations: [
        {
          data: [
            {
              id: "o1",
              contract_id: "c1",
              athlete_id: "a1",
              period: "2026-09",
              period_start: "2026-09-01",
              expected_amount: 150000,
              currency: "RSD",
            },
          ],
          error: null,
        },
      ],
      contract_payments: [
        {
          data: [
            {
              id: "p1",
              obligation_id: "o1",
              amount: 50000,
              currency: "RSD",
              paid_on: "2026-09-11",
              method: "cash",
              note: null,
              reversed_at: null,
            },
            {
              id: "p2",
              obligation_id: "o1",
              amount: 20000,
              currency: "RSD",
              paid_on: "2026-09-10",
              method: "bank",
              note: "greška",
              reversed_at: "2026-09-12T10:00:00Z",
            },
          ],
          error: null,
        },
      ],
      salary_obligation_adjustments: [
        {
          data: [{ obligation_id: "o1", type: "deduction", amount: 10000, reversed_at: null }],
          error: null,
        },
      ],
    });

    const players = await listBulkPaymentPlayers(
      asClient(fake),
      "org1",
      "s1",
      "2026-09",
      null,
      new Date("2026-09-11T12:00:00Z")
    );

    // 150.000 - 10.000 - 50.000 = 90.000; anything above would overpay.
    // The reversed row stays in the history but never moves the paid sum.
    expect(players[0]).toMatchObject({ adjusted: 140000, paid: 50000, remaining: 90000 });
    expect(players[0].recorded_payments).toEqual([
      expect.objectContaining({
        id: "p1",
        amount: 50000,
        paid_on: "2026-09-11",
        method: "cash",
        reversed_at: null,
      }),
      expect.objectContaining({
        id: "p2",
        amount: 20000,
        paid_on: "2026-09-10",
        method: "bank",
        note: "greška",
        reversed_at: "2026-09-12T10:00:00Z",
      }),
    ]);
  });
});

describe("reverseObligationAdjustmentRecord", () => {
  const UUID = "44444444-4444-4444-4444-444444444444";

  it("stamps reversal metadata with a conditional update and never deletes", async () => {
    const fake = fakeSupabase({
      salary_obligation_adjustments: [{ data: [{ id: UUID }], error: null }],
    });
    const result = await reverseObligationAdjustmentRecord(
      asClient(fake),
      "org1",
      UUID,
      "user1"
    );
    expect(result).toBe("ok");

    const chain = fake.chains[0];
    expect(chain.table).toBe("salary_obligation_adjustments");
    expect(chain.ops.map((op) => op.method)).toEqual(["update", "eq", "eq", "is", "select"]);
    const [update] = chain.ops;
    const stamp = update.args[0] as { reversed_at: string; reversed_by: string };
    expect(stamp.reversed_by).toBe("user1");
    const isOp = chain.ops.find((op) => op.method === "is");
    expect(isOp?.args).toEqual(["reversed_at", null]);
  });

  it("a second reversal matches no row -> already_reversed (double reversal safe)", async () => {
    const fake = fakeSupabase({ salary_obligation_adjustments: [{ data: [], error: null }] });
    await expect(
      reverseObligationAdjustmentRecord(asClient(fake), "org1", UUID, "user1")
    ).resolves.toBe("already_reversed");
  });

  it("never issues a DELETE on salary_obligation_adjustments", async () => {
    const fake = fakeSupabase({
      salary_obligation_adjustments: [{ data: [{ id: UUID }], error: null }],
    });
    await reverseObligationAdjustmentRecord(asClient(fake), "org1", UUID, "user1");
    expect(fake.chains.flatMap((c) => c.ops.map((op) => op.method))).not.toContain("delete");
  });
});

describe("listSeasonPaymentMonths (season overview)", () => {
  const SEASON = { id: "s1", starts_on: "2026-08-01", ends_on: "2026-10-31" };

  function arrangeSeason() {
    return fakeSupabase({
      seasonal_memberships: [
        {
          data: [
            {
              athlete_id: "a1",
              jersey_number: 10,
              athletes: { first_name: "Marko", last_name: "Marković", club_athlete_number: 7 },
            },
          ],
          error: null,
        },
      ],
      contracts: [
        {
          data: [
            {
              id: "c1",
              athlete_id: "a1",
              status: "active",
              monthly_salary: 150000,
              currency: "RSD",
              pay_schedule: "all_year",
              custom_months: null,
              valid_from: "2026-08-01",
              // Runs past the season window on purpose: the overview must not
              // show months outside the active season.
              valid_until: "2026-12-31",
            },
          ],
          error: null,
        },
      ],
      salary_obligations: [
        {
          data: [
            {
              id: "o1",
              contract_id: "c1",
              athlete_id: "a1",
              period: "2026-08",
              expected_amount: 150000,
            },
            {
              id: "o2",
              contract_id: "c1",
              athlete_id: "a1",
              period: "2026-09",
              expected_amount: 150000,
            },
          ],
          error: null,
        },
      ],
      contract_payments: [
        {
          data: [
            { obligation_id: "o1", amount: 150000, reversed_at: null },
            { obligation_id: "o2", amount: 50000, reversed_at: null },
          ],
          error: null,
        },
      ],
      salary_obligation_adjustments: [{ data: [], error: null }],
    });
  }

  it("rolls the obligations up per month with totals and player counts", async () => {
    const fake = arrangeSeason();
    const months = await listSeasonPaymentMonths(
      asClient(fake),
      "org1",
      SEASON,
      null,
      new Date("2026-09-15T12:00:00Z")
    );

    // Three season months (Aug, Sep, Oct) — the contract runs to December, so
    // the window cuts the rest off. One player each.
    expect(months.map((m) => m.period)).toEqual(["2026-08", "2026-09", "2026-10"]);

    expect(months[0]).toMatchObject({
      period: "2026-08",
      playerCount: 1,
      paidCount: 1,
      partialCount: 0,
      unpaidCount: 0,
      expected: 150000,
      paid: 150000,
      remaining: 0,
      status: "paid",
    });
    expect(months[1]).toMatchObject({
      period: "2026-09",
      playerCount: 1,
      paidCount: 0,
      partialCount: 1,
      unpaidCount: 0,
      expected: 150000,
      paid: 50000,
      remaining: 100000,
      status: "partial",
    });
    // A future month shows the contracted obligation before anything is paid.
    expect(months[2]).toMatchObject({
      period: "2026-10",
      playerCount: 1,
      paidCount: 0,
      expected: 150000,
      paid: 0,
      remaining: 150000,
      status: "future",
    });
  });

  it("counts reversed payments as evidence only (not as paid)", async () => {
    const reversed = fakeSupabase({
      seasonal_memberships: [
        {
          data: [
            {
              athlete_id: "a1",
              jersey_number: 10,
              athletes: { first_name: "Marko", last_name: "Marković", club_athlete_number: 7 },
            },
          ],
          error: null,
        },
      ],
      contracts: [
        {
          data: [
            {
              id: "c1",
              athlete_id: "a1",
              status: "active",
              monthly_salary: 150000,
              currency: "RSD",
              pay_schedule: "all_year",
              custom_months: null,
              valid_from: "2026-08-01",
              valid_until: "2026-08-31",
            },
          ],
          error: null,
        },
      ],
      salary_obligations: [
        {
          data: [
            {
              id: "o1",
              contract_id: "c1",
              athlete_id: "a1",
              period: "2026-08",
              expected_amount: 150000,
            },
          ],
          error: null,
        },
      ],
      contract_payments: [
        {
          data: [{ obligation_id: "o1", amount: 150000, reversed_at: "2026-09-02T10:00:00Z" }],
          error: null,
        },
      ],
      salary_obligation_adjustments: [{ data: [], error: null }],
    });

    const months = await listSeasonPaymentMonths(
      asClient(reversed),
      "org1",
      { id: "s1", starts_on: "2026-08-01", ends_on: "2026-08-31" },
      null,
      new Date("2026-09-15T12:00:00Z")
    );

    expect(months).toHaveLength(1);
    expect(months[0]).toMatchObject({
      paid: 0,
      remaining: 150000,
      unpaidCount: 1,
      status: "late",
    });
  });
});
