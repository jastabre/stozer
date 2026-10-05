import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil, UserRound } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { hasPermission, getOrganizationCurrency } from "@/lib/organization";
import { createServerClient } from "@/lib/supabase/server";
import { loadRoleMetadata, loadStaffShell } from "@/lib/staff-profile";
import {
  staffFunctionLabel,
  staffFunctionsHaveTeamScope,
} from "@/lib/staff-functions";
import { getStaffCompensation } from "@/lib/staff-finance-data";
import { formatDmy } from "@/lib/date-format";
import { StaffAccountCard } from "@/components/staff/StaffAccountCard";
import { StaffCompensationCard } from "@/components/staff/StaffCompensationCard";
import { StaffTeamsEditor } from "@/components/staff/StaffTeamsEditor";
import { saveStaffCompensationAction, saveStaffTeamsAction } from "../actions";

const blockTitle =
  "text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground";

export default async function StaffOverviewPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;

  const [canView, canManage, canEditAccess, canViewStaffFinance] =
    await Promise.all([
      hasPermission("staff.view"),
      hasPermission("staff.manage"),
      hasPermission("users.manage"),
      hasPermission("staff_finance.view"),
    ]);
  if (!canView) notFound();

  const [{ person, teams, activeSeason, account, org }, metadata] =
    await Promise.all([loadStaffShell(id), loadRoleMetadata()]);
  if (!person) notFound();

  const t = await getTranslations("people");
  const tc = await getTranslations("common");
  const role = person.role ? metadata[person.role] ?? null : null;
  const uiLocale: "sr" | "en" = locale === "en" ? "en" : "sr";

  const supabase = await createServerClient();
  const [compensation, moneyCurrency, canManageStaffFinance] = await Promise.all([
    getStaffCompensation(supabase, org.organizationId, id),
    getOrganizationCurrency(org.organizationId),
    hasPermission("staff_finance.manage"),
  ]);

  const showTeams =
    person.teams.length > 0 ||
    staffFunctionsHaveTeamScope(person.functions) ||
    person.role === "coach";

  const facts = [
    {
      label: t("phone"),
      value: person.phone,
      href: person.phone ? `tel:${person.phone}` : null,
    },
    {
      label: t("email"),
      value: person.email,
      href: person.email ? `mailto:${person.email}` : null,
    },
    {
      label: t("startDate"),
      value: person.start_date ? formatDmy(person.start_date) : null,
      href: null,
    },
    {
      label: t("endDate"),
      value: person.end_date ? formatDmy(person.end_date) : null,
      href: null,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Identity first: what this person DOES in the club, then the teams.
          Stožer access is deliberately the quietest block, at the bottom. */}
      <section className="rounded-xl border border-border bg-card p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
          <h2 className="text-base font-semibold text-foreground">
            {t("roleEngagementTitle")}
          </h2>
          {person.athlete && (
            <Link
              href={`/${locale}/players/${person.athlete.id}`}
              className="inline-flex items-center gap-1.5 rounded-md border border-primary/30 bg-primary/5 px-2.5 py-1 text-xs font-medium text-primary transition-colors hover:border-primary"
            >
              <UserRound className="h-3.5 w-3.5" aria-hidden="true" />
              {t("playerBadge")}
              {person.athlete.team_name ? ` · ${person.athlete.team_name}` : ""}
            </Link>
          )}
        </div>

        <div
          className={`mt-4 grid gap-5 ${
            showTeams ? "sm:grid-cols-2 sm:gap-8" : ""
          }`}
        >
          <div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <h3 className={blockTitle}>{t("functionsTitle")}</h3>
              {canManage && (
                <Link
                  href="?edit=1"
                  scroll={false}
                  className="inline-flex h-7 items-center gap-1.5 rounded-md border border-primary/30 bg-primary/5 px-2 text-xs font-medium text-primary transition-colors hover:border-primary/60 hover:bg-primary/10 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring"
                >
                  <Pencil className="h-3 w-3" aria-hidden="true" />
                  {t("editFunctions")}
                </Link>
              )}
            </div>
            <ul className="mt-2.5 flex flex-wrap gap-2">
              {person.functions.map((fn) => (
                <li
                  key={fn.id}
                  className="inline-flex items-center rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-semibold text-foreground"
                >
                  {staffFunctionLabel(
                    fn.function_key,
                    uiLocale,
                    fn.custom_label
                  )}
                </li>
              ))}
              {person.functions.length === 0 && (
                <li className="text-sm text-muted-foreground">
                  {person.title || "—"}
                </li>
              )}
            </ul>
          </div>

          {showTeams && (
            <StaffTeamsEditor
              action={
                canManage && activeSeason ? saveStaffTeamsAction : undefined
              }
              staffId={person.id}
              seasonId={activeSeason?.id ?? ""}
              teams={teams}
              currentTeamIds={person.teams.map((team) => team.team_id)}
              canEdit={canManage}
              labels={{
                title: t("assignedTeamsTitle"),
                edit: t("editTeams"),
                save: t("saveTeams"),
                saving: t("submitting"),
                cancel: tc("cancel"),
                empty: t("noTeams"),
              }}
            />
          )}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-foreground">
          {t("contactEngagement")}
        </h2>
        <dl className="mt-3 grid gap-x-10 gap-y-2.5 text-sm sm:grid-cols-2">
          {facts.map((fact) => (
            <div key={fact.label} className="flex items-baseline justify-between gap-4">
              <dt className="text-muted-foreground">{fact.label}</dt>
              <dd className="text-right font-medium text-foreground">
                {fact.value ? (
                  fact.href ? (
                    <a href={fact.href} className="hover:text-primary">
                      {fact.value}
                    </a>
                  ) : (
                    fact.value
                  )
                ) : (
                  <span className="font-normal text-muted-foreground">—</span>
                )}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {canViewStaffFinance && (
        <StaffCompensationCard
          staffId={person.id}
          compensation={compensation}
          currency={moneyCurrency}
          canManage={canManageStaffFinance}
          action={saveStaffCompensationAction}
          labels={{
            title: t("compensation.title"),
            monthly: t("compensation.monthly"),
            noCompensation: t("compensation.noCompensation"),
            validFrom: t("compensation.validFrom"),
            validUntil: t("compensation.validUntil"),
            note: t("compensation.note"),
            notePlaceholder: t("compensation.notePlaceholder"),
            save: t("compensation.save"),
            saving: t("compensation.saving"),
            saved: t("compensation.saved"),
            error: t("compensation.error"),
            none: t("compensation.none"),
            from: t("compensation.from"),
            to: t("compensation.to"),
          }}
        />
      )}

      <StaffAccountCard
        account={account}
        canEditAccess={canEditAccess}
        role={role}
        locale={locale}
      />
    </div>
  );
}
