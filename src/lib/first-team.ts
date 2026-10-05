/**
 * First-team contract / payment domain logic (pure, testable).
 *
 * V1 keeps this simple: monthly obligations from contract dates + payment
 * schedule, statuses derived from expected vs paid sums. No proration, no
 * payroll/tax/accounting.
 */

export const PAY_SCHEDULES = [
  "all_year",
  "competition_months",
  "custom_months",
] as const;
export type PaySchedule = (typeof PAY_SCHEDULES)[number];

export const PAYMENT_METHODS = ["cash", "bank", "other"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

/**
 * Monthly per-obligation finance corrections. A bonus adds to the amount due
 * for the month, a deduction subtracts from it; the contracted monthly salary
 * (base) is never rewritten by an adjustment.
 */
export const ADJUSTMENT_TYPES = ["bonus", "deduction"] as const;
export type AdjustmentType = (typeof ADJUSTMENT_TYPES)[number];

export interface ContractFinance {
  valid_from: string | null;
  valid_until: string | null;
  monthly_salary: number | null;
  currency: string;
  pay_schedule: PaySchedule;
  custom_months: number[] | null;
}

export interface SeasonFinance {
  competition_months: number[] | null;
}

export type ObligationStatus =
  | "paid"
  | "partial"
  | "due"
  | "late"
  | "future";

export interface ObligationState {
  period: string; // 'YYYY-MM'
  expected: number;
  paid: number;
  remaining: number;
  status: ObligationStatus;
}

/** Parse 'YYYY-MM' into { year, month }. */
export function parsePeriod(period: string): { year: number; month: number } {
  const [y, m] = period.split("-").map(Number);
  return { year: y, month: m };
}

/** Month numbers (1-12) that fall inside the contract's active window. */
function monthsWithinContract(
  contract: ContractFinance
): { year: number; month: number }[] {
  // Parse the stored ISO dates in UTC: the month walk below uses UTC getters,
  // so a local-time parse would shift a 1st-of-month contract into the
  // previous month on positive-offset servers (the season overview relies on
  // the contract month being exact).
  const start = contract.valid_from ? new Date(`${contract.valid_from}T00:00:00Z`) : null;
  const end = contract.valid_until ? new Date(`${contract.valid_until}T00:00:00Z`) : null;
  const out: { year: number; month: number }[] = [];

  // No dates -> no obligation can be scoped; callers decide (V1 requires dates).
  if (!start) return out;

  const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
  const last =
    end &&
    end >= start &&
    new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1)) >= cursor
      ? new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1))
      : null;

  while (!last || cursor <= last) {
    out.push({ year: cursor.getUTCFullYear(), month: cursor.getUTCMonth() + 1 });
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    if (out.length > 120) break; // safety cap
  }
  return out;
}

/**
 * Generate the set of obligation months for a contract under its schedule.
 *
 *   all_year           -> every month within the contract window
 *   competition_months -> months within the window that are in the season's
 *                         competition-months set (default none if unset)
 *   custom_months      -> months within the window that are in the contract's
 *                         custom months
 */
export function obligationMonthsFor(
  contract: ContractFinance,
  season: SeasonFinance
): { year: number; month: number }[] {
  const within = monthsWithinContract(contract);
  if (contract.pay_schedule === "all_year") return within;

  const allowed = new Set(
    contract.pay_schedule === "custom_months"
      ? (contract.custom_months ?? [])
      : (season.competition_months ?? [])
  );
  return within.filter((m) => allowed.has(m.month));
}

export function periodKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

/** Build a single obligation's state from expected + paid sums. */
export function obligationState(
  period: string,
  expected: number,
  paid: number,
  now?: Date
): ObligationState {
  const today = now ?? new Date();
  const { year, month } = parsePeriod(period);
  // A period is overdue once the next month begins (its month has passed).
  const periodEnd = new Date(Date.UTC(year, month, 1)); // start of month after
  const isOverdue = today >= periodEnd;
  const remaining = Math.max(0, expected - paid);

  let status: ObligationStatus;
  if (expected === 0) {
    // Fully deducted month: nothing left to pay, so it is settled by definition.
    status = "paid";
  } else if (paid >= expected) {
    status = "paid";
  } else if (paid > 0) {
    status = "partial";
  } else if (isOverdue) {
    status = "late";
  } else {
    status = "due";
  }
  return { period, expected, paid, remaining, status };
}

/** Sum of all recorded payments for a list of obligations. */
export function sumPayments(payments: number[]): number {
  return payments.reduce((acc, n) => acc + n, 0);
}

/**
 * Month-level status for the season overview, rolled up from the month's
 * per-obligation states (never stored, always derived):
 *   paid    -> every obligation of the month is settled (remaining = 0)
 *   future  -> the obligation month has not started yet
 *   late    -> at least one obligation is overdue with nothing paid
 *   partial -> some money was recorded, but obligations remain open
 *   due     -> nothing recorded yet and the month is not overdue
 */
export type MonthStatus = "paid" | "partial" | "late" | "due" | "future";

/** Per-month rollup of one obligation month (players with an obligation only). */
export interface MonthObligationSummary {
  playerCount: number;
  /** Players whose obligation for the month is settled. */
  paidCount: number;
  /** Players with an active partial payment but an open balance. */
  partialCount: number;
  /** Players with no active payment for the month (open balance). */
  unpaidCount: number;
  /** Of `unpaidCount`, the ones whose month is already overdue. */
  lateCount: number;
  expected: number;
  paid: number;
  remaining: number;
}

export function monthStatusFor(
  summary: MonthObligationSummary,
  period: string,
  now?: Date
): MonthStatus {
  // An empty month is never actionable; callers omit such months entirely.
  if (summary.playerCount === 0) return "due";
  if (summary.remaining <= 0) return "paid";
  const today = now ?? new Date();
  const currentPeriod = periodKey(today.getFullYear(), today.getMonth() + 1);
  if (period > currentPeriod) return "future";
  if (summary.lateCount > 0) return "late";
  if (summary.paid > 0) return "partial";
  return "due";
}

/** Pluralized wording providers for one season-overview month row. */
export interface SeasonMonthPlayerLabels {
  /** Pluralized player count, e.g. "1 igrač"/"2 igrača". */
  playersCount: (count: number) => string;
  /** "plaćeno" — appended to the paid/total fraction. */
  playersPaid: string;
  /** Pluralized partial count, e.g. "1 delimično". */
  playersPartial: (count: number) => string;
  /** Pluralized unpaid count, e.g. "1 nije plaćen". */
  playersUnpaid: (count: number) => string;
  /** "Sve izmireno" for a fully settled month. */
  allSettled: string;
  /** "Buduća obaveza" for a month that has not started yet. */
  futurePlayersNote: string;
}

/**
 * The "Igrači" cell wording for one overview month. A not-yet-due month must
 * never read as unpaid — future obligations are a neutral "N igrača / Buduća
 * obaveza". Due months read "X/Y plaćeno" with a small partial/unpaid
 * breakdown; settled months read "Sve izmireno".
 */
export function seasonMonthPlayersLabel(
  month: {
    status: MonthStatus;
    playerCount: number;
    paidCount: number;
    partialCount: number;
    unpaidCount: number;
  },
  labels: SeasonMonthPlayerLabels
): { main: string; note: string } {
  if (month.status === "future") {
    return {
      main: labels.playersCount(month.playerCount),
      note: labels.futurePlayersNote,
    };
  }

  const main = `${month.paidCount}/${month.playerCount} ${labels.playersPaid}`;
  if (month.status === "paid") {
    return { main, note: labels.allSettled };
  }

  const parts: string[] = [];
  if (month.partialCount > 0) parts.push(labels.playersPartial(month.partialCount));
  if (month.unpaidCount > 0) parts.push(labels.playersUnpaid(month.unpaidCount));
  return { main, note: parts.join(" · ") };
}

/** Anything with the columns a paid-sum needs; reversed rows carry reversed_at. */
export interface PaymentAmountRow {
  amount: number;
  reversed_at?: string | null;
}

/** A payment counts toward money only while it has not been reversed. */
export function isPaymentReversed(payment: PaymentAmountRow): boolean {
  return payment.reversed_at != null;
}

/**
 * Sum of ACTIVE payments: reversed ("Poništi isplatu") rows are excluded so a
 * reversal instantly restores the obligation's remaining balance. History
 * readers must NOT use this — they render reversed rows discretely.
 */
export function sumActivePayments(payments: PaymentAmountRow[]): number {
  return payments
    .filter((p) => !isPaymentReversed(p))
    .reduce((acc, p) => acc + Number(p.amount), 0);
}

/** Anything with the columns an adjustment total needs; reversed rows carry reversed_at. */
export interface AdjustmentAmountRow {
  type: AdjustmentType;
  amount: number;
  reversed_at?: string | null;
}

export interface AdjustmentTotals {
  /** Sum of ACTIVE bonuses. */
  bonus: number;
  /** Sum of ACTIVE deductions (positive number). */
  deduction: number;
}

/** An adjustment affects money only while it has not been reversed. */
export function isAdjustmentReversed(adjustment: AdjustmentAmountRow): boolean {
  return adjustment.reversed_at != null;
}

/**
 * Active correction totals for an obligation: reversed ("Poništi korekciju")
 * rows are excluded, exactly like reversed payments. History readers must NOT
 * use this — they render reversed rows discretely.
 */
export function adjustmentTotals(adjustments: AdjustmentAmountRow[]): AdjustmentTotals {
  let bonus = 0;
  let deduction = 0;
  for (const adjustment of adjustments) {
    if (isAdjustmentReversed(adjustment)) continue;
    if (adjustment.type === "bonus") bonus += Number(adjustment.amount);
    else deduction += Number(adjustment.amount);
  }
  return { bonus, deduction };
}

/**
 * What has to be paid for the month: the base obligation plus active bonuses
 * minus active deductions. Floored at zero — the server-side validation keeps
 * deductions from crossing it, and the floor keeps legacy/edge data sane.
 */
export function adjustedExpectedAmount(
  baseAmount: number,
  totals: AdjustmentTotals
): number {
  return Math.max(0, baseAmount + totals.bonus - totals.deduction);
}

/** Labels for the compact "why is this month's obligation different" line. */
export interface ObligationBreakdownLabels {
  /** "Osnovna" — the contracted base. */
  base: string;
  /** "Bonus" — the +side of corrections. */
  bonus: string;
  /** "Odbitak" — the −side of corrections. */
  deduction: string;
}

/**
 * The secondary obligation line: base plus the ACTIVE corrections split by
 * type, e.g. "Osnovna 150.000 · Bonus +20.000 · Odbitak −15.000". Only the
 * parts that exist are rendered; returns null when there are no active
 * corrections (the primary total already equals the base). Reversed
 * corrections never appear here — they are audit history, not obligation.
 */
export function obligationBreakdownLabel(
  baseAmount: number,
  totals: AdjustmentTotals,
  labels: ObligationBreakdownLabels
): string | null {
  if (totals.bonus <= 0 && totals.deduction <= 0) return null;
  const parts = [`${labels.base} ${formatNumber(baseAmount)}`];
  if (totals.bonus > 0) {
    parts.push(`${labels.bonus} +${formatNumber(totals.bonus)}`);
  }
  if (totals.deduction > 0) {
    parts.push(`${labels.deduction} \u2212${formatNumber(totals.deduction)}`);
  }
  return parts.join(" \u00B7 ");
}

/**
 * Server-side guard for one adjustment: the amount must be a positive integer,
 * and a deduction may never push the month's adjusted obligation below zero.
 * Bonuses have no upper bound beyond the amount sanity cap enforced upstream.
 */
export function validateAdjustmentAmount(
  amount: number,
  type: AdjustmentType,
  currentAdjusted: number
): PaymentValidation {
  if (!Number.isInteger(amount) || amount <= 0) {
    return { ok: false, error: "Iznos korekcije mora biti veći od 0." };
  }
  if (type === "deduction" && amount > currentAdjusted) {
    return {
      ok: false,
      error: "Odbitak ne može da spusti ukupnu obavezu ispod 0.",
    };
  }
  return { ok: true };
}

export interface ReconcileExistingObligation {
  id: string;
  period: string;
  expected_amount: number;
  currency: string;
  /** Total of ACTIVE payments recorded against this obligation (reversed excluded). */
  paid: number;
  /**
   * True when the obligation has ANY payment row at all, active or reversed.
   * Reversing every payment zeroes `paid`, but the reversed evidence still
   * hangs off this obligation — such rows are never updated or deleted.
   */
  hasHistory?: boolean;
  /**
   * True when the obligation has ANY adjustment row at all, active or
   * reversed. Adjustment history protects the obligation from deletion
   * (cascade would destroy the correction evidence) but does NOT freeze the
   * base amount: a salary change still updates an unpaid obligation, unless
   * the new base would push the adjusted total below zero.
   */
  hasAdjustments?: boolean;
  /** Active adjustments net (bonus - deduction) for the floor guard on updates. */
  adjustmentNet?: number;
}

export interface ObligationReconciliationPlan {
  insert: { period: string; expected: number; currency: string }[];
  update: { id: string; expected: number; currency: string }[];
  /** Obligation ids safe to delete (no payment/adjustment history and no longer scheduled). */
  remove: string[];
  /** Obligation ids left untouched. */
  keep: string[];
}

/**
 * Plan how to reconcile a contract's generated obligations with its current
 * terms WITHOUT ever touching an obligation that has financial history:
 *   - a desired period that does not exist yet -> insert
 *   - an existing obligation with payment history -> keep untouched
 *   - an existing obligation whose base/currency changed -> update (unpaid,
 *     no payment history, and never below an active deduction's floor)
 *   - an existing obligation no longer in the schedule -> remove only when it
 *     has NO history at all; payment rows and adjustment rows (even fully
 *     reversed ones) pin it forever
 * Pure so it is unit-testable; the DB layer applies the returned plan.
 */
export function planObligationReconciliation(
  desiredPeriods: string[],
  existing: ReconcileExistingObligation[],
  expected: number,
  currency: string
): ObligationReconciliationPlan {
  const desired = new Set(desiredPeriods);
  const byPeriod = new Map(existing.map((row) => [row.period, row]));
  const plan: ObligationReconciliationPlan = {
    insert: [],
    update: [],
    remove: [],
    keep: [],
  };

  const hasPaymentHistory = (row: ReconcileExistingObligation) =>
    row.paid > 0 || row.hasHistory === true;

  const hasAnyHistory = (row: ReconcileExistingObligation) =>
    hasPaymentHistory(row) || row.hasAdjustments === true;

  // A base update must not make the month's adjusted obligation negative.
  const updateKeepsFloor = (row: ReconcileExistingObligation) =>
    expected + (row.adjustmentNet ?? 0) >= 0;

  for (const period of desiredPeriods) {
    const row = byPeriod.get(period);
    if (!row) {
      plan.insert.push({ period, expected, currency });
      continue;
    }
    if (hasPaymentHistory(row) || !updateKeepsFloor(row)) {
      plan.keep.push(row.id); // never rewrite what has payment history / breaks the floor
      continue;
    }
    if (row.expected_amount !== expected || row.currency !== currency) {
      plan.update.push({ id: row.id, expected, currency });
    } else {
      plan.keep.push(row.id);
    }
  }

  for (const row of existing) {
    if (desired.has(row.period)) continue;
    if (!hasAnyHistory(row)) plan.remove.push(row.id);
    else plan.keep.push(row.id); // unpaid months go, history (incl. reversed) stays
  }

  return plan;
}

export type PaymentValidation = { ok: true } | { ok: false; error: string };

/**
 * Server-side guard for a single bulk payment amount: positive integer and
 * never more than the obligation's remaining balance. Prevents accidental
 * overpayment through the normal UI (no credit/prepayment system in V1).
 */
export function validatePaymentAmount(
  amount: number,
  remaining: number
): PaymentValidation {
  if (!Number.isInteger(amount) || amount <= 0) {
    return { ok: false, error: "Iznos isplate mora biti veći od 0." };
  }
  if (amount > remaining) {
    return {
      ok: false,
      error: `Iznos ne može biti veći od preostale obaveze (${remaining}).`,
    };
  }
  return { ok: true };
}

/**
 * Validate a custom-months value: must be unique ints in 1..12.
 * Returns the normalized array or null when invalid.
 */
export function normalizeCustomMonths(value: string | null | undefined): number[] | null {
  if (!value) return null;
  const parts = value
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isInteger(n) && n >= 1 && n <= 12);
  const uniq = [...new Set(parts)];
  return uniq.length ? uniq : null;
}

/** Human month names (1-12) in the given locale. */
export function monthName(
  month: number,
  locale: "sr" | "en"
): string {
  const names =
    locale === "sr"
      ? [
          "Januar",
          "Februar",
          "Mart",
          "April",
          "Maj",
          "Jun",
          "Jul",
          "Avgust",
          "Septembar",
          "Oktobar",
          "Novembar",
          "Decembar",
        ]
      : [
          "January",
          "February",
          "March",
          "April",
          "May",
          "June",
          "July",
          "August",
          "September",
          "October",
          "November",
          "December",
        ];
  return names[month - 1] ?? String(month);
}

/** Grouped number without the currency — used by money inputs. */
export function formatNumber(amount: number): string {
  return amount.toLocaleString("sr-RS");
}

/**
 * Format an integer minor-unit amount with the currency code as ONE unit.
 * The number and the code are joined with a non-breaking space, so the pair
 * can never wrap apart or visually drift to opposite edges of a row/card —
 * the currency label always stays glued to the amount it belongs to.
 */
export function formatAmount(amount: number | null | undefined, currency: string): string {
  if (amount == null) return "—";
  return `${formatNumber(amount)}\u00A0${currency}`;
}