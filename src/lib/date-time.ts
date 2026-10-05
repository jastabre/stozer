/**
 * STOŽER time-of-day helpers. `date-format.ts` is date-only; this module
 * handles HH:MM parsing/formatting and combining a calendar date with a time
 * into a single UTC timestamp. Everything uses Date.UTC so a wall-clock time
 * never shifts across a timezone or DST boundary.
 */

const TIME = /^(\d{1,2}):(\d{2})$/;

export interface TimeOfDay {
  hour: number;
  minute: number;
}

/** Parse "HH:MM" into { hour, minute }, or null when invalid. */
export function parseTime(value: string | null | undefined): TimeOfDay | null {
  if (!value) return null;
  const match = TIME.exec(value.trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return { hour, minute };
}

/** Format { hour, minute } back into zero-padded "HH:MM". */
export function formatTime(time: TimeOfDay): string {
  return `${String(time.hour).padStart(2, "0")}:${String(time.minute).padStart(2, "0")}`;
}

/** Combine an ISO date (YYYY-MM-DD) with a time-of-day into a UTC Date. */
export function combineDateTime(dateISO: string, time: TimeOfDay): Date {
  const [year, month, day] = dateISO.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, time.hour, time.minute, 0, 0));
}

/** Whole minutes from start to end (end - start), rounded. */
export function minutesBetween(start: Date, end: Date): number {
  return Math.round((end.getTime() - start.getTime()) / 60000);
}
