/**
 * STOŽER date helpers — the single source of truth for the user-facing
 * DD.MM.GGGG format <-> the ISO YYYY-MM-DD string the forms and the DB use.
 *
 * UI format (DD.MM.GGGG) and storage format (ISO date) are intentionally
 * different. Only `YYYY-MM-DD` ever leaves this module toward a server action.
 *
 * Everything here is date-only and uses Date.UTC, so parsing/validating never
 * shifts a calendar date by a timezone offset.
 */

const DMY = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/;
const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** True only for a real calendar day (rejects 31.02, 29.02 on non-leap, …). */
export function isValidCalendarDate(y: number, mo: number, d: number): boolean {
  if (!Number.isInteger(y) || !Number.isInteger(mo) || !Number.isInteger(d)) return false;
  if (y < 1000 || y > 9999 || mo < 1 || mo > 12 || d < 1) return false;
  // Date.UTC(year, month, 0) => last day of `month` (1-based) without TZ drift.
  const daysInMonth = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  return d <= daysInMonth;
}

/** Parse a DD.MM.GGGG string into YYYY-MM-DD, or null when invalid/incomplete. */
export function parseDmy(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = DMY.exec(value.trim());
  if (!match) return null;
  const d = Number(match[1]);
  const mo = Number(match[2]);
  const y = Number(match[3]);
  if (!isValidCalendarDate(y, mo, d)) return null;
  return `${String(y).padStart(4, "0")}-${pad2(mo)}-${pad2(d)}`;
}

/** Format an ISO YYYY-MM-DD string into DD.MM.GGGG. Returns "" when not a date. */
export function formatDmy(iso: string | null | undefined): string {
  if (!iso) return "";
  const match = ISO.exec(iso);
  if (!match) return "";
  const [, y, mo, d] = match;
  return `${d}.${mo}.${y}`;
}

/** Whether a DD.MM.GGGG string is a complete, syntactically valid calendar date. */
export function isCompleteValidDmy(value: string | null | undefined): boolean {
  return parseDmy(value) !== null;
}
