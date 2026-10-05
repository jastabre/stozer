import { notFound } from "next/navigation";
import { getActiveSeason, countTeamMembers } from "@/lib/club-data";
import { normalizeCurrency } from "@/lib/currency";
import { hasPermission, requireOrganization } from "@/lib/organization";
import { createServerClient } from "@/lib/supabase/server";

/**
 * Shared context for both first-team payment screens (season overview and
 * month detail): org/permissions, active season, the first-team check, roster
 * size, the club's single currency and the "today" used by the status logic.
 * Redirects/404s exactly like the rest of the app.
 */
export async function loadTeamPaymentsContext(locale: string, teamId: string) {
  const org = await requireOrganization();
  const canView = await hasPermission("first_team_finance.view");
  if (!canView) notFound();

  const supabase = await createServerClient();
  const [canManage, season, teamResp, orgRow] = await Promise.all([
    hasPermission("first_team_finance.manage"),
    getActiveSeason(supabase, org.organizationId),
    supabase
      .from("teams")
      .select("id, name, category, organization_id")
      .eq("id", teamId)
      .eq("organization_id", org.organizationId)
      .maybeSingle(),
    supabase
      .from("organizations")
      .select("currency")
      .eq("id", org.organizationId)
      .maybeSingle()
      .then((result) => result.data),
  ]);
  const team = teamResp.data;
  if (!team) notFound();

  // First-team finance only.
  if (team.category !== "first_team") notFound();

  const memberCount = season
    ? await countTeamMembers(supabase, org.organizationId, teamId, season.id)
    : 0;

  return {
    org,
    supabase,
    canManage,
    season,
    team,
    memberCount,
    lng: (locale === "en" ? "en" : "sr") as "sr" | "en",
    // V1: the whole screen uses the club's single currency; per-row currency
    // columns remain stored snapshots and are never aggregated as mixed units.
    moneyCurrency: normalizeCurrency(orgRow?.currency),
    now: new Date(),
  };
}
