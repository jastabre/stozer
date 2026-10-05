import { describe, expect, it } from "vitest";
import { countPlayersWithDueUnpaidObligations } from "@/lib/first-team-data";
import type { Supabase } from "@/lib/club-data";

type Result = { data: unknown; error: unknown };

function fakeSupabase(queue: Record<string, Result[]>): Supabase {
  const make = (table: string): unknown =>
    new Proxy(function () {}, {
      get(_target, prop: string) {
        if (prop === "then") {
          return (resolve: (v: unknown) => void) => {
            const list = queue[table];
            resolve(list && list.length > 0 ? list.shift() : { data: [], error: null });
          };
        }
        return () => make(table);
      },
    });
  return { from: (table: string) => make(table) } as unknown as Supabase;
}

const SEASON = { id: "s1", starts_on: "2026-07-01", ends_on: "2027-06-30" };
// 29 Sep 2026 (local): current period = "2026-09".
const NOW = new Date(2026, 8, 29);

function member(athleteId: string) {
  return {
    athlete_id: athleteId,
    jersey_number: 10,
    athletes: { first_name: "Ime", last_name: "Prezime", club_athlete_number: 1 },
  };
}

function contract(over: Partial<Record<string, unknown>> = {}) {
  return {
    id: "c1",
    athlete_id: "a1",
    valid_from: "2026-09-01",
    valid_until: "2027-06-30",
    monthly_salary: 150000,
    currency: "RSD",
    pay_schedule: "all_year",
    custom_months: null,
    status: "active",
    ...over,
  };
}

function obligation(over: Partial<Record<string, unknown>> = {}) {
  return {
    id: "o1",
    contract_id: "c1",
    period: "2026-09",
    expected_amount: 150000,
    ...over,
  };
}

function arrange({
  memberships = [member("a1")],
  contracts = [contract()],
  obligations = [],
  payments = [],
  adjustments = [],
}: {
  memberships?: unknown[];
  contracts?: unknown[];
  obligations?: unknown[];
  payments?: unknown[];
  adjustments?: unknown[];
} = {}) {
  const supabase = fakeSupabase({
    seasonal_memberships: [{ data: memberships, error: null }],
    contracts: [{ data: contracts, error: null }],
    salary_obligations: [{ data: obligations, error: null }],
    contract_payments: [{ data: payments, error: null }],
    salary_obligation_adjustments: [{ data: adjustments, error: null }],
  });
  return countPlayersWithDueUnpaidObligations(
    supabase,
    "org-1",
    SEASON,
    null,
    NOW
  );
}

describe("countPlayersWithDueUnpaidObligations", () => {
  it("counts a player once even when they owe several due months", async () => {
    await expect(
      arrange({
        contracts: [contract({ valid_from: "2026-07-01" })],
        obligations: [
          obligation({ id: "o7", period: "2026-07" }),
          obligation({ id: "o8", period: "2026-08" }),
          obligation({ id: "o9", period: "2026-09" }),
        ],
      })
    ).resolves.toBe(1);
  });

  it("returns 0 when the only due obligation is fully paid", async () => {
    await expect(
      arrange({
        obligations: [obligation()],
        payments: [{ obligation_id: "o1", amount: 150000, reversed_at: null }],
      })
    ).resolves.toBe(0);
  });

  it("counts a partially-paid player (open balance still needs attention)", async () => {
    await expect(
      arrange({
        obligations: [obligation()],
        payments: [{ obligation_id: "o1", amount: 50000, reversed_at: null }],
      })
    ).resolves.toBe(1);
  });

  it("ignores a reversed payment — a fully-reversed payment still leaves it unpaid", async () => {
    await expect(
      arrange({
        obligations: [obligation()],
        payments: [{ obligation_id: "o1", amount: 150000, reversed_at: "2026-09-10T00:00:00Z" }],
      })
    ).resolves.toBe(1);
  });

  it("does not count future obligations", async () => {
    await expect(
      arrange({
        contracts: [contract({ valid_from: "2026-10-01" })],
        obligations: [obligation({ period: "2026-10" })],
      })
    ).resolves.toBe(0);
  });

  it("returns 0 when there are no active first-team contracts", async () => {
    await expect(arrange({ contracts: [] })).resolves.toBe(0);
  });

  it("counts distinct players, not obligation rows", async () => {
    await expect(
      arrange({
        contracts: [
          contract({ id: "c1", athlete_id: "a1" }),
          contract({ id: "c2", athlete_id: "a2" }),
        ],
        memberships: [member("a1"), member("a2")],
        obligations: [
          obligation({ id: "o1", contract_id: "c1", period: "2026-09" }),
          obligation({ id: "o2", contract_id: "c2", period: "2026-09" }),
        ],
        payments: [{ obligation_id: "o1", amount: 150000, reversed_at: null }],
      })
    ).resolves.toBe(1);
  });

  it("excludes a player with no active-season membership", async () => {
    await expect(
      arrange({
        memberships: [member("a1")],
        contracts: [contract({ id: "c1", athlete_id: "a1" })],
        obligations: [obligation()],
      })
    ).resolves.toBe(1);
  });
});
