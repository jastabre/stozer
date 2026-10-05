import { getTranslations } from "next-intl/server";
import { requireOrganization, requirePermission } from "@/lib/organization";
import { createServerClient } from "@/lib/supabase/server";
import { getActiveSeason, listTeams } from "@/lib/club-data";
import { isClubPresident, listLinkableStaff, listOrgUsers } from "@/lib/club-users";
import { loadRoleMetadata } from "@/lib/staff-profile";
import { ACCESS_ROLES } from "@/lib/roles";
import { buildClubTabs } from "@/lib/club-nav";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/layout/EmptyState";
import { ProfileTabs } from "@/components/ui/ProfileTabs";
import { UsersTable } from "@/components/club/UsersTable";
import { AddUserDrawer } from "@/components/club/AddUserDrawer";
import { RoleRegistrySection } from "@/components/club/RoleRegistrySection";
import {
  addUserAction,
  resendInviteAction,
  setAccountDisabledAction,
  updateUserAccessAction,
} from "../actions";
import type { AccountStatus } from "@/lib/account-status";

export default async function ClubUsersPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ add?: string; user?: string }>;
}) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  await requirePermission("users.manage");
  const org = await requireOrganization();
  const supabase = await createServerClient();

  const t = await getTranslations("club");
  const tp = await getTranslations("people");
  const tcommon = await getTranslations("common");

  const tabs = await buildClubTabs(locale, {
    settings: t("tabs.settings"),
    users: t("tabs.users"),
    documents: t("tabs.documents"),
    facilities: t("tabs.facilities"),
  });

  const [users, staffOptions, teams, activeSeason, metadata, canAddAccount] =
    await Promise.all([
      listOrgUsers(org.organizationId, org.userId),
      listLinkableStaff(org.organizationId),
      listTeams(supabase, org.organizationId),
      getActiveSeason(supabase, org.organizationId),
      loadRoleMetadata(),
      isClubPresident(org.organizationId, org.userId),
    ]);

  const roles = ACCESS_ROLES.map((role) => metadata[role]);
  // Deep links from the staff profile: ?add=<staffId> pre-selects the person in
  // the add drawer, ?user=<userId> opens the access drawer for that account.
  const addStaff =
    canAddAccount && query.add
      ? staffOptions.find((option) => option.id === query.add) ?? null
      : null;
  const initialUserId =
    query.user && users.some((user) => user.userId === query.user)
      ? query.user
      : null;
  const counts = users.reduce(
    (acc, user) => {
      acc[user.status] += 1;
      return acc;
    },
    { none: 0, active: 0, invited: 0, disabled: 0 }
  );

  const statusLabels: Record<AccountStatus, string> = {
    none: t("users.status.none"),
    active: t("users.status.active"),
    invited: t("users.status.invited"),
    disabled: t("users.status.disabled"),
  };
  const roleLabels: Record<string, string> = Object.fromEntries(
    [...ACCESS_ROLES, "super_admin"].map((role) => [role, tp(`roles.${role}`)])
  );

  const summaryParts = [
    t("users.summary.active", { count: counts.active }),
    counts.invited > 0
      ? t("users.summary.invited", { count: counts.invited })
      : null,
    counts.disabled > 0
      ? t("users.summary.disabled", { count: counts.disabled })
      : null,
  ].filter((part): part is string => part != null);

  const triggerClassName =
    "inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60";

  const addDialogLabels = {
    trigger: t("users.addTrigger"),
    title: t("users.addTitle"),
    staff: t("users.staff"),
    staffPlaceholder: t("users.staffPlaceholder"),
    staffFunction: tp("titleField"),
    noStaff: t("users.noStaff"),
    email: t("users.email"),
    emailHint: tp("access.emailHint"),
    role: t("users.role"),
    rolePlaceholder: t("users.rolePlaceholder"),
    roleHint: t("users.roleHint"),
    teams: t("users.teams"),
    teamsHint: t("users.teamsHint"),
    chooseTeams: tp("access.chooseTeams"),
    removeTeam: tp("access.removeTeam"),
    noSeason: t("users.noSeason"),
    scope: t("users.scope"),
    canTitle: t("users.can"),
    deniedTitle: t("users.cannot"),
    detailsToggle: tp("access.showDetails"),
    noAccess: tp("access.noAccess"),
    submit: t("users.addSubmit"),
    submitting: t("users.addSubmitting"),
    close: tcommon("close"),
  };

  const drawerLabels = {
    linkedStaff: t("users.linkedStaff"),
    noLinkedStaff: t("users.noLinkedStaff"),
    role: t("users.role"),
    rolePlaceholder: t("users.rolePlaceholder"),
    teams: t("users.teams"),
    teamsHint: t("users.teamsHint"),
    chooseTeams: tp("access.chooseTeams"),
    removeTeam: tp("access.removeTeam"),
    noSeason: t("users.noSeason"),
    scope: t("users.scope"),
    canTitle: t("users.can"),
    deniedTitle: t("users.cannot"),
    detailsToggle: tp("access.showDetails"),
    noAccess: tp("access.noAccess"),
    save: t("users.save"),
    saving: t("users.saving"),
    saved: t("users.saved"),
    resend: t("users.resend"),
    resending: t("users.resending"),
    resendOk: t("users.resendOk"),
    deactivate: t("users.deactivate"),
    deactivateConfirmTitle: t("users.deactivateConfirmTitle"),
    deactivateConfirmBody: t("users.deactivateConfirmBody"),
    deactivateConfirm: t("users.deactivateConfirm"),
    deactivating: t("users.deactivating"),
    reactivate: t("users.reactivate"),
    reactivating: t("users.reactivating"),
    cancel: tcommon("cancel"),
    selfNote: t("users.selfNote"),
    close: tcommon("close"),
  };

  return (
    <div className="space-y-5">
      <ProfileTabs label={t("tabs.label")} items={tabs} />

      <PageHeader title={t("users.title")} description={t("users.subtitle")}>
        {canAddAccount ? (
          <AddUserDrawer
            action={addUserAction}
            staffOptions={staffOptions}
            defaultStaffId={addStaff?.id}
            defaultOpen={Boolean(addStaff)}
            locale={locale === "en" ? "en" : "sr"}
            teams={teams}
            seasonId={activeSeason?.id ?? null}
            roles={roles}
            labels={addDialogLabels}
            triggerClassName={triggerClassName}
          />
        ) : (
          <button
            type="button"
            disabled
            title={t("users.presidentOnly")}
            className={triggerClassName}
          >
            {t("users.addTrigger")}
          </button>
        )}
      </PageHeader>

      <p className="text-sm text-muted-foreground">{summaryParts.join(" · ")}</p>

      {users.length === 0 ? (
        <EmptyState
          title={t("users.empty.title")}
          description={t("users.empty.description")}
        />
      ) : (
        <UsersTable
          users={users}
          teams={teams}
          seasonId={activeSeason?.id ?? null}
          roles={roles}
          initialSelectedUserId={initialUserId}
          updateAction={updateUserAccessAction}
          resendAction={resendInviteAction}
          disableAction={setAccountDisabledAction}
          statusLabels={statusLabels}
          roleLabels={roleLabels}
          labels={{
            columns: {
              user: t("users.columns.user"),
              role: t("users.columns.role"),
              scope: t("users.columns.scope"),
              status: t("users.columns.status"),
            },
            clubScope: t("users.clubScope"),
            noScope: t("users.noScope"),
            drawer: drawerLabels,
          }}
        />
      )}

      <RoleRegistrySection
        roles={roles}
        labels={{
          title: t("users.registry.title"),
          description: t("users.registry.description"),
          selectorLabel: t("users.registry.selectorLabel"),
          scope: t("users.scope"),
          canTitle: t("users.can"),
          deniedTitle: t("users.cannot"),
          detailsToggle: tp("access.showDetails"),
          noAccess: tp("access.noAccess"),
        }}
      />
    </div>
  );
}
