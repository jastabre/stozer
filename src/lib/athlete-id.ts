/**
 * Club athlete ID utilities (D-05).
 *
 * The club athlete ID is a stable, auto-assigned sequential number used as the
 * "poziv na broj" payment reference. Format is a C-prefixed number zero-padded
 * to a minimum of 4 digits. It is never reassigned.
 *
 * This module is PURE — the counter mutation lives in the DB layer (see
 * club-data.ts createAthlete), never here.
 */

/**
 * Format a club athlete number as its payment-reference string.
 * 1 -> 'C0001', 42 -> 'C0042', 9999 -> 'C9999', 12345 -> 'C12345'.
 */
export function formatClubAthleteNumber(n: number): string {
  return "C" + n.toString().padStart(4, "0");
}

/**
 * Compute the next club athlete number from an org's counter.
 * Returns counter + 1 without mutating the org object.
 */
export function buildClubAthleteNumber(org: {
  club_athlete_counter: number;
}): number {
  return org.club_athlete_counter + 1;
}
