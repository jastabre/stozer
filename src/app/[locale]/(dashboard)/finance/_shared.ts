import { notFound } from "next/navigation";
import { getActiveSeason } from "@/lib/club-data";
import { normalizeCurrency } from "@/lib/currency";
import { hasPermission, requireOrganization } from "@/lib/organization";
import { createServerClient } from "@/lib/supabase/server";

/**
 * Shared context for the central first-team finance screens (Finansije →
 * Isplate igrača). Mirrors the team-scoped loadTeamPaymentsContext but is
 * organization-wide: no team header, no roster size, just the active season,
 * the club currency and the "today" used by status logic.
 */
export async function loadFinancePlayersContext(locale: string) {
  const org = await requireOrganization();
  const canView = await hasPermission("first_team_finance.view");
  if (!canView) notFound();

  const supabase = await createServerClient();
  const [canManage, season, orgRow] = await Promise.all([
    hasPermission("first_team_finance.manage"),
    getActiveSeason(supabase, org.organizationId),
    supabase
      .from("organizations")
      .select("currency")
      .eq("id", org.organizationId)
      .maybeSingle()
      .then((r) => r.data),
  ]);

  return {
    org,
    supabase,
    canManage,
    season,
    lng: (locale === "en" ? "en" : "sr") as "sr" | "en",
    moneyCurrency: normalizeCurrency(orgRow?.currency),
    now: new Date(),
  };
}
