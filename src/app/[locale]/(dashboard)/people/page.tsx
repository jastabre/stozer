import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/layout/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { AddStaffDrawer } from "@/components/staff/AddStaffDrawer";
import { requireOrganization, hasPermission } from "@/lib/organization";
import { createServerClient } from "@/lib/supabase/server";
import { getOrganizationSettings } from "@/lib/club-data";
import { listStaff, listLinkableAthletes, type StaffSummary } from "@/lib/staff";
import { listAllAccountOverviews, type AccountOverview } from "@/lib/club-users";
import { ACCESS_ROLES } from "@/lib/roles";
import {
  staffFunctionLabel,
  staffFunctionsRequireLicense,
} from "@/lib/staff-functions";
import { formatDmy } from "@/lib/date-format";
import { createStaffMemberAction } from "./actions";

function AccountCell({
  person,
  account,
  labels,
  roles,
}: {
  person: StaffSummary;
  account: AccountOverview | null;
  labels: {
    noAccount: string;
    active: string;
    invited: string;
    disabled: string;
  };
  roles: Record<string, string>;
}) {
  if (!person.user_id) {
    return <StatusBadge tone="muted" label={labels.noAccount} />;
  }
  if (account?.status === "disabled") {
    return <StatusBadge tone="red" label={labels.disabled} />;
  }
  if (account?.status === "invited") {
    return <StatusBadge tone="blue" label={labels.invited} />;
  }
  return (
    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
      <StatusBadge tone="green" label={labels.active} />
      {person.role && (
        <span className="text-xs text-muted-foreground">
          · {roles[person.role] ?? "—"}
        </span>
      )}
    </div>
  );
}

export default async function PeoplePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const org = await requireOrganization();
  const supabase = await createServerClient();
  const [canManage, settings] = await Promise.all([
    hasPermission("staff.manage"),
    getOrganizationSettings(supabase, org.organizationId),
  ]);
  const thresholdDays = settings?.warning_threshold_days ?? 30;
  const [staff, accounts, athleteOptions, t] = await Promise.all([
    listStaff(supabase, org.organizationId, org, thresholdDays),
    listAllAccountOverviews(),
    listLinkableAthletes(supabase, org.organizationId),
    getTranslations("people"),
  ]);
  const tc = await getTranslations("common");

  const uiLocale: "sr" | "en" = locale === "en" ? "en" : "sr";
  const functionLabels = (person: StaffSummary): string[] => {
    const labels = person.functions.map((fn) =>
      staffFunctionLabel(fn.function_key, uiLocale, fn.custom_label)
    );
    if (labels.length === 0 && person.title) return [person.title];
    return labels;
  };

  const roleLabels: Record<string, string> = Object.fromEntries(
    [...ACCESS_ROLES, "super_admin"].map((role) => [role, t(`roles.${role}`)])
  );
  const accountLabels = {
    noAccount: t("account.noAccount"),
    active: t("account.active"),
    invited: t("account.invited"),
    disabled: t("account.disabled"),
  };

  const addTrigger = (
    <AddStaffDrawer
      action={createStaffMemberAction}
      locale={uiLocale}
      athleteOptions={athleteOptions}
      labels={{
        trigger: t("add"),
        title: t("addTitle"),
        subtitle: t("addSubtitle"),
        basicInfo: t("basicInfo"),
        contact: t("contactSection"),
        engagement: t("engagementSection"),
        firstName: t("firstName"),
        lastName: t("lastName"),
        modeNew: t("modeNew"),
        modeExisting: t("modeExisting"),
        athleteSearch: t("athleteSearch"),
        athleteSearchPlaceholder: t("athleteSearchPlaceholder"),
        athleteEmpty: t("athleteEmpty"),
        athleteSelected: t("athleteSelected"),
        athleteNoTeam: t("athleteNoTeam"),
        titleField: t("functionsTitle"),
        addFunction: t("addFunction"),
        removeFunction: t("removeFunction"),
        otherFunction: t("otherFunction"),
        customFunctionPlaceholder: t("customFunctionPlaceholder"),
        functionSelectPlaceholder: t("functionSelectPlaceholder"),
        accountInfoTitle: t("accountInfoTitle"),
        accountInfoBody: t("accountInfoBody"),
        email: t("email"),
        emailHint: t("contactEmailHint"),
        phone: t("phone"),
        startDate: t("startDate"),
        endDate: t("endDate"),
        submit: t("addSubmit"),
        submitting: t("addSubmitting"),
        linkSubmit: t("linkSubmit"),
        linkSubmitting: t("linkSubmitting"),
        cancel: tc("cancel"),
        close: tc("close"),
      }}
      triggerClassName="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
    />
  );

  return (
    <div className="space-y-5">
      <PageHeader title={t("title")} eyebrow={t("eyebrow")}>
        {canManage && addTrigger}
      </PageHeader>

      {staff.length === 0 ? (
        <div className="space-y-5">
          <EmptyState title={t("empty.title")} description={t("empty.description")} />
          {canManage && <div className="flex justify-center">{addTrigger}</div>}
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-hidden rounded-xl border border-border bg-card md:block">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 font-medium">{t("table.name")}</th>
                  <th className="px-4 py-2.5 font-medium">{t("table.title")}</th>
                  <th className="px-4 py-2.5 font-medium">{t("table.teams")}</th>
                  <th className="px-4 py-2.5 font-medium">{t("table.account")}</th>
                  <th className="px-4 py-2.5 font-medium">{t("table.license")}</th>
                </tr>
              </thead>
              <tbody>
                {staff.map((person) => {
                  const license = person.licenses[0];
                  const requiresLicense = staffFunctionsRequireLicense(
                    person.functions
                  );
                  const labels = functionLabels(person);
                  const visibleFunctions =
                    labels.length <= 2 ? labels : labels.slice(0, 2);
                  const hiddenFunctions = labels.length - visibleFunctions.length;
                  const teamNames = person.teams.map((team) => team.team_name);
                  const tooltip = [
                    hiddenFunctions > 0 ? labels.join(", ") : "",
                    teamNames.length > 2 ? teamNames.join(", ") : "",
                  ]
                    .filter(Boolean)
                    .join(" · ");
                  const account = person.user_id
                    ? accounts.get(person.user_id) ?? null
                    : null;
                  return (
                    <tr
                      key={person.id}
                      className="group relative border-t border-border transition-colors hover:bg-muted/40"
                    >
                      <td className="px-4 py-2.5">
                        <Link
                          href={`/${locale}/people/${person.id}`}
                          aria-label={`${person.last_name} ${person.first_name}`}
                          title={tooltip || undefined}
                          className="absolute inset-0 z-10 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
                        />
                        <div className="flex items-center gap-3">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-xs font-semibold text-primary">
                            {person.first_name.charAt(0)}
                            {person.last_name.charAt(0)}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate font-medium text-foreground transition-colors group-hover:text-primary">
                              {person.last_name} {person.first_name}
                            </p>
                            <div className="truncate text-xs text-muted-foreground">
                              {person.phone || person.email || "—"}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        <span className="font-medium text-foreground">
                          {visibleFunctions[0] ?? "—"}
                        </span>
                        {visibleFunctions.length > 1 && (
                          <span>
                            {" · "}
                            {visibleFunctions.slice(1).join(" · ")}
                          </span>
                        )}
                        {hiddenFunctions > 0 && (
                          <span className="ml-1 text-xs">
                            +{hiddenFunctions}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        {teamNames.length > 0 ? (
                          <span>
                            {teamNames.slice(0, 2).join(", ")}
                            {teamNames.length > 2 && (
                              <span className="ml-1 text-xs">
                                +{teamNames.length - 2}
                              </span>
                            )}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        <AccountCell
                          person={person}
                          account={account}
                          labels={accountLabels}
                          roles={roleLabels}
                        />
                      </td>
                      <td className="px-4 py-2.5">
                        {license ? (
                          <StatusBadge
                            tone={license.status ?? "red"}
                            label={`${t(`status.${license.status ?? "red"}`)} · ${formatDmy(
                              license.valid_until
                            )}`}
                          />
                        ) : requiresLicense ? (
                          <StatusBadge tone="red" label={t("status.missing")} />
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <ul className="space-y-2 md:hidden">
            {staff.map((person) => {
              const license = person.licenses[0];
              const requiresLicense = staffFunctionsRequireLicense(
                person.functions
              );
              const labels = functionLabels(person);
              const visibleFunctions =
                labels.length <= 2 ? labels : labels.slice(0, 2);
              const hiddenFunctions = labels.length - visibleFunctions.length;
              const teamNames = person.teams.map((team) => team.team_name);
              const account = person.user_id
                ? accounts.get(person.user_id) ?? null
                : null;
              return (
                <li key={person.id}>
                  <Link
                    href={`/${locale}/people/${person.id}`}
                    className="block rounded-xl border border-border bg-card p-3.5 transition-colors hover:bg-muted/40"
                  >
                    <div className="flex items-start gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-xs font-semibold text-primary">
                        {person.first_name.charAt(0)}
                        {person.last_name.charAt(0)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate font-medium text-foreground">
                              {person.last_name} {person.first_name}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                              {visibleFunctions.join(" · ")}
                              {hiddenFunctions > 0 &&
                                ` +${hiddenFunctions}`}
                              {teamNames.length > 0 &&
                                ` · ${teamNames.slice(0, 2).join(", ")}${
                                  teamNames.length > 2
                                    ? ` +${teamNames.length - 2}`
                                    : ""
                                }`}
                            </p>
                          </div>
                          <div className="shrink-0">
                            {license ? (
                              <StatusBadge
                                tone={license.status ?? "red"}
                                label={t(`status.${license.status ?? "red"}`)}
                              />
                            ) : requiresLicense ? (
                              <StatusBadge tone="red" label={t("status.missing")} />
                            ) : null}
                          </div>
                        </div>
                        <div className="mt-2">
                          <AccountCell
                            person={person}
                            account={account}
                            labels={accountLabels}
                            roles={roleLabels}
                          />
                        </div>
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
