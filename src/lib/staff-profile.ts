import { cache } from "react";
import { getTranslations } from "next-intl/server";
import { createServerClient } from "@/lib/supabase/server";
import { requireOrganization } from "@/lib/organization";
import { getActiveSeason, getOrganizationSettings, listTeams } from "@/lib/club-data";
import { getStaffProfile } from "@/lib/staff";
import { getAccountOverview } from "@/lib/club-users";
import { ACCESS_ROLES, isTeamScopedRole } from "@/lib/roles";
import { summarizeCapabilities } from "@/lib/role-capabilities";
import type { AppRole } from "@/types/database";

/**
 * Per-request cache of the shared staff-profile shell data (organization,
 * Supabase client, profile, teams, active season, club settings, account).
 *
 * The layout and every tab page call this; React's `cache` dedupes the work
 * within a single request, so tabs read the profile once instead of re-querying
 * in the shell and in the page.
 */
export const loadStaffShell = cache(async (staffId: string) => {
  const org = await requireOrganization();
  const supabase = await createServerClient();
  const [settings, teams, activeSeason] = await Promise.all([
    getOrganizationSettings(supabase, org.organizationId),
    listTeams(supabase, org.organizationId),
    getActiveSeason(supabase, org.organizationId),
  ]);
  const person = await getStaffProfile(
    supabase,
    org.organizationId,
    staffId,
    org,
    settings?.warning_threshold_days ?? 30
  );
  const account = person?.user_id
    ? await getAccountOverview(person.user_id)
    : null;
  return { org, supabase, person, teams, activeSeason, settings, account };
});

export interface RoleMetadataView {
  key: AppRole;
  /** Localized role name, e.g. "Trener". */
  label: string;
  /** Localized one-line purpose. */
  description: string;
  /** True when the role's access is organized around team assignments. */
  teamScoped: boolean;
  /** Localized scope name, e.g. "Ceo klub" / "Dodeljeni timovi". */
  scopeLabel: string;
  /** Short positive phrases for the main summary, e.g. "Igrači i timovi". */
  summary: string[];
  /** Short "no access" phrases, priority-ordered. */
  denied: string[];
  /** Grouped real capabilities for "Prikaži detaljne dozvole". */
  details: {
    key: string;
    label: string;
    items: { area: string; actions: string[]; denied: boolean }[];
  }[];
}

/**
 * Read-only metadata per assignable role, derived from the SAME backend
 * role_permissions table that authorize()/RLS consult (shared reference data,
 * readable by any authenticated user). Presentation grouping lives in
 * role-capabilities.ts; no permission is hardcoded here.
 */
export const loadRoleMetadata = cache(
  async (): Promise<Record<AppRole, RoleMetadataView>> => {
    const supabase = await createServerClient();
    const t = await getTranslations("people");
    const { data } = await supabase
      .from("role_permissions")
      .select("role, permission");

    const byRole = new Map<AppRole, string[]>();
    for (const row of data ?? []) {
      const list = byRole.get(row.role) ?? [];
      list.push(row.permission);
      byRole.set(row.role, list);
    }

    const views = {} as Record<AppRole, RoleMetadataView>;
    for (const role of ACCESS_ROLES) {
      const permissions = byRole.get(role) ?? [];
      const breakdown = summarizeCapabilities(permissions);
      views[role] = {
        key: role,
        label: t(`roles.${role}`),
        description: t(`roleMeta.${role}.description`),
        teamScoped: isTeamScopedRole(role),
        scopeLabel: isTeamScopedRole(role)
          ? t("access.scopeTeams")
          : t("access.scopeClub"),
        summary: breakdown.summary.map((key) => t(`access.summary.${key}`)),
        denied: breakdown.denied.map((key) => t(`access.summary.${key}`)),
        details: breakdown.details.map((group) => ({
          key: group.key,
          label: t(`access.detailGroups.${group.key}`),
          items: group.items.map((item) => ({
            area: t(`access.areas.${item.area}`),
            actions: item.actions.map((action) =>
              t(`access.actions.${action}`)
            ),
            denied: item.denied,
          })),
        })),
      };
    }
    return views;
  }
);
