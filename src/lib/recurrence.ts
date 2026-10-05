/**
 * STOŽER recurrence expansion (D-11). A recurring training repeats on a fixed
 * set of weekdays until a date; the series is expanded into individual
 * occurrence dates (one `trainings` row per occurrence at insert time).
 *
 * Pure and date-only: uses Date.UTC and a day-by-day walk so the result never
 * drifts across a timezone/DST boundary, and there is no DB access.
 */

export interface RecurrenceRule {
  /** Days of week to repeat on: 0 = Sunday ... 6 = Saturday. */
  weekdays: number[];
  /** ISO date (YYYY-MM-DD) — inclusive last occurrence. */
  until: string;
}

function toUtc(dateISO: string): number {
  const [year, month, day] = dateISO.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

function toIso(timestamp: number): string {
  const d = new Date(timestamp);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(
    d.getUTCDate()
  ).padStart(2, "0")}`;
}

/**
 * Expand a recurrence into ISO dates, from startDate (inclusive) through
 * rule.until (inclusive), keeping only dates whose weekday is in the rule.
 * Returns an empty array when startDate is after rule.until.
 */
export function expandRecurrence(rule: RecurrenceRule, startDate: string): string[] {
  const result: string[] = [];
  const start = toUtc(startDate);
  const end = toUtc(rule.until);
  const dayMs = 86400000;

  for (let t = start; t <= end; t += dayMs) {
    const weekday = new Date(t).getUTCDay();
    if (rule.weekdays.includes(weekday)) {
      result.push(toIso(t));
    }
  }
  return result;
}
