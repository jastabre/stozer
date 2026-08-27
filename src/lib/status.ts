// STUB — RED phase placeholder. Real implementation lands in the GREEN phase.
import { differenceInCalendarDays } from "date-fns";

export type StatusTone = "green" | "yellow" | "red";
export type MedicalTone = "not_recorded" | "valid" | "expiring_soon" | "expired";

export function deriveStatus(
  _validUntil: Date | null,
  _thresholdDays: number,
  _now: Date = new Date()
): StatusTone {
  // Placeholder — returns a fixed tone so the RED test fails on assertion.
  return "green";
}

export function medicalStatus(
  _validUntil: Date | null,
  _thresholdDays: number,
  _now: Date = new Date()
): MedicalTone {
  // Placeholder — returns a fixed tone so the RED test fails on assertion.
  return "valid";
}
