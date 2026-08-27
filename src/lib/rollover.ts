/**
 * Season rollover logic (D-03).
 *
 * "Start New Season" copies the previous active season's athlete team
 * memberships into a new season. Athletes keep their previous team by default;
 * the guided review may move an athlete to a different team (U15 -> U17).
 * This module is PURE (no DB calls) so the carry-forward + validation rules are
 * unit-testable; the transaction that calls it lives in the season actions.
 */

export interface PrevMembership {
  athleteId: string;
  prevTeamId: string;
  jerseyNumber: number | null;
}

export interface CarryForward {
  seasonId: string;
  memberships: PrevMembership[];
}

/**
 * Build the new season's membership set from the previous season's.
 *
 * @param prevMemberships the previous season's memberships
 * @param newSeasonId     the season being created
 * @param moves           optional map of athleteId -> newTeamId for moved athletes
 * @returns the memberships to insert for the new season
 */
export function buildCarryForward(
  prevMemberships: PrevMembership[],
  newSeasonId: string,
  moves: Record<string, string> = {}
): CarryForward {
  return {
    seasonId: newSeasonId,
    memberships: prevMemberships.map((m) => ({
      athleteId: m.athleteId,
      prevTeamId: moves[m.athleteId] ?? m.prevTeamId,
      jerseyNumber: m.jerseyNumber,
    })),
  };
}

/**
 * Validate a rollover result against the org's teams.
 * Returns an array of error messages (empty when valid).
 *
 * Unknown team references would otherwise violate the team_id FK on insert;
 * catching them here surfaces a clear message to the caller before the
 * transaction runs.
 *
 * @param memberships the carry-forward memberships to validate
 * @param teamsById   map of teamId -> team (the org's teams)
 */
export function validateRollover(
  memberships: PrevMembership[],
  teamsById: Record<string, unknown>
): string[] {
  const errors: string[] = [];
  for (const m of memberships) {
    if (!(m.prevTeamId in teamsById)) {
      errors.push(
        `Neispravan tim '${m.prevTeamId}' za igrača '${m.athleteId}'`
      );
    }
  }
  return errors;
}
