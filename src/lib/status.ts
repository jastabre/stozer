// Shared green/yellow/red status derivation (D-12, REG-03, D-34).
// Single source of truth for registrations, medical, documents, contracts,
// licenses — every status renderer consumes this module (never hand-rolled
// color logic per page). Pure date logic only, no DB imports.
import { differenceInCalendarDays } from "date-fns";

export type StatusTone = "green" | "yellow" | "red";
export type MedicalTone = "not_recorded" | "valid" | "expiring_soon" | "expired";

/**
 * Derive the registration/document/license tone from a validity end date and
 * the org-level warning threshold (D-12, REG-03).
 * - null (no record or expired) -> red
 * - past the expiry date          -> red
 * - within `thresholdDays` of expiry (inclusive) -> yellow
 * - otherwise                     -> green
 *
 * Uses calendar days (differenceInCalendarDays) so date boundaries never flip a
 * pill from DST/time-of-day effects. A fixed `now` makes it deterministic.
 */
export function deriveStatus(
  validUntil: Date | null,
  thresholdDays: number,
  now: Date = new Date()
): StatusTone {
  if (!validUntil) return "red"; // expired or none
  const daysLeft = differenceInCalendarDays(validUntil, now);
  if (daysLeft < 0) return "red";
  if (daysLeft <= thresholdDays) return "yellow";
  return "green";
}

/**
 * Derive the medical examination tone (D-34/D-36) from validity and the SAME
 * org warning threshold as registrations (D-36 — no medical-specific config).
 * - null (no examination) -> not_recorded
 * - past the expiry date  -> expired
 * - within `thresholdDays` of expiry (inclusive) -> expiring_soon
 * - otherwise             -> valid
 */
export function medicalStatus(
  validUntil: Date | null,
  thresholdDays: number,
  now: Date = new Date()
): MedicalTone {
  if (!validUntil) return "not_recorded";
  const daysLeft = differenceInCalendarDays(validUntil, now);
  if (daysLeft < 0) return "expired";
  if (daysLeft <= thresholdDays) return "expiring_soon";
  return "valid";
}

/** i18n label keys (per tone) consumed by the registration pill renderer. */
export const STATUS_LABELS: Record<StatusTone, string> = {
  green: "green",
  yellow: "yellow",
  red: "red",
};

/** i18n label keys (per tone) consumed by the medical banner/pill renderer. */
export const MEDICAL_LABELS: Record<MedicalTone, string> = {
  not_recorded: "not_recorded",
  valid: "valid",
  expiring_soon: "expiring_soon",
  expired: "expired",
};

/** Days remaining until a validity date (calendar days) for richer UI text (REG-07). */
export function daysUntil(validUntil: Date, now: Date = new Date()): number {
  return differenceInCalendarDays(validUntil, now);
}
