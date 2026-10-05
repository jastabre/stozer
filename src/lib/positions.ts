/**
 * Sport-aware position presets for player profiles.
 *
 * Positions are stored as free text on the athlete (V1 keeps the column open
 * for customs and other sports). The preset list is used ONLY as an input
 * helper: it fills localized options and keeps a free-text "Ostalo" escape
 * hatch so custom/foreign values are never lost. The selected preset is saved
 * in the current locale as the stored value.
 */

export const FOOTBALL_POSITION_KEYS = [
  "goalkeeper",
  "right_back",
  "center_back",
  "left_back",
  "defensive_midfielder",
  "central_midfielder",
  "attacking_midfielder",
  "right_wing",
  "left_wing",
  "striker",
] as const;

export const BASKETBALL_POSITION_KEYS = [
  "point_guard",
  "shooting_guard",
  "small_forward",
  "power_forward",
  "center",
] as const;

export type PositionKey =
  | (typeof FOOTBALL_POSITION_KEYS)[number]
  | (typeof BASKETBALL_POSITION_KEYS)[number];

export const POSITION_LABELS: Record<
  "sr" | "en",
  Record<PositionKey, string>
> = {
  sr: {
    goalkeeper: "Golman",
    right_back: "Desni bek",
    center_back: "Štoper",
    left_back: "Levi bek",
    defensive_midfielder: "Defanzivni vezni",
    central_midfielder: "Centralni vezni",
    attacking_midfielder: "Ofanzivni vezni",
    right_wing: "Desno krilo",
    left_wing: "Levo krilo",
    striker: "Napadač",
    point_guard: "Plejmejker",
    shooting_guard: "Bek šuter",
    small_forward: "Krilo",
    power_forward: "Krilni centar",
    center: "Centar",
  },
  en: {
    goalkeeper: "Goalkeeper",
    right_back: "Right back",
    center_back: "Center back",
    left_back: "Left back",
    defensive_midfielder: "Defensive midfielder",
    central_midfielder: "Central midfielder",
    attacking_midfielder: "Attacking midfielder",
    right_wing: "Right winger",
    left_wing: "Left winger",
    striker: "Striker",
    point_guard: "Point guard",
    shooting_guard: "Shooting guard",
    small_forward: "Small forward",
    power_forward: "Power forward",
    center: "Center",
  },
};

/** Positions suggested for a sport (null sport -> football defaults). */
export function positionsForSport(
  sport: string | null | undefined,
  locale: "sr" | "en"
): { key: string; label: string }[] {
  const keys: readonly PositionKey[] =
    sport === "basketball"
      ? BASKETBALL_POSITION_KEYS
      : FOOTBALL_POSITION_KEYS;
  return keys.map((key) => ({
    key,
    label: POSITION_LABELS[locale][key],
  }));
}

/** Whether a stored position value is one of the known presets. */
export function isPresetPosition(
  value: string | null | undefined,
  sport: string | null | undefined,
  locale: "sr" | "en"
): boolean {
  if (!value) return false;
  return positionsForSport(sport, locale).some((p) => p.label === value);
}