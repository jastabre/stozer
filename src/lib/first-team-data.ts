import type { Supabase } from "@/lib/club-data";
import {
  obligationMonthsFor,
  obligationState,
  periodKey,
  planObligationReconciliation,
  sumActivePayments,
  adjustmentTotals,
  adjustedExpectedAmount,
  monthStatusFor,
  type AdjustmentAmountRow,
  type AdjustmentType,
  type ContractFinance,
  type MonthObligationSummary,
  type MonthStatus,
  type ObligationStatus,
  type PaymentAmountRow,
} from "./first-team";

export interface FirstTeamContract extends ContractFinance {
  id: string;
  athlete_id: string;
  first_name: string;
  last_name: string;
  club_athlete_number: number;
  jersey_number: number | null;
  status: string;
}

export interface ObligationRow {
  id: string;
  contract_id: string;
  athlete_id: string;
  period: string;
  expected_amount: number;
  currency: string;
  paid: number;
}

interface MembershipJoin {
  athlete_id: string;
  jersey_number: number | null;
  athletes: {
    first_name: string;
    last_name: string;
    club_athlete_number: number;
  } | null;
}

interface ObligationRowDB {
  id: string;
  contract_id: string;
  athlete_id: string;
  period: string;
  expected_amount: number;
  currency: string;
}

/** Payment row as fetched for paid-sum aggregation. */
type PaidSumRow = PaymentAmountRow & { obligation_id: string };

/** Adjustment row as fetched for adjusted-total aggregation. */
type AdjustmentSumRow = AdjustmentAmountRow & { obligation_id: string };

/** Paid-sum row plus the identity fields the payment list needs. */
type ObligationPaymentRow = PaidSumRow & {
  id: string;
  currency: string | null;
  paid_on: string;
  method: string;
  note: string | null;
};

/**
 * All active-season memberships whose athletes have an active first-team
 * contract with a salary. Drives the bulk payment workflow.
 */
export async function listFirstTeamContracts(
  supabase: Supabase,
  orgId: string,
  seasonId: string
): Promise<FirstTeamContract[]> {
  const { data: memberships } = await supabase
    .from("seasonal_memberships")
    .select(
      "athlete_id, jersey_number, athletes!seasonal_memberships_athlete_id_fkey(first_name, last_name, club_athlete_number)"
    )
    .eq("organization_id", orgId)
    .eq("season_id", seasonId)
    .eq("status", "active");

  const memberRows = (memberships ?? []) as unknown as MembershipJoin[];
  const memberAthleteIds = memberRows.map((m) => m.athlete_id);
  if (memberAthleteIds.length === 0) return [];

  const { data: contracts } = await supabase
    .from("contracts")
    .select("*")
    .eq("organization_id", orgId)
    .in("athlete_id", memberAthleteIds)
    .eq("status", "active");

  const athleteBy = new Map(
    memberRows.map((m) => [
      m.athlete_id,
      m.athletes ?? {
        first_name: "",
        last_name: "",
        club_athlete_number: 0,
      },
    ])
  );
  const jerseyBy = new Map(
    memberRows.map((m) => [m.athlete_id, m.jersey_number])
  );

  return (contracts ?? [])
    .filter((c) => c.monthly_salary != null && c.monthly_salary > 0)
    .map((c) => {
      const athlete = athleteBy.get(c.athlete_id) ?? {
        first_name: "",
        last_name: "",
        club_athlete_number: 0,
      };
      return {
        id: c.id,
        athlete_id: c.athlete_id,
        first_name: athlete.first_name,
        last_name: athlete.last_name,
        club_athlete_number: athlete.club_athlete_number,
        jersey_number: jerseyBy.get(c.athlete_id) ?? null,
        valid_from: c.valid_from,
        valid_until: c.valid_until,
        monthly_salary: c.monthly_salary,
        currency: c.currency ?? "RSD",
        pay_schedule: (c.pay_schedule ?? "all_year") as ContractFinance["pay_schedule"],
        custom_months: c.custom_months ?? null,
        status: c.status,
      };
    });
}

export interface ReconcileContract extends ContractFinance {
  id: string;
  athlete_id: string;
}

interface ContractDateRow {
  id: string;
  athlete_id: string;
  valid_from: string | null;
  valid_until: string | null;
  monthly_salary: number | null;
  currency: string | null;
  pay_schedule: string | null;
  custom_months: number[] | null;
}

/**
 * Reconcile a contract's generated obligations with its CURRENT terms, without
 * ever touching an obligation that has payment history. Removes/updates only
 * unpaid obligations, inserts newly scheduled ones, and keeps paid months as-is.
 * Replaces the old blind `upsert(ignoreDuplicates)` that left stale amounts.
 */
export async function reconcileContractObligations(
  supabase: Supabase,
  orgId: string,
  contract: ReconcileContract,
  competitionMonths: number[] | null
): Promise<void> {
  const desiredPeriods = obligationMonthsFor(contract, {
    competition_months: competitionMonths,
  }).map((m) => periodKey(m.year, m.month));

  const { data: existingRows } = await supabase
    .from("salary_obligations")
    .select("id, period, expected_amount, currency")
    .eq("organization_id", orgId)
    .eq("contract_id", contract.id);

  const existing = (existingRows ?? []) as unknown as {
    id: string;
    period: string;
    expected_amount: number;
    currency: string;
  }[];

  const rowsByObligation = new Map<string, PaymentAmountRow[]>();
  const adjustmentsByObligation = new Map<string, AdjustmentAmountRow[]>();
  if (existing.length > 0) {
    const obligationIds = existing.map((row) => row.id);
    const { data: payments } = await supabase
      .from("contract_payments")
      .select("obligation_id, amount, reversed_at")
      .eq("organization_id", orgId)
      .in("obligation_id", obligationIds);
    for (const payment of (payments ?? []) as unknown as PaidSumRow[]) {
      const rows = rowsByObligation.get(payment.obligation_id) ?? [];
      rows.push(payment);
      rowsByObligation.set(payment.obligation_id, rows);
    }

    const { data: adjustments } = await supabase
      .from("salary_obligation_adjustments")
      .select("obligation_id, type, amount, reversed_at")
      .eq("organization_id", orgId)
      .in("obligation_id", obligationIds);
    for (const adjustment of (adjustments ?? []) as unknown as AdjustmentSumRow[]) {
      const rows = adjustmentsByObligation.get(adjustment.obligation_id) ?? [];
      rows.push(adjustment);
      adjustmentsByObligation.set(adjustment.obligation_id, rows);
    }
  }

  const plan = planObligationReconciliation(
    desiredPeriods,
    existing.map((row) => {
      const payments = rowsByObligation.get(row.id) ?? [];
      const adjustments = adjustmentsByObligation.get(row.id) ?? [];
      const totals = adjustmentTotals(adjustments);
      return {
        ...row,
        // Reversed payments are excluded from the paid sum, but the rows
        // themselves count as history: an obligation whose payments were ALL
        // reversed still holds the financial evidence and is never rewritten.
        paid: sumActivePayments(payments),
        hasHistory: payments.length > 0,
        // Same for adjustments (active or reversed): they pin the obligation
        // against deletion. The base may still be updated unless the active
        // deduction floor would break.
        hasAdjustments: adjustments.length > 0,
        adjustmentNet: totals.bonus - totals.deduction,
      };
    }),
    contract.monthly_salary ?? 0,
    contract.currency
  );

  if (plan.remove.length > 0) {
    await supabase
      .from("salary_obligations")
      .delete()
      .eq("organization_id", orgId)
      .in("id", plan.remove);
  }

  for (const update of plan.update) {
    await supabase
      .from("salary_obligations")
      .update({ expected_amount: update.expected, currency: update.currency })
      .eq("organization_id", orgId)
      .eq("id", update.id);
  }

  if (plan.insert.length > 0) {
    await supabase.from("salary_obligations").upsert(
      plan.insert.map((row) => ({
        organization_id: orgId,
        contract_id: contract.id,
        athlete_id: contract.athlete_id,
        period: row.period,
        period_start: `${row.period}-01`,
        expected_amount: row.expected,
        currency: row.currency,
      })),
      { onConflict: "contract_id,period", ignoreDuplicates: true }
    );
  }
}

/** Reconcile every active contract in the org (used when competition months change). */
export async function reconcileOrgContractObligations(
  supabase: Supabase,
  orgId: string,
  competitionMonths: number[] | null
): Promise<void> {
  const { data } = await supabase
    .from("contracts")
    .select(
      "id, athlete_id, valid_from, valid_until, monthly_salary, currency, pay_schedule, custom_months"
    )
    .eq("organization_id", orgId)
    .eq("status", "active");

  for (const row of (data ?? []) as unknown as ContractDateRow[]) {
    if (row.monthly_salary == null || row.monthly_salary <= 0) continue;
    await reconcileContractObligations(
      supabase,
      orgId,
      {
        id: row.id,
        athlete_id: row.athlete_id,
        valid_from: row.valid_from,
        valid_until: row.valid_until,
        monthly_salary: row.monthly_salary,
        currency: row.currency ?? "RSD",
        pay_schedule: (row.pay_schedule ??
          "all_year") as ContractFinance["pay_schedule"],
        custom_months: row.custom_months ?? null,
      },
      competitionMonths
    );
  }
}

export interface ObligationAdjustmentRecord {
  id: string;
  type: AdjustmentType;
  amount: number;
  reason: string;
  note: string | null;
  created_at: string;
  /** Set when the adjustment was reversed ("Poništi korekciju"); row stays as evidence. */
  reversed_at: string | null;
  reversal_note: string | null;
}

export interface AthleteObligation {
  id: string;
  period: string;
  /** Contracted base amount for the month (never changed by adjustments). */
  base: number;
  /** Active bonus total. */
  bonus: number;
  /** Active deduction total (positive number). */
  deduction: number;
  /** base + bonus - deduction (floored at 0). */
  adjusted: number;
  paid: number;
  remaining: number;
  status: ObligationStatus;
  /** All corrections, oldest first, including reversed ones (history). */
  adjustments: ObligationAdjustmentRecord[];
}

/**
 * Obligations for one athlete with active paid/adjusted sums, newest first.
 * Reversed payments and reversed adjustments never count toward the totals,
 * but their rows are returned in the history.
 */
export async function listAthleteObligations(
  supabase: Supabase,
  orgId: string,
  athleteId: string,
  now?: Date
): Promise<AthleteObligation[]> {
  const { data: obligations } = await supabase
    .from("salary_obligations")
    .select("*")
    .eq("organization_id", orgId)
    .eq("athlete_id", athleteId)
    .order("period_start", { ascending: false });

  const rows = (obligations ?? []) as unknown as ObligationRowDB[];
  if (rows.length === 0) return [];
  const obligationIds = rows.map((row) => row.id);

  const { data: payments } = await supabase
    .from("contract_payments")
    .select("obligation_id, amount, reversed_at")
    .eq("organization_id", orgId)
    .in("obligation_id", obligationIds);
  const paymentsByObligation = new Map<string, PaymentAmountRow[]>();
  for (const payment of (payments ?? []) as unknown as PaidSumRow[]) {
    const list = paymentsByObligation.get(payment.obligation_id) ?? [];
    list.push(payment);
    paymentsByObligation.set(payment.obligation_id, list);
  }

  const { data: adjustments } = await supabase
    .from("salary_obligation_adjustments")
    .select(
      "id, obligation_id, type, amount, reason, note, created_at, reversed_at, reversal_note"
    )
    .eq("organization_id", orgId)
    .in("obligation_id", obligationIds)
    .order("created_at", { ascending: true });
  const adjustmentsByObligation = new Map<string, ObligationAdjustmentRecord[]>();
  for (const adjustment of (adjustments ?? []) as unknown as (ObligationAdjustmentRecord & {
    obligation_id: string;
  })[]) {
    const list = adjustmentsByObligation.get(adjustment.obligation_id) ?? [];
    list.push(adjustment);
    adjustmentsByObligation.set(adjustment.obligation_id, list);
  }

  return rows.map((row) => {
    const adjustmentRows = adjustmentsByObligation.get(row.id) ?? [];
    const totals = adjustmentTotals(adjustmentRows);
    const adjusted = adjustedExpectedAmount(row.expected_amount, totals);
    // Reversed payments ("Poništi isplatu") never count toward the paid sum,
    // so remaining and status re-derive from the active rows only.
    const paid = sumActivePayments(paymentsByObligation.get(row.id) ?? []);
    const state = obligationState(row.period, adjusted, paid, now);
    return {
      id: row.id,
      period: row.period,
      base: row.expected_amount,
      bonus: totals.bonus,
      deduction: totals.deduction,
      adjusted,
      paid,
      remaining: state.remaining,
      status: state.status,
      adjustments: adjustmentRows,
    };
  });
}

export interface PaymentRecord {
  id: string;
  period: string;
  amount: number;
  currency: string;
  paid_on: string;
  method: string;
  note: string | null;
  /** Set when the payment was reversed ("Poništi isplatu"); row stays as evidence. */
  reversed_at: string | null;
  reversal_note: string | null;
}

/** Payments recorded against an athlete's obligations, newest first. */
export async function listAthletePayments(
  supabase: Supabase,
  orgId: string,
  athleteId: string
): Promise<PaymentRecord[]> {
  const { data: payments } = await supabase
    .from("contract_payments")
    .select(
      "id, amount, currency, paid_on, method, note, reversed_at, reversal_note, salary_obligations!contract_payments_obligation_id_fkey(period)"
    )
    .eq("organization_id", orgId)
    .eq("athlete_id", athleteId)
    .order("paid_on", { ascending: false });

  return (payments ?? []).map((p) => ({
    id: p.id,
    period: (p.salary_obligations as unknown as { period: string } | null)?.period ?? "",
    amount: Number(p.amount),
    currency: p.currency ?? "RSD",
    paid_on: p.paid_on,
    method: p.method,
    note: p.note,
    reversed_at: p.reversed_at,
    reversal_note: p.reversal_note,
  }));
}

export type ReversePaymentResult = "ok" | "already_reversed";

/**
 * Reverse one recorded payment: stamps the reversal markers, NEVER deletes the
 * row. The conditional `reversed_at IS NULL` update makes this idempotent-safe
 * against double-submit/races — a second reversal matches zero rows and the
 * payment is reported as already reversed.
 */
export async function reversePaymentRecord(
  supabase: Supabase,
  orgId: string,
  paymentId: string,
  userId: string
): Promise<ReversePaymentResult> {
  const { data, error } = await supabase
    .from("contract_payments")
    .update({ reversed_at: new Date().toISOString(), reversed_by: userId })
    .eq("id", paymentId)
    .eq("organization_id", orgId)
    .is("reversed_at", null)
    .select("id");
  if (error) throw new Error("Greška pri poništavanju isplate: " + error.message);
  return data && data.length > 0 ? "ok" : "already_reversed";
}

/** All adjustments for the given obligations (active and reversed). */
export async function listObligationAdjustments(
  supabase: Supabase,
  orgId: string,
  obligationIds: string[]
): Promise<ObligationAdjustmentRecord[]> {
  if (obligationIds.length === 0) return [];
  const { data } = await supabase
    .from("salary_obligation_adjustments")
    .select("id, type, amount, reason, note, created_at, reversed_at, reversal_note")
    .eq("organization_id", orgId)
    .in("obligation_id", obligationIds)
    .order("created_at", { ascending: true });
  return (data ?? []) as unknown as ObligationAdjustmentRecord[];
}

export interface ObligationAdjustmentInput {
  obligation_id: string;
  type: AdjustmentType;
  amount: number;
  reason: string;
  note: string | null;
  created_by: string;
}

/** Record one adjustment (+bonus / -deduction) against an obligation. */
export async function createObligationAdjustment(
  supabase: Supabase,
  orgId: string,
  input: ObligationAdjustmentInput
): Promise<{ error: string | null }> {
  const { error } = await supabase.from("salary_obligation_adjustments").insert({
    organization_id: orgId,
    ...input,
  });
  return { error: error?.message ?? null };
}

/**
 * Reverse one adjustment: stamps reversed_at/reversed_by, NEVER deletes the
 * row (00030 pattern). A second reversal matches zero rows because of the
 * `reversed_at IS NULL` filter and is reported as already reversed.
 */
export async function reverseObligationAdjustmentRecord(
  supabase: Supabase,
  orgId: string,
  adjustmentId: string,
  userId: string
): Promise<ReversePaymentResult> {
  const { data, error } = await supabase
    .from("salary_obligation_adjustments")
    .update({ reversed_at: new Date().toISOString(), reversed_by: userId })
    .eq("id", adjustmentId)
    .eq("organization_id", orgId)
    .is("reversed_at", null)
    .select("id");
  if (error) throw new Error("Greška pri poništavanju korekcije: " + error.message);
  return data && data.length > 0 ? "ok" : "already_reversed";
}

export interface ObligationRef {
  id: string;
  expected_amount: number;
  currency: string;
}

/**
 * Make sure the contract's obligation for the period exists (reconcile the
 * contract first) and return it. Adjustments can only be attached to a
 * persisted obligation, so this is the mutation-path "get or create".
 * Returns null when the period is not part of the contract's schedule.
 */
export async function ensureContractObligation(
  supabase: Supabase,
  orgId: string,
  contract: ReconcileContract,
  period: string,
  competitionMonths: number[] | null
): Promise<ObligationRef | null> {
  await reconcileContractObligations(supabase, orgId, contract, competitionMonths);
  const { data } = await supabase
    .from("salary_obligations")
    .select("id, expected_amount, currency")
    .eq("organization_id", orgId)
    .eq("contract_id", contract.id)
    .eq("period", period)
    .maybeSingle();
  return data ?? null;
}

export interface ContractPaymentInput {
  organization_id: string;
  obligation_id: string;
  contract_id: string;
  athlete_id: string;
  amount: number;
  currency: string;
  paid_on: string;
  method: "cash" | "bank" | "other";
  note: string | null;
  created_by: string;
}

/** Record a single payment against an obligation. */
export async function recordPayment(
  supabase: Supabase,
  orgId: string,
  input: Omit<ContractPaymentInput, "organization_id">
): Promise<{ error: string | null }> {
  const { error } = await supabase.from("contract_payments").insert({
    organization_id: orgId,
    ...input,
  });
  return { error: error?.message ?? null };
}

export interface BulkPaymentPlayer {
  athlete_id: string;
  first_name: string;
  last_name: string;
  club_athlete_number: number;
  jersey_number: number | null;
  /** Null until the obligation is persisted (reconcile runs on the mutation). */
  obligation_id: string | null;
  contract_id: string;
  period: string;
  /** Contracted base amount (salary_obligations.expected_amount). */
  base: number;
  /** Active bonus total. */
  bonus: number;
  /** Active deduction total (positive number). */
  deduction: number;
  /** base + bonus - deduction — what is actually due for the month. */
  adjusted: number;
  paid: number;
  remaining: number;
  currency: string;
  status: ObligationStatus;
  /** All payments recorded for this period (active AND reversed), newest first. */
  recorded_payments: {
    id: string;
    amount: number;
    currency: string;
    paid_on: string;
    method: string;
    note: string | null;
    reversed_at: string | null;
  }[];
  /** All corrections for the obligation, oldest first, including reversed ones. */
  adjustments: ObligationAdjustmentRecord[];
}

/**
 * Read-only bulk payment view for one period: all active-season first-team
 * contracts whose schedule includes that month, each with expected/paid/
 * remaining and the derived status. Obligations are NOT written here — the
 * mutation (recordBulkPayments) reconciles them first. A missing persisted
 * obligation is shown from the contract terms so the screen is never blank.
 */
export async function listBulkPaymentPlayers(
  supabase: Supabase,
  orgId: string,
  seasonId: string,
  period: string,
  competitionMonths: number[] | null,
  now?: Date
): Promise<BulkPaymentPlayer[]> {
  const contracts = await listFirstTeamContracts(supabase, orgId, seasonId);
  const candidates = contracts.filter((contract) =>
    obligationMonthsFor(contract, {
      competition_months: competitionMonths,
    }).some((m) => periodKey(m.year, m.month) === period)
  );
  if (candidates.length === 0) return [];

  const { data: obligations } = await supabase
    .from("salary_obligations")
    .select("*")
    .eq("organization_id", orgId)
    .eq("period", period)
    .in(
      "contract_id",
      candidates.map((contract) => contract.id)
    );
  const obligationByContract = new Map<string, ObligationRowDB>();
  for (const obligation of (obligations ?? []) as unknown as ObligationRowDB[]) {
    obligationByContract.set(obligation.contract_id, obligation);
  }

  const paymentsByObligation = new Map<string, ObligationPaymentRow[]>();
  const adjustmentsByObligation = new Map<string, ObligationAdjustmentRecord[]>();
  const obligationIds = [...obligationByContract.values()].map((o) => o.id);
  if (obligationIds.length > 0) {
    const { data: payments } = await supabase
      .from("contract_payments")
      .select("id, obligation_id, amount, currency, paid_on, method, note, reversed_at")
      .eq("organization_id", orgId)
      .in("obligation_id", obligationIds);
    for (const payment of (payments ?? []) as unknown as ObligationPaymentRow[]) {
      const rows = paymentsByObligation.get(payment.obligation_id) ?? [];
      rows.push(payment);
      paymentsByObligation.set(payment.obligation_id, rows);
    }

    const { data: adjustments } = await supabase
      .from("salary_obligation_adjustments")
      .select(
        "id, obligation_id, type, amount, reason, note, created_at, reversed_at, reversal_note"
      )
      .eq("organization_id", orgId)
      .in("obligation_id", obligationIds)
      .order("created_at", { ascending: true });
    for (const adjustment of (adjustments ?? []) as unknown as (ObligationAdjustmentRecord & {
      obligation_id: string;
    })[]) {
      const rows = adjustmentsByObligation.get(adjustment.obligation_id) ?? [];
      rows.push(adjustment);
      adjustmentsByObligation.set(adjustment.obligation_id, rows);
    }
  }

  const out: BulkPaymentPlayer[] = [];
  for (const contract of candidates) {
    const obligation = obligationByContract.get(contract.id) ?? null;
    const base = obligation?.expected_amount ?? contract.monthly_salary ?? 0;
    const currency = obligation?.currency ?? contract.currency;
    // Active payments only: reversed entries are evidence, not money paid.
    const paid = obligation
      ? sumActivePayments(paymentsByObligation.get(obligation.id) ?? [])
      : 0;
    // Active adjustments only: reversed corrections do not move the total.
    const adjustments = obligation
      ? adjustmentsByObligation.get(obligation.id) ?? []
      : [];
    const totals = adjustmentTotals(adjustments);
    const adjusted = adjustedExpectedAmount(base, totals);
    const state = obligationState(period, adjusted, paid, now);

    out.push({
      athlete_id: contract.athlete_id,
      first_name: contract.first_name,
      last_name: contract.last_name,
      club_athlete_number: contract.club_athlete_number,
      jersey_number: contract.jersey_number,
      obligation_id: obligation?.id ?? null,
      contract_id: contract.id,
      period,
      base,
      bonus: totals.bonus,
      deduction: totals.deduction,
      adjusted,
      paid,
      remaining: state.remaining,
      currency,
      status: state.status,
      recorded_payments: (paymentsByObligation.get(obligation?.id ?? "") ?? [])
        .sort((a, b) => b.paid_on.localeCompare(a.paid_on))
        .map((p) => ({
          id: p.id,
          amount: Number(p.amount),
          currency: p.currency ?? "RSD",
          paid_on: p.paid_on,
          method: p.method,
          note: p.note,
          // Presentation only: reversed rows stay in the history (audit) and
          // are excluded from the paid sum above via sumActivePayments.
          reversed_at: p.reversed_at ?? null,
        })),
      adjustments,
    });
  }

  return out.sort((a, b) => a.last_name.localeCompare(b.last_name));
}

/** One month of the season overview (players WITHOUT an obligation are not counted). */
export interface SeasonPaymentMonth {
  period: string;
  playerCount: number;
  /** Players whose obligation for the month is settled. */
  paidCount: number;
  partialCount: number;
  unpaidCount: number;
  expected: number;
  paid: number;
  remaining: number;
  status: MonthStatus;
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** The active season's identity + month window (selection is window-scoped). */
export interface SeasonWindow {
  id: string;
  starts_on: string | null;
  ends_on: string | null;
}

/** Month keys ('YYYY-MM') covered by the season window (UTC, inclusive). */
function seasonPeriodKeys(season: SeasonWindow): Set<string> {
  const out = new Set<string>();
  if (!season.starts_on) return out;
  const start = new Date(`${season.starts_on}T00:00:00Z`);
  const end = season.ends_on
    ? new Date(`${season.ends_on}T00:00:00Z`)
    : new Date(Date.UTC(start.getUTCFullYear() + 1, start.getUTCMonth(), 1));
  const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
  const last = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1));
  while (cursor <= last) {
    out.add(periodKey(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1));
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    if (out.size > 60) break; // safety cap
  }
  return out;
}

/**
 * The season overview: one row per obligation month OF THE ACTIVE SEASON that
 * actually has players, with the month's totals and paid/unpaid player counts.
 * Built from the same obligation/payment/adjustment sources as the month
 * detail, in a handful of queries for the whole season (no per-month round
 * trip, no matrix). Only months with at least one obligation are returned.
 */
export async function listSeasonPaymentMonths(
  supabase: Supabase,
  orgId: string,
  season: SeasonWindow,
  competitionMonths: number[] | null,
  now?: Date
): Promise<SeasonPaymentMonth[]> {
  const contracts = await listFirstTeamContracts(supabase, orgId, season.id);
  if (contracts.length === 0) return [];

  // Which contracts owe for which month: contract dates + pay schedule, kept
  // inside the active season window only (contracts can span multiple years).
  const window = seasonPeriodKeys(season);
  const periodContracts = new Map<string, FirstTeamContract[]>();
  for (const contract of contracts) {
    const months = obligationMonthsFor(contract, {
      competition_months: competitionMonths,
    });
    for (const m of months) {
      const key = periodKey(m.year, m.month);
      if (!window.has(key)) continue;
      const list = periodContracts.get(key);
      if (list) list.push(contract);
      else periodContracts.set(key, [contract]);
    }
  }
  if (periodContracts.size === 0) return [];

  const contractIds = contracts.map((contract) => contract.id);
  const { data: obligationRows } = await supabase
    .from("salary_obligations")
    .select("id, contract_id, period, expected_amount")
    .eq("organization_id", orgId)
    .in("contract_id", contractIds);

  const obligationByContractPeriod = new Map<string, ObligationRowDB>();
  for (const row of (obligationRows ?? []) as unknown as ObligationRowDB[]) {
    obligationByContractPeriod.set(`${row.contract_id}:${row.period}`, row);
  }
  const obligationIds = [...obligationByContractPeriod.values()].map((row) => row.id);

  const paymentsByObligation = new Map<string, PaymentAmountRow[]>();
  const adjustmentsByObligation = new Map<string, AdjustmentAmountRow[]>();
  if (obligationIds.length > 0) {
    // Payments carry contract_id, so the whole season is one query.
    const { data: payments } = await supabase
      .from("contract_payments")
      .select("obligation_id, amount, reversed_at")
      .eq("organization_id", orgId)
      .in("contract_id", contractIds);
    for (const payment of (payments ?? []) as unknown as PaidSumRow[]) {
      const list = paymentsByObligation.get(payment.obligation_id);
      if (list) list.push(payment);
      else paymentsByObligation.set(payment.obligation_id, [payment]);
    }

    // Adjustments only carry obligation_id — chunked .in() keeps the URL sane.
    for (const ids of chunkArray(obligationIds, 100)) {
      const { data: adjustments } = await supabase
        .from("salary_obligation_adjustments")
        .select("obligation_id, type, amount, reversed_at")
        .eq("organization_id", orgId)
        .in("obligation_id", ids);
      for (const adjustment of (adjustments ?? []) as unknown as AdjustmentSumRow[]) {
        const list = adjustmentsByObligation.get(adjustment.obligation_id);
        if (list) list.push(adjustment);
        else adjustmentsByObligation.set(adjustment.obligation_id, [adjustment]);
      }
    }
  }

  const months: SeasonPaymentMonth[] = [];
  for (const [period, monthContracts] of periodContracts) {
    const summary: MonthObligationSummary = {
      playerCount: 0,
      paidCount: 0,
      partialCount: 0,
      unpaidCount: 0,
      lateCount: 0,
      expected: 0,
      paid: 0,
      remaining: 0,
    };

    for (const contract of monthContracts) {
      const obligation =
        obligationByContractPeriod.get(`${contract.id}:${period}`) ?? null;
      const base = obligation?.expected_amount ?? contract.monthly_salary ?? 0;
      const adjustments = obligation
        ? adjustmentsByObligation.get(obligation.id) ?? []
        : [];
      const adjusted = adjustedExpectedAmount(base, adjustmentTotals(adjustments));
      const paid = obligation
        ? sumActivePayments(paymentsByObligation.get(obligation.id) ?? [])
        : 0;
      const state = obligationState(period, adjusted, paid, now);

      summary.playerCount += 1;
      summary.expected += adjusted;
      summary.paid += paid;
      summary.remaining += state.remaining;
      if (state.status === "paid") summary.paidCount += 1;
      else if (state.status === "partial") summary.partialCount += 1;
      else {
        summary.unpaidCount += 1;
        if (state.status === "late") summary.lateCount += 1;
      }
    }

    months.push({
      period,
      playerCount: summary.playerCount,
      paidCount: summary.paidCount,
      partialCount: summary.partialCount,
      unpaidCount: summary.unpaidCount,
      expected: summary.expected,
      paid: summary.paid,
      remaining: summary.remaining,
      status: monthStatusFor(summary, period, now),
    });
  }

  return months.sort((a, b) => a.period.localeCompare(b.period));
}

/**
 * Distinct count of ACTIVE-SEASON players who currently have at least one due
 * (non-future) obligation that is not fully settled. A player owing several
 * months is counted once. Reuses the canonical contract/obligation/payment
 * model — no separate finance math for the dashboard.
 *
 * "Due" here means the obligation's month has arrived (current month or
 * earlier), matching the season-overview "not future" boundary; future months
 * never count. An obligation with any open balance (paid < adjusted) counts,
 * so a partially-paid month still means the player needs attention.
 */
export async function countPlayersWithDueUnpaidObligations(
  supabase: Supabase,
  orgId: string,
  season: SeasonWindow,
  competitionMonths: number[] | null,
  now?: Date
): Promise<number> {
  const contracts = await listFirstTeamContracts(supabase, orgId, season.id);
  if (contracts.length === 0) return 0;

  const window = seasonPeriodKeys(season);
  const today = now ?? new Date();
  const currentPeriod = periodKey(today.getFullYear(), today.getMonth() + 1);

  // Which due (non-future) periods each contract owes inside the season window.
  const duePeriodsByContract = new Map<string, Set<string>>();
  for (const contract of contracts) {
    const due = new Set<string>();
    for (const m of obligationMonthsFor(contract, {
      competition_months: competitionMonths,
    })) {
      const key = periodKey(m.year, m.month);
      if (window.has(key) && key <= currentPeriod) due.add(key);
    }
    if (due.size > 0) duePeriodsByContract.set(contract.id, due);
  }
  if (duePeriodsByContract.size === 0) return 0;

  const contractIds = [...duePeriodsByContract.keys()];
  const { data: obligationRows } = await supabase
    .from("salary_obligations")
    .select("id, contract_id, period, expected_amount")
    .eq("organization_id", orgId)
    .in("contract_id", contractIds);

  const obligationByContractPeriod = new Map<string, ObligationRowDB>();
  for (const row of (obligationRows ?? []) as unknown as ObligationRowDB[]) {
    obligationByContractPeriod.set(`${row.contract_id}:${row.period}`, row);
  }
  const obligationIds = [...obligationByContractPeriod.values()].map((row) => row.id);

  const paymentsByObligation = new Map<string, PaymentAmountRow[]>();
  const adjustmentsByObligation = new Map<string, AdjustmentAmountRow[]>();
  if (obligationIds.length > 0) {
    const { data: payments } = await supabase
      .from("contract_payments")
      .select("obligation_id, amount, reversed_at")
      .eq("organization_id", orgId)
      .in("contract_id", contractIds);
    for (const payment of (payments ?? []) as unknown as PaidSumRow[]) {
      const list = paymentsByObligation.get(payment.obligation_id);
      if (list) list.push(payment);
      else paymentsByObligation.set(payment.obligation_id, [payment]);
    }

    for (const ids of chunkArray(obligationIds, 100)) {
      const { data: adjustments } = await supabase
        .from("salary_obligation_adjustments")
        .select("obligation_id, type, amount, reversed_at")
        .eq("organization_id", orgId)
        .in("obligation_id", ids);
      for (const adjustment of (adjustments ?? []) as unknown as AdjustmentSumRow[]) {
        const list = adjustmentsByObligation.get(adjustment.obligation_id);
        if (list) list.push(adjustment);
        else adjustmentsByObligation.set(adjustment.obligation_id, [adjustment]);
      }
    }
  }

  const playersWithOpenDue = new Set<string>();
  for (const contract of contracts) {
    const due = duePeriodsByContract.get(contract.id);
    if (!due) continue;
    for (const period of due) {
      const obligation =
        obligationByContractPeriod.get(`${contract.id}:${period}`) ?? null;
      const base = obligation?.expected_amount ?? contract.monthly_salary ?? 0;
      const adjustments = obligation
        ? adjustmentsByObligation.get(obligation.id) ?? []
        : [];
      const adjusted = adjustedExpectedAmount(base, adjustmentTotals(adjustments));
      const paid = obligation
        ? sumActivePayments(paymentsByObligation.get(obligation.id) ?? [])
        : 0;
      if (adjusted > paid) {
        playersWithOpenDue.add(contract.athlete_id);
        break;
      }
    }
  }

  return playersWithOpenDue.size;
}