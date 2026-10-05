"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { hasPermission, getOrganizationCurrency, requireOrganization } from "@/lib/organization";
import { createServerClient } from "@/lib/supabase/server";
import { getActiveSeason } from "@/lib/club-data";
import {
  createObligationAdjustment,
  ensureContractObligation,
  listBulkPaymentPlayers,
  listFirstTeamContracts,
  listObligationAdjustments,
  reconcileContractObligations,
  reconcileOrgContractObligations,
  reverseObligationAdjustmentRecord,
  reversePaymentRecord,
  type ObligationAdjustmentInput,
} from "@/lib/first-team-data";
import {
  ADJUSTMENT_TYPES,
  adjustedExpectedAmount,
  adjustmentTotals,
  validateAdjustmentAmount,
  validatePaymentAmount,
  type AdjustmentType,
} from "@/lib/first-team";

/** Shared state shape for first-team finance mutations driven by useActionState. */
type FinanceActionState = { error?: string; ok?: boolean } | null;

/**
 * Record bulk first-team payments for one obligation month. Every payment is
 * tied to a concrete monthly obligation: the eligible list (contract schedule
 * for the selected period) is re-derived server-side, never trusted from the
 * client, and each submission must match a player on it — so a payment can
 * never land on another player, another month, or another organization. The
 * amount must be a positive integer and may never exceed that obligation's
 * remaining balance (no overpayment/advance in V1). Partial payments are
 * first-class: the user lowers the amount below the remaining and the
 * obligation stays open until the sums meet. This is RECORDING payments —
 * Stožer never transfers money.
 */
export async function recordBulkPayments(
  _prev: FinanceActionState,
  formData: FormData
): Promise<FinanceActionState> {
  const org = await requireOrganization();
  const allowed = await hasPermission("first_team_finance.manage");
  if (!allowed) return { error: "Nemate dozvolu za evidentiranje isplata" };

  const period = z.string().regex(/^\d{4}-\d{2}$/).safeParse(formData.get("period"));
  const paidOn = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).safeParse(formData.get("paid_on"));
  const method = z.enum(["cash", "bank", "other"]).safeParse(formData.get("method"));
  if (!period.success || !paidOn.success || !method.success) {
    return { error: "Nevalidan unos isplate." };
  }
  const noteRaw = formData.get("note");
  const note = typeof noteRaw === "string" && noteRaw.trim() ? noteRaw.trim() : null;

  // The form submits amount_<athleteId> ONLY for checked players (unchecked
  // rows disable their field), so every submitted key is a player the user
  // explicitly selected. Raw strings are collected here; the strict checks
  // run after the obligations have been re-derived from the database.
  const rawAmounts = new Map<string, string>();
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("amount_")) continue;
    rawAmounts.set(
      key.slice("amount_".length),
      typeof value === "string" ? value : ""
    );
  }
  if (rawAmounts.size === 0) {
    return { error: "Izaberite najmanje jednog igrača za isplatu." };
  }

  const supabase = await createServerClient();
  const season = await getActiveSeason(supabase, org.organizationId);
  if (!season) return { error: "Nema aktivne sezone" };

  const competitionMonths = season.competition_months ?? null;

  // Ensure this month's obligations exist before recording against them (the
  // read path never writes; the mutation does).
  const contracts = await listFirstTeamContracts(supabase, org.organizationId, season.id);
  for (const contract of contracts) {
    await reconcileContractObligations(
      supabase,
      org.organizationId,
      contract,
      competitionMonths
    );
  }

  const eligible = await listBulkPaymentPlayers(
    supabase,
    org.organizationId,
    season.id,
    period.data,
    competitionMonths
  );

  // V1: recorded payments carry the club's single currency, never a
  // per-contract/per-player choice (amounts are not converted).
  const clubCurrency = await getOrganizationCurrency(org.organizationId);

  // Bind every submitted amount to the selected month's obligation: the
  // eligible rows are org-scoped and carry the obligation (player + contract +
  // period) they were derived from, so matching here proves the payment goes
  // to the right obligation. Anything else is rejected before any write.
  const amounts = new Map<string, number>();
  for (const [athleteId, raw] of rawAmounts) {
    const player = eligible.find((row) => row.athlete_id === athleteId);
    if (!player || !player.obligation_id) {
      return {
        error: "Isplata može da se evidentira samo za igrače sa obavezom za izabrani mesec.",
      };
    }
    const amount = Number(raw);
    if (!Number.isInteger(amount) || amount <= 0) {
      return {
        error: `${player.last_name} ${player.first_name}: iznos isplate mora biti veći od 0.`,
      };
    }
    const check = validatePaymentAmount(amount, player.remaining);
    if (!check.ok) {
      return {
        error: `${player.last_name} ${player.first_name}: ${check.error}`,
      };
    }
    amounts.set(player.athlete_id, amount);
  }

  let recorded = 0;
  for (const player of eligible) {
    const amount = amounts.get(player.athlete_id);
    if (!amount) continue; // unchecking a player = skip
    const { error } = await supabase.from("contract_payments").insert({
      organization_id: org.organizationId,
      obligation_id: player.obligation_id,
      contract_id: player.contract_id,
      athlete_id: player.athlete_id,
      amount,
      currency: clubCurrency,
      paid_on: paidOn.data,
      method: method.data,
      note,
      created_by: org.userId,
    });
    if (error) return { error: "Greška pri evidentiranju isplate. Pokušajte ponovo." };
    recorded += 1;
  }

  if (recorded === 0) {
    return { error: "Nema obaveza za evidentiranje za izabrani mesec." };
  }

  // Purge the team routes (the table lives under teams/[id]/payments) and the
  // player contract views whose obligations changed.
  revalidatePath("/teams", "layout");
  revalidatePath("/finance", "layout");
  revalidatePath("/players");
  return { ok: true };
}

/**
 * Reverse ONE recorded payment ("Poništi isplatu"). The row is never deleted —
 * it is stamped as reversed and drops out of every paid sum, so the
 * obligation's remaining balance and status re-derive automatically. The V1
 * correction flow for a wrong entry: reverse it here, then record a new,
 * correct payment (no edit-payment feature).
 * Requires the same first_team_finance.manage permission as recording (also
 * enforced by the 00028 RLS UPDATE policy). A payment that is already reversed
 * is a silent no-op: the conditional update matched zero rows, nothing else
 * changes (idempotent against double-submit/races).
 */
export async function reversePayment(formData: FormData): Promise<void> {
  const org = await requireOrganization();
  const allowed = await hasPermission("first_team_finance.manage");
  if (!allowed) throw new Error("Nemate dozvolu za evidentiranje isplata");

  const paymentId = z.string().uuid().safeParse(formData.get("payment_id"));
  const athleteId = z.string().uuid().safeParse(formData.get("athlete_id"));
  if (!paymentId.success || !athleteId.success) throw new Error("Nedostaje isplata");

  const supabase = await createServerClient();
  const result = await reversePaymentRecord(
    supabase,
    org.organizationId,
    paymentId.data,
    org.userId
  );
  // "already_reversed": the desired end state already holds — refresh and stop.
  if (result === "ok") {
    revalidatePath("/teams", "layout");
    revalidatePath("/finance", "layout");
  }
  revalidatePath(`/players/${athleteId.data}/contracts`);
}

/**
 * Server-side validation shared by individual and bulk adjustments: resolves
 * the athlete's active contract, makes sure the month's obligation exists, and
 * enforces the deduction floor against the CURRENT adjusted amount. Nothing is
 * written here — the caller writes only when every selected player passed, so a
 * single invalid player blocks the whole bulk action (no half-success).
 */
async function prepareObligationAdjustments(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  orgId: string,
  createdBy: string,
  athleteIds: string[],
  period: string,
  type: AdjustmentType,
  amount: number,
  reason: string,
  note: string | null
): Promise<{ ok: true; inputs: ObligationAdjustmentInput[] } | { ok: false; error: string }> {
  const season = await getActiveSeason(supabase, orgId);
  if (!season) return { ok: false, error: "Nema aktivne sezone" };

  const competitionMonths = season.competition_months ?? null;
  const contracts = await listFirstTeamContracts(supabase, orgId, season.id);
  const contractByAthlete = new Map(contracts.map((row) => [row.athlete_id, row]));

  const inputs: ObligationAdjustmentInput[] = [];
  for (const athleteId of athleteIds) {
    const contract = contractByAthlete.get(athleteId);
    if (!contract) {
      return { ok: false, error: "Aktivni ugovor igrača nije pronađen." };
    }
    const obligation = await ensureContractObligation(
      supabase,
      orgId,
      contract,
      period,
      competitionMonths
    );
    if (!obligation) {
      return {
        ok: false,
        error: `${contract.last_name} ${contract.first_name}: nema obaveze za izabrani mesec.`,
      };
    }
    const existing = await listObligationAdjustments(supabase, orgId, [obligation.id]);
    const currentAdjusted = adjustedExpectedAmount(
      obligation.expected_amount,
      adjustmentTotals(existing)
    );
    const check = validateAdjustmentAmount(amount, type, currentAdjusted);
    if (!check.ok) {
      return {
        ok: false,
        error: `${contract.last_name} ${contract.first_name}: ${check.error}`,
      };
    }
    inputs.push({
      obligation_id: obligation.id,
      type,
      amount,
      reason,
      note,
      created_by: createdBy,
    });
  }
  return { ok: true, inputs };
}

/**
 * Add monthly corrections (+bonus / -deduction) to ONE OR MORE selected
 * players at once, with the SAME amount applied to EACH selected player (it is
 * never split). The contracted salary (base) is untouched; only each month's
 * amount due moves.
 *
 * Atomic validation: every selected athlete/obligation is re-derived and
 * floor-checked server-side BEFORE anything is written. If any player fails,
 * nothing is inserted and the blocking player + reason are returned. Writes
 * happen only after all players passed, using the same sequential-insert
 * pattern as recordBulkPayments (supabase-js has no multi-statement
 * transaction; the validated all-or-nothing behaviour is the contract here).
 * Client selection/ids are never trusted. Requires first_team_finance.manage.
 */
export async function addBulkAdjustment(
  _prev: FinanceActionState,
  formData: FormData
): Promise<FinanceActionState> {
  const org = await requireOrganization();
  const allowed = await hasPermission("first_team_finance.manage");
  if (!allowed) return { error: "Nemate dozvolu za unos korekcija" };

  const period = z.string().regex(/^\d{4}-\d{2}$/).safeParse(formData.get("period"));
  const type = z.enum(ADJUSTMENT_TYPES).safeParse(formData.get("type"));
  const amount = z
    .number({ coerce: true })
    .int()
    .positive()
    .max(100_000_000)
    .safeParse(formData.get("amount"));
  const reason = z.string().trim().min(1).max(200).safeParse(formData.get("reason"));
  const athleteIds = z
    .array(z.string().uuid())
    .min(1)
    .max(200)
    .safeParse(formData.getAll("athlete_ids"));
  if (
    !period.success ||
    !type.success ||
    !amount.success ||
    !reason.success ||
    !athleteIds.success
  ) {
    return { error: "Nevalidan unos korekcije." };
  }
  // A player can only appear once per bulk action.
  const uniqueAthleteIds = [...new Set(athleteIds.data)];
  const noteRaw = formData.get("note");
  const note = typeof noteRaw === "string" && noteRaw.trim() ? noteRaw.trim().slice(0, 1000) : null;

  const supabase = await createServerClient();
  const prepared = await prepareObligationAdjustments(
    supabase,
    org.organizationId,
    org.userId,
    uniqueAthleteIds,
    period.data,
    type.data,
    amount.data,
    reason.data,
    note
  );
  if (!prepared.ok) return { error: prepared.error };

  // All selected players validated — now (and only now) write.
  for (const input of prepared.inputs) {
    const { error } = await createObligationAdjustment(supabase, org.organizationId, input);
    if (error) return { error: "Greška pri unosu korekcije. Pokušajte ponovo." };
  }

  revalidatePath("/teams", "layout");
  revalidatePath("/finance", "layout");
  revalidatePath("/players");
  return { ok: true };
}

/**
 * Individual correction = the same bulk action with exactly one selected
 * player. Kept as a thin wrapper so callers that only have one athlete id work
 * against the identical server-side validation path.
 */
export async function addObligationAdjustment(
  prev: FinanceActionState,
  formData: FormData
): Promise<FinanceActionState> {
  const bulk = new FormData();
  for (const [key, value] of formData.entries()) {
    if (key === "athlete_id") bulk.append("athlete_ids", value);
    else bulk.append(key, value);
  }
  return addBulkAdjustment(prev, bulk);
}

/**
 * Reverse ONE correction ("Poništi korekciju"). Same V1 UX as payment
 * reversal (00030): the row is stamped as reversed, never deleted, drops out
 * of the adjusted totals, and the month's remaining/status re-derive. An
 * already-reversed adjustment is a silent no-op — the conditional update
 * matched zero rows (safe against double-submit and races). No edit flow:
 * reverse the wrong one, then add a new one.
 */
export async function reverseObligationAdjustment(formData: FormData): Promise<void> {
  const org = await requireOrganization();
  const allowed = await hasPermission("first_team_finance.manage");
  if (!allowed) throw new Error("Nemate dozvolu za unos korekcija");

  const adjustmentId = z.string().uuid().safeParse(formData.get("adjustment_id"));
  const athleteId = z.string().uuid().safeParse(formData.get("athlete_id"));
  if (!adjustmentId.success || !athleteId.success) throw new Error("Nedostaje korekcija");

  const supabase = await createServerClient();
  const result = await reverseObligationAdjustmentRecord(
    supabase,
    org.organizationId,
    adjustmentId.data,
    org.userId
  );
  // "already_reversed": the desired end state already holds — refresh and stop.
  if (result === "ok") {
    revalidatePath("/teams", "layout");
    revalidatePath("/finance", "layout");
  }
  revalidatePath(`/players/${athleteId.data}/contracts`);
}

/** Save the season's competition-months list and reconcile affected contracts. */
export async function saveCompetitionMonths(formData: FormData) {
  const org = await requireOrganization();
  const allowed = await hasPermission("seasons.manage");
  if (!allowed) throw new Error("Nemate dozvolu za podešavanje sezone");

  const seasonId = z.string().uuid().parse(formData.get("season_id"));
  const months = formData
    .getAll("month")
    .map((v) => Number(v))
    .filter((n) => Number.isInteger(n) && n >= 1 && n <= 12)
    .reduce<number[]>((acc, n) => (acc.includes(n) ? acc : [...acc, n]), []);

  const supabase = await createServerClient();
  const { error } = await supabase
    .from("seasons")
    .update({ competition_months: months.length ? months : null })
    .eq("id", seasonId)
    .eq("organization_id", org.organizationId);
  if (error) throw new Error("Greška pri čuvanju takmičarskih meseci: " + error.message);

  // competition_months changes may add/remove months for contracts on the
  // 'competition_months' schedule — reconcile them (paid history preserved).
  await reconcileOrgContractObligations(
    supabase,
    org.organizationId,
    months.length ? months : null
  );

  revalidatePath("/seasons");
  revalidatePath("/teams");
  revalidatePath("/players");
}
