/**
 * V1 club currency: ONE currency per organization, chosen in Settings and
 * stored on `organizations.currency`. Existing amounts are never converted —
 * there is no FX logic; the per-row currency columns on contracts/payments stay
 * as historical snapshots.
 */
export const SUPPORTED_CURRENCIES = ["RSD", "EUR"] as const;

export type Currency = (typeof SUPPORTED_CURRENCIES)[number];

/**
 * Default for a NEW club, derived from the country picked at onboarding:
 * Serbia ("RS") -> RSD, every other country -> EUR (the current V1 rule).
 * Never derived from the UI language.
 */
export function defaultCurrencyForCountry(country: string | null | undefined): Currency {
  return country?.trim().toUpperCase() === "RS" ? "RSD" : "EUR";
}

/**
 * Normalize a stored organization currency to a supported code. Missing or
 * unsupported values fall back to RSD (Serbia-first), never to a converted
 * amount — existing V1 clubs keep their stored currency.
 */
export function normalizeCurrency(value: string | null | undefined): Currency {
  return value?.trim().toUpperCase() === "EUR" ? "EUR" : "RSD";
}
