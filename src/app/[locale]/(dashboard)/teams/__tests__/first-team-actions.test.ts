import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/organization", () => ({
  requireOrganization: vi.fn(),
  hasPermission: vi.fn(),
  getOrganizationCurrency: vi.fn(async () => "RSD"),
}));
vi.mock("@/lib/supabase/server", () => ({
  createServerClient: vi.fn(async () => ({}) as never),
}));
vi.mock("@/lib/club-data", () => ({
  getActiveSeason: vi.fn(async () => ({
    id: "season-1",
    competition_months: null,
  })),
}));
vi.mock("@/lib/first-team-data", () => ({
  listBulkPaymentPlayers: vi.fn(),
  listFirstTeamContracts: vi.fn(),
  reconcileContractObligations: vi.fn(),
  reconcileOrgContractObligations: vi.fn(),
  recordPayment: vi.fn(),
  reversePaymentRecord: vi.fn(),
  createObligationAdjustment: vi.fn(),
  ensureContractObligation: vi.fn(),
  listObligationAdjustments: vi.fn(),
  reverseObligationAdjustmentRecord: vi.fn(),
}));

import { revalidatePath } from "next/cache";
import { hasPermission, requireOrganization } from "@/lib/organization";
import {
  createObligationAdjustment,
  ensureContractObligation,
  listBulkPaymentPlayers,
  listFirstTeamContracts,
  listObligationAdjustments,
  reverseObligationAdjustmentRecord,
  reversePaymentRecord,
} from "@/lib/first-team-data";
import {
  addBulkAdjustment,
  addObligationAdjustment,
  recordBulkPayments,
  reverseObligationAdjustment,
  reversePayment,
} from "../first-team-actions";

const ORG_ID = "org-1";
const USER_ID = "user-1";
const PAYMENT_ID = "22222222-2222-2222-2222-222222222222";
const ATHLETE_ID = "33333333-3333-3333-3333-333333333333";
const ADJUSTMENT_ID = "55555555-5555-5555-5555-555555555555";
const OBLIGATION_ID = "66666666-6666-6666-6666-666666666666";
const ATHLETE_ID_2 = "77777777-7777-7777-7777-777777777777";

function formDataWith() {
  const fd = new FormData();
  fd.set("payment_id", PAYMENT_ID);
  fd.set("athlete_id", ATHLETE_ID);
  return fd;
}

function adjustmentFormData(over: Record<string, string> = {}) {
  const fd = new FormData();
  fd.set("athlete_id", ATHLETE_ID);
  fd.set("period", "2026-09");
  fd.set("type", "bonus");
  fd.set("amount", "20000");
  fd.set("reason", "Bonus za pobedu");
  fd.set("note", "");
  for (const [key, value] of Object.entries(over)) fd.set(key, value);
  return fd;
}

beforeEach(() => {
  vi.mocked(requireOrganization).mockResolvedValue({
    organizationId: ORG_ID,
    userRole: "club_president",
    userId: USER_ID,
  } as never);
  vi.mocked(hasPermission).mockReset();
  vi.mocked(reversePaymentRecord).mockReset();
  vi.mocked(revalidatePath).mockReset();
  vi.mocked(createObligationAdjustment).mockReset();
  vi.mocked(ensureContractObligation).mockReset();
  vi.mocked(listObligationAdjustments).mockReset();
  vi.mocked(reverseObligationAdjustmentRecord).mockReset();
  vi.mocked(listFirstTeamContracts).mockReset();
  vi.mocked(listBulkPaymentPlayers).mockReset();
});

describe("reversePayment server action", () => {
  it("requires first_team_finance.manage — a view-only user cannot reverse", async () => {
    vi.mocked(hasPermission).mockResolvedValue(false as never);
    await expect(reversePayment(formDataWith())).rejects.toThrow(/dozvolu/i);
    expect(hasPermission).toHaveBeenCalledWith("first_team_finance.manage");
    expect(reversePaymentRecord).not.toHaveBeenCalled();
  });

  it("reverses through the stamped conditional update, scoped to the org", async () => {
    vi.mocked(hasPermission).mockResolvedValue(true as never);
    vi.mocked(reversePaymentRecord).mockResolvedValue("ok" as never);
    await expect(reversePayment(formDataWith())).resolves.toBeUndefined();
    expect(reversePaymentRecord).toHaveBeenCalledWith(
      expect.anything(),
      ORG_ID,
      PAYMENT_ID,
      USER_ID
    );
    expect(revalidatePath).toHaveBeenCalledWith("/teams", "layout");
    expect(revalidatePath).toHaveBeenCalledWith(`/players/${ATHLETE_ID}/contracts`);
  });

  it("an already-reversed payment is a safe no-op, never a second reversal", async () => {
    vi.mocked(hasPermission).mockResolvedValue(true as never);
    vi.mocked(reversePaymentRecord).mockResolvedValue("already_reversed" as never);
    await expect(reversePayment(formDataWith())).resolves.toBeUndefined();
    expect(reversePaymentRecord).toHaveBeenCalledTimes(1);
    expect(revalidatePath).toHaveBeenCalledWith(`/players/${ATHLETE_ID}/contracts`);
    expect(revalidatePath).not.toHaveBeenCalledWith("/teams", "layout");
  });

  it("rejects malformed ids without touching the payment", async () => {
    vi.mocked(hasPermission).mockResolvedValue(true as never);
    const fd = new FormData();
    fd.set("payment_id", "not-a-uuid");
    fd.set("athlete_id", ATHLETE_ID);
    await expect(reversePayment(fd)).rejects.toThrow();
    expect(reversePaymentRecord).not.toHaveBeenCalled();
  });
});

describe("recordBulkPayments obligation-bound validation", () => {
  function arrangeEligible() {
    vi.mocked(hasPermission).mockResolvedValue(true as never);
    vi.mocked(listFirstTeamContracts).mockResolvedValue([
      { athlete_id: ATHLETE_ID, id: "contract-1" },
    ] as never);
    vi.mocked(listBulkPaymentPlayers).mockResolvedValue([
      {
        athlete_id: ATHLETE_ID,
        first_name: "Marko",
        last_name: "Marković",
        obligation_id: OBLIGATION_ID,
        contract_id: "contract-1",
        currency: "RSD",
        // base 150.000 + bonus 20.000 - deduction 10.000 = 160.000 due
        remaining: 160000,
      },
    ] as never);
  }

  function paymentFormData(entries: Record<string, string>) {
    const fd = new FormData();
    fd.set("period", "2026-09");
    fd.set("paid_on", "2026-09-11");
    fd.set("method", "cash");
    for (const [key, value] of Object.entries(entries)) fd.set(key, value);
    return fd;
  }

  it("rejects a payment above the adjusted remaining reported for the month", async () => {
    arrangeEligible();
    const state = await recordBulkPayments(
      null,
      paymentFormData({ [`amount_${ATHLETE_ID}`]: "170000" })
    );
    expect(state?.error).toContain("160000");
  });

  it("rejects a zero or empty amount for a selected player (no silent skip)", async () => {
    arrangeEligible();

    const empty = await recordBulkPayments(
      null,
      paymentFormData({ [`amount_${ATHLETE_ID}`]: "" })
    );
    expect(empty?.error).toMatch(/veći od 0/i);

    const zero = await recordBulkPayments(
      null,
      paymentFormData({ [`amount_${ATHLETE_ID}`]: "0" })
    );
    expect(zero?.error).toMatch(/veći od 0/i);
  });

  it("rejects a payment for a player without an obligation for the selected month", async () => {
    arrangeEligible();
    const state = await recordBulkPayments(
      null,
      paymentFormData({ [`amount_${ATHLETE_ID_2}`]: "50000" })
    );
    expect(state?.error).toMatch(/obavezom za izabrani mesec/i);
  });

  it("rejects a submission with no selected players", async () => {
    arrangeEligible();
    const state = await recordBulkPayments(null, paymentFormData({}));
    expect(state?.error).toMatch(/najmanje jednog igrača/i);
  });
});

describe("addBulkAdjustment server action (single = bulk with one player)", () => {
  function bulkFormData(ids: string[], over: Record<string, string> = {}) {
    const fd = new FormData();
    ids.forEach((id) => fd.append("athlete_ids", id));
    fd.set("period", "2026-09");
    fd.set("type", over.type ?? "bonus");
    fd.set("amount", over.amount ?? "10000");
    fd.set("reason", over.reason ?? "Bonus za pobedu");
    fd.set("note", over.note ?? "");
    return fd;
  }

  function arrangeTwoPlayers() {
    vi.mocked(hasPermission).mockResolvedValue(true as never);
    vi.mocked(listFirstTeamContracts).mockResolvedValue([
      {
        athlete_id: ATHLETE_ID,
        id: "contract-1",
        first_name: "Marko",
        last_name: "Marković",
      },
      {
        athlete_id: ATHLETE_ID_2,
        id: "contract-2",
        first_name: "Petar",
        last_name: "Petrović",
      },
    ] as never);
    vi.mocked(ensureContractObligation).mockImplementation(async (...args) => {
      const contract = args[2];
      return {
        id: contract.athlete_id === ATHLETE_ID_2 ? "obligation-2" : "obligation-1",
        expected_amount: 150000,
        currency: "RSD",
      } as never;
    });
    vi.mocked(listObligationAdjustments).mockResolvedValue([] as never);
    vi.mocked(createObligationAdjustment).mockResolvedValue({ error: null } as never);
  }

  it("requires first_team_finance.manage", async () => {
    vi.mocked(hasPermission).mockResolvedValue(false as never);
    const state = await addBulkAdjustment(null, bulkFormData([ATHLETE_ID]));
    expect(state?.error).toMatch(/dozvolu/i);
    expect(createObligationAdjustment).not.toHaveBeenCalled();
  });

  it("rejects malformed input before touching the database", async () => {
    vi.mocked(hasPermission).mockResolvedValue(true as never);
    const state = await addBulkAdjustment(null, bulkFormData([ATHLETE_ID], { amount: "0" }));
    expect(state?.error).toBeTruthy();
    expect(ensureContractObligation).not.toHaveBeenCalled();
    expect(createObligationAdjustment).not.toHaveBeenCalled();
  });

  it("ONE selected player is a valid individual bonus", async () => {
    arrangeTwoPlayers();
    const state = await addBulkAdjustment(null, bulkFormData([ATHLETE_ID]));
    expect(state?.ok).toBe(true);
    expect(createObligationAdjustment).toHaveBeenCalledTimes(1);
    expect(createObligationAdjustment).toHaveBeenCalledWith(
      expect.anything(),
      ORG_ID,
      expect.objectContaining({
        obligation_id: "obligation-1",
        type: "bonus",
        amount: 10000,
        created_by: USER_ID,
      })
    );
  });

  it("multi-player bonus applies the SAME amount to EACH player (never split)", async () => {
    arrangeTwoPlayers();
    const state = await addBulkAdjustment(
      null,
      bulkFormData([ATHLETE_ID, ATHLETE_ID_2])
    );
    expect(state?.ok).toBe(true);
    expect(createObligationAdjustment).toHaveBeenCalledTimes(2);
    const amounts = vi
      .mocked(createObligationAdjustment)
      .mock.calls.map((call) => (call[2] as { amount: number }).amount);
    expect(amounts).toEqual([10000, 10000]);
    const obligations = vi
      .mocked(createObligationAdjustment)
      .mock.calls.map((call) => (call[2] as { obligation_id: string }).obligation_id);
    expect(obligations).toEqual(["obligation-1", "obligation-2"]);
  });

  it("multi-player deduction writes for every player when all floors pass", async () => {
    arrangeTwoPlayers();
    const state = await addBulkAdjustment(
      null,
      bulkFormData([ATHLETE_ID, ATHLETE_ID_2], { type: "deduction", amount: "5000" })
    );
    expect(state?.ok).toBe(true);
    expect(createObligationAdjustment).toHaveBeenCalledTimes(2);
    expect(vi.mocked(createObligationAdjustment).mock.calls[0][2]).toMatchObject({
      type: "deduction",
      amount: 5000,
    });
  });

  it("an invalid deduction on ONE player blocks the WHOLE bulk action (no half-success)", async () => {
    arrangeTwoPlayers();
    vi.mocked(listObligationAdjustments).mockImplementation(async (...args) => {
      const ids = args[2] as string[];
      return ids[0] === "obligation-2"
        ? ([{ type: "deduction", amount: 150000, reversed_at: null }] as never)
        : ([] as never);
    });

    const state = await addBulkAdjustment(
      null,
      bulkFormData([ATHLETE_ID, ATHLETE_ID_2], { type: "deduction", amount: "1000" })
    );

    expect(state?.error).toContain("Petrović Petar");
    expect(state?.error).toContain("ispod 0");
    // Nothing was written — not even for the player that passed validation.
    expect(createObligationAdjustment).not.toHaveBeenCalled();
  });

  it("deduplicates repeated athlete ids (one write per player)", async () => {
    arrangeTwoPlayers();
    const state = await addBulkAdjustment(
      null,
      bulkFormData([ATHLETE_ID, ATHLETE_ID])
    );
    expect(state?.ok).toBe(true);
    expect(createObligationAdjustment).toHaveBeenCalledTimes(1);
  });

  it("rejects an athlete without an active contract without writing anything", async () => {
    arrangeTwoPlayers();
    const unknownId = "88888888-8888-8888-8888-888888888888";
    const state = await addBulkAdjustment(null, bulkFormData([ATHLETE_ID, unknownId]));
    expect(state?.error).toMatch(/ugovor/i);
    expect(createObligationAdjustment).not.toHaveBeenCalled();
  });
});

describe("addObligationAdjustment server action", () => {
  function arrangeManage() {
    vi.mocked(hasPermission).mockResolvedValue(true as never);
    vi.mocked(listFirstTeamContracts).mockResolvedValue([
      { athlete_id: ATHLETE_ID, id: "contract-1" },
    ] as never);
    vi.mocked(ensureContractObligation).mockResolvedValue({
      id: OBLIGATION_ID,
      expected_amount: 150000,
      currency: "RSD",
    } as never);
  }

  it("requires first_team_finance.manage — a view-only user cannot add", async () => {
    vi.mocked(hasPermission).mockResolvedValue(false as never);
    const state = await addObligationAdjustment(null, adjustmentFormData());
    expect(state?.error).toMatch(/dozvolu/i);
    expect(ensureContractObligation).not.toHaveBeenCalled();
    expect(createObligationAdjustment).not.toHaveBeenCalled();
  });

  it("rejects malformed input", async () => {
    vi.mocked(hasPermission).mockResolvedValue(true as never);
    const state = await addObligationAdjustment(
      null,
      adjustmentFormData({ amount: "0", reason: "" })
    );
    expect(state?.error).toBeTruthy();
    expect(createObligationAdjustment).not.toHaveBeenCalled();
  });

  it("rejects a deduction that would push the adjusted amount below zero", async () => {
    arrangeManage();
    vi.mocked(listObligationAdjustments).mockResolvedValue([
      { type: "deduction", amount: 150000, reversed_at: null },
    ] as never);
    const state = await addObligationAdjustment(
      null,
      adjustmentFormData({ type: "deduction", amount: "1000" })
    );
    expect(state?.error).toContain("ispod 0");
    expect(createObligationAdjustment).not.toHaveBeenCalled();
  });

  it("adds a bonus against the reconciled obligation and refreshes views", async () => {
    arrangeManage();
    vi.mocked(listObligationAdjustments).mockResolvedValue([] as never);
    vi.mocked(createObligationAdjustment).mockResolvedValue({ error: null } as never);

    const state = await addObligationAdjustment(
      null,
      adjustmentFormData({ note: "  isplata uz pobedu  " })
    );

    expect(state?.ok).toBe(true);
    expect(createObligationAdjustment).toHaveBeenCalledWith(
      expect.anything(),
      ORG_ID,
      {
        obligation_id: OBLIGATION_ID,
        type: "bonus",
        amount: 20000,
        reason: "Bonus za pobedu",
        note: "isplata uz pobedu",
        created_by: USER_ID,
      }
    );
    expect(revalidatePath).toHaveBeenCalledWith("/teams", "layout");
    expect(revalidatePath).toHaveBeenCalledWith("/players");
  });

  it("a missing obligation for the period is reported naturally", async () => {
    arrangeManage();
    vi.mocked(ensureContractObligation).mockResolvedValue(null as never);
    const state = await addObligationAdjustment(null, adjustmentFormData());
    expect(state?.error).toMatch(/obaveze/i);
    expect(createObligationAdjustment).not.toHaveBeenCalled();
  });
});

describe("reverseObligationAdjustment server action", () => {
  function reverseFormData() {
    const fd = new FormData();
    fd.set("adjustment_id", ADJUSTMENT_ID);
    fd.set("athlete_id", ATHLETE_ID);
    return fd;
  }

  it("requires first_team_finance.manage — a view-only user cannot reverse", async () => {
    vi.mocked(hasPermission).mockResolvedValue(false as never);
    await expect(reverseObligationAdjustment(reverseFormData())).rejects.toThrow(/dozvolu/i);
    expect(reverseObligationAdjustmentRecord).not.toHaveBeenCalled();
  });

  it("reverses through the stamped conditional update and refreshes both views", async () => {
    vi.mocked(hasPermission).mockResolvedValue(true as never);
    vi.mocked(reverseObligationAdjustmentRecord).mockResolvedValue("ok" as never);
    await expect(reverseObligationAdjustment(reverseFormData())).resolves.toBeUndefined();
    expect(reverseObligationAdjustmentRecord).toHaveBeenCalledWith(
      expect.anything(),
      ORG_ID,
      ADJUSTMENT_ID,
      USER_ID
    );
    expect(revalidatePath).toHaveBeenCalledWith("/teams", "layout");
    expect(revalidatePath).toHaveBeenCalledWith(`/players/${ATHLETE_ID}/contracts`);
  });

  it("an already-reversed adjustment is a safe no-op (double reversal blocked)", async () => {
    vi.mocked(hasPermission).mockResolvedValue(true as never);
    vi.mocked(reverseObligationAdjustmentRecord).mockResolvedValue("already_reversed" as never);
    await expect(reverseObligationAdjustment(reverseFormData())).resolves.toBeUndefined();
    expect(reverseObligationAdjustmentRecord).toHaveBeenCalledTimes(1);
    expect(revalidatePath).not.toHaveBeenCalledWith("/teams", "layout");
    expect(revalidatePath).toHaveBeenCalledWith(`/players/${ATHLETE_ID}/contracts`);
  });
});
