/**
 * Season date-range rule (V1): both dates are ISO `YYYY-MM-DD`, and the end
 * must be strictly after the start. ISO strings compare correctly with `<`/`>`,
 * so no Date parsing (and no timezone pitfalls) is needed.
 */
export function isValidSeasonRange(
  startsOn: string | null | undefined,
  endsOn: string | null | undefined
): boolean {
  if (!startsOn || !endsOn) return false;
  return endsOn > startsOn;
}

export const SEASON_RANGE_ERROR = "Kraj sezone mora biti posle početka sezone.";
