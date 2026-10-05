import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

type Supabase = SupabaseClient<Database>;

/**
 * Name of the partial unique index (00040) that backstops per-team jersey
 * uniqueness. Used to tell a jersey-number conflict (23505) apart from any
 * other unique violation so we only translate THIS error into the friendly
 * message and never mask an unrelated database failure.
 */
export const JERSEY_INDEX_NAME = "seasonal_memberships_active_team_jersey_unique";

/** User-facing message for a jersey-number conflict. */
export function jerseyNumberTakenMessage(
  jerseyNumber: number,
  lang: "sr" | "en" = "sr"
): string {
  return lang === "en"
    ? `Number ${jerseyNumber} is already assigned to another player in this team.`
    : `Broj ${jerseyNumber} je već dodeljen drugom igraču u ovom timu.`;
}

/**
 * True when a Postgres error is the jersey-number unique violation (23505 on
 * JERSEY_INDEX_NAME). Anything else — including a different 23505 — returns
 * false so it stays surfaced as its original error.
 */
export function isJerseyNumberUniqueViolation(
  error: { code?: string; message?: string } | null | undefined
): boolean {
  return Boolean(
    error &&
      error.code === "23505" &&
      (error.message ?? "").includes(JERSEY_INDEX_NAME)
  );
}

/**
 * Is `jerseyNumber` already taken by another ACTIVE membership in the same
 * org + season + team? `excludeAthleteId` lets an edit skip the player being
 * edited so it never conflicts with itself. Returns false on a read error —
 * this is only the friendly pre-check; the DB unique index is the real backstop.
 */
export async function jerseyNumberTaken(
  supabase: Supabase,
  params: {
    organizationId: string;
    seasonId: string;
    teamId: string;
    jerseyNumber: number;
    excludeAthleteId?: string;
  }
): Promise<boolean> {
  let query = supabase
    .from("seasonal_memberships")
    .select("id")
    .eq("organization_id", params.organizationId)
    .eq("season_id", params.seasonId)
    .eq("team_id", params.teamId)
    .eq("jersey_number", params.jerseyNumber)
    .eq("status", "active");

  if (params.excludeAthleteId) {
    query = query.neq("athlete_id", params.excludeAthleteId);
  }

  const { data, error } = await query.limit(1);
  if (error) return false;
  return (data?.length ?? 0) > 0;
}
