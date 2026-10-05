import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import {
  monthStatusFor,
  obligationState,
  periodKey,
  planObligationReconciliation,
  sumActivePayments,
  type MonthObligationSummary,
  type MonthStatus,
  type ObligationStatus,
  type PaymentAmountRow,
} from "./first-team";
import {
  hasStaffCompensation,
  staffPeriodKeys,
  type StaffCompensationTerms,
} from "./staff-finance";

type Supabase = SupabaseClient<Database>;

/** One club function of a staff member, as stored (localized at render). */
export interface StaffFunctionRef {
  function_key: string;
  custom_label: string | null;
}

/** A staff compensation row joined with the person's name and functions. */
export interface StaffCompensationView extends StaffCompensationTerms {
  id: string;
  staff_id: string;
  first_name: string;
  last_name: string;
  note: string | null;
  functions: StaffFunctionRef[];
}

interface StaffCompensationDBRow {
  id: string;
  staff_id: string;
  monthly_amount: number | null;
  currency: string;
  valid_from: string | null;
  valid_until: string | null;
  note: string | null;
}

/**
 * Every staff compensation in the organization with the person's name and club
 * functions, ordered by name. Includes "Bez naknade" rows (monthly_amount NULL)
 * so the profile editor can render the current state; money screens filter
 * those out via hasStaffCompensation().
 */
export async function listStaffCompensations(
  supabase: Supabase,
  orgId: string
): Promise<StaffCompensationView[]> {
  const { data: comps } = await supabase
    .from("staff_compensations")
    .select(
      "id, staff_id, monthly_amount, currency, valid_from, valid_until, note, staff(first_name, last_name)"
    )
    .eq("organization_id", orgId);

  const rows = (comps ?? []) as unknown as (StaffCompensationDBRow & {
    staff: { first_name: string; last_name: string } | null;
  })[];

  const staffIds = rows.map((row) => row.staff_id);
  const { data: functions } =
    staffIds.length > 0
      ? await supabase
          .from("staff_functions")
          .select("staff_id, function_key, custom_label")
          .eq("organization_id", orgId)
          .in("staff_id", staffIds)
          .order("created_at")
      : { data: [] };

  const functionsByStaff = new Map<string, StaffFunctionRef[]>();
  for (const row of functions ?? []) {
    const list = functionsByStaff.get(row.staff_id) ?? [];
    list.push({ function_key: row.function_key, custom_label: row.custom_label });
    functionsByStaff.set(row.staff_id, list);
  }

  return rows
    .map((row) => ({
      id: row.id,
      staff_id: row.staff_id,
      first_name: row.staff?.first_name ?? "",
      last_name: row.staff?.last_name ?? "",
      monthly_amount: row.monthly_amount,
      currency: row.currency ?? "RSD",
      valid_from: row.valid_from,
      valid_until: row.valid_until,
      note: row.note,
      functions: functionsByStaff.get(row.staff_id) ?? [],
    }))
    .sort(
      (a, b) =>
        a.last_name.localeCompare(b.last_name) ||
        a.first_name.localeCompare(b.first_name)
    );
}

/** The single compensation of one staff member (or null if none saved yet). */
export async function getStaffCompensation(
  supabase: Supabase,
  orgId: string,
  staffId: string
): Promise<StaffCompensationView | null> {
  const all = await listStaffCompensations(supabase, orgId);
  return all.find((row) => row.staff_id === staffId) ?? null;
}

export interface ReconcileStaffCompensation extends StaffCompensationTerms {
  id: string;
  staff_id: string;
}

/**
 * Reconcile a staff compensation's generated obligations with its CURRENT
 * terms, without ever touching an obligation that has payment history.
 * Reuses planObligationReconciliation (no adjustments exist for staff, so the
 * adjustment fields are always empty). Removes only unpaid obligations,
 * inserts newly scheduled ones, updates unpaid base/currency.
 */
export async function reconcileStaffObligations(
  supabase: Supabase,
  orgId: string,
  compensation: ReconcileStaffCompensation,
  now?: Date
): Promise<void> {
  const desiredPeriods = staffPeriodKeys(compensation, now);

  const { data: existingRows } = await supabase
    .from("staff_salary_obligations")
    .select("id, period, expected_amount, currency")
    .eq("organization_id", orgId)
    .eq("compensation_id", compensation.id);

  const existing = (existingRows ?? []) as unknown as {
    id: string;
    period: string;
    expected_amount: number;
    currency: string;
  }[];

  const paymentsByObligation = new Map<string, PaymentAmountRow[]>();
  if (existing.length > 0) {
    const { data: payments } = await supabase
      .from("staff_payments")
      .select("obligation_id, amount, reversed_at")
      .eq("organization_id", orgId)
      .in(
        "obligation_id",
        existing.map((row) => row.id)
      );
    for (const payment of (payments ?? []) as unknown as (PaymentAmountRow & {
      obligation_id: string;
    })[]) {
      const list = paymentsByObligation.get(payment.obligation_id) ?? [];
      list.push(payment);
      paymentsByObligation.set(payment.obligation_id, list);
    }
  }

  const plan = planObligationReconciliation(
    desiredPeriods,
    existing.map((row) => {
      const payments = paymentsByObligation.get(row.id) ?? [];
      return {
        ...row,
        paid: sumActivePayments(payments),
        hasHistory: payments.length > 0,
        hasAdjustments: false,
        adjustmentNet: 0,
      };
    }),
    compensation.monthly_amount ?? 0,
    compensation.currency
  );

  if (plan.remove.length > 0) {
    await supabase
      .from("staff_salary_obligations")
      .delete()
      .eq("organization_id", orgId)
      .in("id", plan.remove);
  }

  for (const update of plan.update) {
    await supabase
      .from("staff_salary_obligations")
      .update({ expected_amount: update.expected, currency: update.currency })
      .eq("organization_id", orgId)
      .eq("id", update.id);
  }

  if (plan.insert.length > 0) {
    await supabase.from("staff_salary_obligations").upsert(
      plan.insert.map((row) => ({
        organization_id: orgId,
        compensation_id: compensation.id,
        staff_id: compensation.staff_id,
        period: row.period,
        period_start: `${row.period}-01`,
        expected_amount: row.expected,
        currency: row.currency,
      })),
      { onConflict: "compensation_id,period", ignoreDuplicates: true }
    );
  }
}

/** One staff member's obligation for a month, plus its recorded payments. */
export interface StaffObligationMonthRow {
  staff_id: string;
  first_name: string;
  last_name: string;
  functions: StaffFunctionRef[];
  compensation_id: string;
  obligation_id: string | null;
  period: string;
  expected: number;
  paid: number;
  remaining: number;
  status: ObligationStatus;
  currency: string;
  recorded_payments: {
    id: string;
    amount: number;
    paid_on: string;
    method: string;
    note: string | null;
    reversed_at: string | null;
  }[];
}

interface StaffObligationDBRow {
  id: string;
  compensation_id: string;
  staff_id: string;
  period: string;
  expected_amount: number;
  currency: string;
}

/**
 * Read-only staff payout view for one period: every staff member whose
 * compensation window includes that month, with expected/paid/remaining and
 * the derived status. Obligations are NOT written here — the mutation
 * reconciles first. A missing persisted obligation is shown from the
 * compensation terms so the screen is never blank.
 */
export async function listStaffFinanceMonth(
  supabase: Supabase,
  orgId: string,
  period: string,
  now?: Date
): Promise<StaffObligationMonthRow[]> {
  const compensations = await listStaffCompensations(supabase, orgId);
  const candidates = compensations.filter(
    (comp) =>
      hasStaffCompensation(comp) && staffPeriodKeys(comp, now).includes(period)
  );
  if (candidates.length === 0) return [];

  const { data: obligations } = await supabase
    .from("staff_salary_obligations")
    .select("*")
    .eq("organization_id", orgId)
    .eq("period", period)
    .in(
      "compensation_id",
      candidates.map((comp) => comp.id)
    );
  const obligationByCompensation = new Map<string, StaffObligationDBRow>();
  for (const row of (obligations ?? []) as unknown as StaffObligationDBRow[]) {
    obligationByCompensation.set(row.compensation_id, row);
  }

  const paymentsByObligation = new Map<
    string,
    {
      id: string;
      amount: number;
      paid_on: string;
      method: string;
      note: string | null;
      reversed_at: string | null;
    }[]
  >();
  const obligationIds = [...obligationByCompensation.values()].map((o) => o.id);
  if (obligationIds.length > 0) {
    const { data: payments } = await supabase
      .from("staff_payments")
      .select("id, obligation_id, amount, paid_on, method, note, reversed_at")
      .eq("organization_id", orgId)
      .in("obligation_id", obligationIds);
    for (const payment of (payments ?? []) as unknown as {
      id: string;
      obligation_id: string;
      amount: number;
      paid_on: string;
      method: string;
      note: string | null;
      reversed_at: string | null;
    }[]) {
      const list = paymentsByObligation.get(payment.obligation_id) ?? [];
      list.push(payment);
      paymentsByObligation.set(payment.obligation_id, list);
    }
  }

  const out: StaffObligationMonthRow[] = [];
  for (const comp of candidates) {
    const obligation = obligationByCompensation.get(comp.id) ?? null;
    const expected = obligation?.expected_amount ?? comp.monthly_amount ?? 0;
    const currency = obligation?.currency ?? comp.currency ?? "RSD";
    const payments = paymentsByObligation.get(obligation?.id ?? "") ?? [];
    const paid = obligation ? sumActivePayments(payments) : 0;
    const state = obligationState(period, expected, paid, now);

    out.push({
      staff_id: comp.staff_id,
      first_name: comp.first_name,
      last_name: comp.last_name,
      functions: comp.functions,
      compensation_id: comp.id,
      obligation_id: obligation?.id ?? null,
      period,
      expected,
      paid,
      remaining: state.remaining,
      status: state.status,
      currency,
      recorded_payments: payments
        .sort((a, b) => b.paid_on.localeCompare(a.paid_on))
        .map((payment) => ({
          id: payment.id,
          amount: Number(payment.amount),
          paid_on: payment.paid_on,
          method: payment.method,
          note: payment.note,
          reversed_at: payment.reversed_at ?? null,
        })),
    });
  }

  return out.sort(
    (a, b) =>
      a.last_name.localeCompare(b.last_name) ||
      a.first_name.localeCompare(b.first_name)
  );
}

/** One month of the staff payout overview (staff WITHOUT an obligation excluded). */
export interface StaffFinanceMonth {
  period: string;
  staffCount: number;
  expected: number;
  paid: number;
  remaining: number;
  status: MonthStatus;
}

/**
 * All months that have at least one staff obligation, rolled up to expected /
 * paid / remaining + a derived status. Used by the month selector and the
 * Finansije overview. Built from the compensation windows in a handful of
 * queries — no per-month round trip.
 */
export async function listStaffFinanceMonths(
  supabase: Supabase,
  orgId: string,
  now?: Date
): Promise<StaffFinanceMonth[]> {
  const compensations = await listStaffCompensations(supabase, orgId);
  const active = compensations.filter((comp) => hasStaffCompensation(comp));
  if (active.length === 0) return [];

  const periodCompensations = new Map<string, typeof active>();
  for (const comp of active) {
    for (const period of staffPeriodKeys(comp, now)) {
      const list = periodCompensations.get(period) ?? [];
      list.push(comp);
      periodCompensations.set(period, list);
    }
  }
  if (periodCompensations.size === 0) return [];

  const compensationIds = active.map((comp) => comp.id);
  const { data: obligationRows } = await supabase
    .from("staff_salary_obligations")
    .select("id, compensation_id, period, expected_amount, currency")
    .eq("organization_id", orgId)
    .in("compensation_id", compensationIds);

  const obligationByCompPeriod = new Map<string, StaffObligationDBRow>();
  for (const row of (obligationRows ?? []) as unknown as StaffObligationDBRow[]) {
    obligationByCompPeriod.set(`${row.compensation_id}:${row.period}`, row);
  }
  const obligationIds = [...obligationByCompPeriod.values()].map((row) => row.id);

  const paymentsByObligation = new Map<string, PaymentAmountRow[]>();
  if (obligationIds.length > 0) {
    const { data: payments } = await supabase
      .from("staff_payments")
      .select("obligation_id, amount, reversed_at")
      .eq("organization_id", orgId)
      .in("obligation_id", obligationIds);
    for (const payment of (payments ?? []) as unknown as (PaymentAmountRow & {
      obligation_id: string;
    })[]) {
      const list = paymentsByObligation.get(payment.obligation_id) ?? [];
      list.push(payment);
      paymentsByObligation.set(payment.obligation_id, list);
    }
  }

  const months: StaffFinanceMonth[] = [];
  for (const [period, comps] of periodCompensations) {
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

    for (const comp of comps) {
      const obligation =
        obligationByCompPeriod.get(`${comp.id}:${period}`) ?? null;
      const expected = obligation?.expected_amount ?? comp.monthly_amount ?? 0;
      const paid = obligation
        ? sumActivePayments(paymentsByObligation.get(obligation.id) ?? [])
        : 0;
      const state = obligationState(period, expected, paid, now);

      summary.playerCount += 1;
      summary.expected += expected;
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
      staffCount: summary.playerCount,
      expected: summary.expected,
      paid: summary.paid,
      remaining: summary.remaining,
      status: monthStatusFor(summary, period, now),
    });
  }

  return months.sort((a, b) => a.period.localeCompare(b.period));
}

/** The 'YYYY-MM' key of the current month. */
export function currentPeriodKey(now: Date = new Date()): string {
  return periodKey(now.getFullYear(), now.getMonth() + 1);
}

export interface RecordStaffPaymentInput {
  obligation_id: string;
  compensation_id: string;
  staff_id: string;
  amount: number;
  currency: string;
  paid_on: string;
  method: "cash" | "bank" | "other";
  note: string | null;
  created_by: string;
}

/** Record a single staff payment against an obligation. */
export async function recordStaffPayment(
  supabase: Supabase,
  orgId: string,
  input: RecordStaffPaymentInput
): Promise<{ error: string | null }> {
  const { error } = await supabase.from("staff_payments").insert({
    organization_id: orgId,
    ...input,
  });
  return { error: error?.message ?? null };
}

export type ReversePaymentResult = "ok" | "already_reversed";

/** Reverse one staff payment (stamp, never delete; idempotent against races). */
export async function reverseStaffPaymentRecord(
  supabase: Supabase,
  orgId: string,
  paymentId: string,
  userId: string
): Promise<ReversePaymentResult> {
  const { data, error } = await supabase
    .from("staff_payments")
    .update({ reversed_at: new Date().toISOString(), reversed_by: userId })
    .eq("id", paymentId)
    .eq("organization_id", orgId)
    .is("reversed_at", null)
    .select("id");
  if (error) throw new Error("Greška pri poništavanju isplate: " + error.message);
  return data && data.length > 0 ? "ok" : "already_reversed";
}
