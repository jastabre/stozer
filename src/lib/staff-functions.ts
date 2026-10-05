/**
 * Staff "Funkcija u klubu" presets. The title/function field is free text on
 * the staff profile; presets are an input helper only (custom "Ostalo"
 * allowed). The selected preset is saved in the current locale. This is the
 * person's REAL club function — NOT their application role.
 */

export const STAFF_FUNCTION_KEYS = [
  "president",
  "sport_director",
  "youth_director",
  "coach",
  "assistant_coach",
  "goalkeeper_coach",
  "fitness_coach",
  "econom",
  "doctor",
  "physiotherapist",
  "secretary",
] as const;

export type StaffFunctionKey = (typeof STAFF_FUNCTION_KEYS)[number];

export const STAFF_FUNCTION_LABELS: Record<
  "sr" | "en",
  Record<StaffFunctionKey, string>
> = {
  sr: {
    president: "Predsednik",
    sport_director: "Sportski direktor",
    youth_director: "Direktor omladinske škole",
    coach: "Trener",
    assistant_coach: "Pomoćni trener",
    goalkeeper_coach: "Trener golmana",
    fitness_coach: "Kondicioni trener",
    econom: "Ekonom",
    doctor: "Doktor",
    physiotherapist: "Fizioterapeut",
    secretary: "Sekretar",
  },
  en: {
    president: "President",
    sport_director: "Sport director",
    youth_director: "Youth school director",
    coach: "Coach",
    assistant_coach: "Assistant coach",
    goalkeeper_coach: "Goalkeeper coach",
    fitness_coach: "Fitness coach",
    econom: "Kit manager",
    doctor: "Doctor",
    physiotherapist: "Physiotherapist",
    secretary: "Secretary",
  },
};

export function staffFunctions(
  locale: "sr" | "en"
): { key: string; label: string }[] {
  return STAFF_FUNCTION_KEYS.map((key) => ({
    key,
    label: STAFF_FUNCTION_LABELS[locale][key],
  }));
}

/**
 * Club functions that normally carry a professional license. Everyone else
 * (president, directors, secretary, kit manager, and custom "Ostalo" functions)
 * is simply not license-tracked, so the UI never flags them as missing one.
 */
export const STAFF_FUNCTIONS_WITH_LICENSE: readonly StaffFunctionKey[] = [
  "coach",
  "assistant_coach",
  "goalkeeper_coach",
  "fitness_coach",
  "doctor",
  "physiotherapist",
];

/** Resolve a stored function label (either locale) to its preset key. */
export function staffFunctionKey(
  value: string | null | undefined
): StaffFunctionKey | null {
  if (!value) return null;
  for (const locale of ["sr", "en"] as const) {
    const match = STAFF_FUNCTION_KEYS.find(
      (key) => STAFF_FUNCTION_LABELS[locale][key] === value
    );
    if (match) return match;
  }
  return null;
}

/** Whether a club function expects a license (custom functions: unknown → no). */
export function staffFunctionRequiresLicense(
  value: string | null | undefined
): boolean {
  const key = staffFunctionKey(value);
  return key ? STAFF_FUNCTIONS_WITH_LICENSE.includes(key) : false;
}

/**
 * Club functions that work inside a team scope. Others (president, directors,
 * secretary, kit manager, doctor) are not team-assigned, so the profile does
 * not push team editing on them.
 */
export const STAFF_FUNCTIONS_WITH_TEAM_SCOPE: readonly StaffFunctionKey[] = [
  "coach",
  "assistant_coach",
  "goalkeeper_coach",
  "fitness_coach",
];

/** Whether a club function is normally assigned to teams. */
export function staffFunctionHasTeamScope(
  value: string | null | undefined
): boolean {
  const key = staffFunctionKey(value);
  return key ? STAFF_FUNCTIONS_WITH_TEAM_SCOPE.includes(key) : false;
}

/**
 * A stored function row (staff_functions). Presets carry the catalogue key;
 * custom rows carry a free-text label instead.
 */
export interface StaffFunctionRef {
  function_key: string;
  custom_label?: string | null;
}

export function isPresetFunctionKey(
  value: string | null | undefined
): value is StaffFunctionKey {
  if (!value) return false;
  return (STAFF_FUNCTION_KEYS as readonly string[]).includes(value);
}

/** Localized display label for a stored function row. */
export function staffFunctionLabel(
  functionKey: string,
  locale: "sr" | "en",
  customLabel?: string | null
): string {
  if (isPresetFunctionKey(functionKey)) {
    return STAFF_FUNCTION_LABELS[locale][functionKey];
  }
  return customLabel?.trim() || functionKey;
}

/**
 * License tracking follows ANY assigned function, not just the primary one:
 * a person is license-tracked when at least one of their club functions
 * normally carries a professional license.
 */
export function staffFunctionsRequireLicense(
  functions: StaffFunctionRef[]
): boolean {
  return functions.some(
    (fn) =>
      isPresetFunctionKey(fn.function_key) &&
      STAFF_FUNCTIONS_WITH_LICENSE.includes(fn.function_key)
  );
}

/** Team scope follows ANY assigned function (same rule as licenses). */
export function staffFunctionsHaveTeamScope(
  functions: StaffFunctionRef[]
): boolean {
  return functions.some(
    (fn) =>
      isPresetFunctionKey(fn.function_key) &&
      STAFF_FUNCTIONS_WITH_TEAM_SCOPE.includes(fn.function_key)
  );
}

// NOTE: staffFunctionKey / staffFunctionRequiresLicense / staffFunctionHasTeamScope
// interpret the LEGACY staff.title label (kept in sync with the first function).
// New code reads staff_functions rows and uses the key-based helpers above.