/**
 * Staff engagement finance — pure, testable. This is the SAME V1 model as
 * first-team finance (contracts -> obligations -> payments) but SIMPLER: staff
 * compensation has no pay schedule, no custom months and no adjustments. It is
 * just a monthly amount with a validity window and recorded payments.
 *
 * All shared money math lives in first-team.ts (obligationState, periodKey,
 * sumActivePayments, planObligationReconciliation, formatAmount, monthName) and
 * is reused here — no duplicated finance logic.
 */

import { periodKey } from "./first-team";

/** The engagement terms stored on staff_compensations. */
export interface StaffCompensationTerms {
  valid_from: string | null;
  valid_until: string | null;
  /** NULL = "Bez naknade" (no financial obligation). */
  monthly_amount: number | null;
  currency: string;
}

/** True when this staff member has an actual monthly financial obligation. */
export function hasStaffCompensation(
  compensation: StaffCompensationTerms
): boolean {
  return (
    compensation.monthly_amount != null &&
    compensation.monthly_amount > 0 &&
    compensation.valid_from != null &&
    compensation.valid_from !== ""
  );
}

/**
 * The obligation months for a staff compensation: every month from valid_from
 * (inclusive) to valid_until (inclusive). An open-ended compensation
 * (no valid_until) is generated only through the current month + 11, so an
 * ongoing engagement never explodes into a decade of rows. Months are derived
 * in UTC so a 1st-of-month date never shifts on a positive-offset server.
 */
export function staffObligationMonths(
  compensation: StaffCompensationTerms,
  now: Date = new Date()
): { year: number; month: number }[] {
  if (!hasStaffCompensation(compensation)) return [];

  const start = new Date(`${compensation.valid_from}T00:00:00Z`);
  const cursor = new Date(
    Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1)
  );
  // Open-ended engagement: generate through the current month + 11, so an
  // ongoing contract never explodes into a decade of rows but always covers a
  // full year ahead of today.
  const horizon = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 11, 1)
  );

  let end = horizon;
  if (compensation.valid_until) {
    const last = new Date(`${compensation.valid_until}T00:00:00Z`);
    // An inverted window (valid_until before valid_from) is inconsistent data
    // and must produce NO obligations — never silently extended to the horizon.
    if (last < start) return [];
    end = new Date(
      Date.UTC(last.getUTCFullYear(), last.getUTCMonth(), 1)
    );
  }

  const out: { year: number; month: number }[] = [];
  while (cursor <= end && out.length < 120) {
    out.push({ year: cursor.getUTCFullYear(), month: cursor.getUTCMonth() + 1 });
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return out;
}

/** 'YYYY-MM' keys of every obligation month of a staff compensation. */
export function staffPeriodKeys(
  compensation: StaffCompensationTerms,
  now?: Date
): string[] {
  return staffObligationMonths(compensation, now).map((m) =>
    periodKey(m.year, m.month)
  );
}
