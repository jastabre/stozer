import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/layout/EmptyState";
import { requireOrganization, hasPermission } from "@/lib/organization";
import { createServerClient } from "@/lib/supabase/server";
import { getOrganizationSettings } from "@/lib/club-data";
import { listStaff } from "@/lib/staff";
import { createStaffAction } from "./actions";

const toneClasses = {
  green: "bg-emerald-100 text-emerald-800",
  yellow: "bg-amber-100 text-amber-800",
  red: "bg-red-100 text-red-800",
} as const;

export default async function PeoplePage() {
  const org = await requireOrganization();
  const supabase = await createServerClient();
  const [canManage, settings] = await Promise.all([
    hasPermission("staff.manage"),
    getOrganizationSettings(supabase, org.organizationId),
  ]);
  const thresholdDays = settings?.warning_threshold_days ?? 30;
  const [staff, t] = await Promise.all([
    listStaff(supabase, org.organizationId, org, thresholdDays),
    getTranslations("people"),
  ]);

  const addForm = (
    <form action={createStaffAction} className="grid gap-3 sm:grid-cols-2">
      <input name="first_name" placeholder={t("firstName")} required className="rounded-lg border px-3 py-2 text-sm" />
      <input name="last_name" placeholder={t("lastName")} required className="rounded-lg border px-3 py-2 text-sm" />
      <input name="title" placeholder={t("titleField")} className="rounded-lg border px-3 py-2 text-sm" />
      <input name="email" type="email" placeholder={t("email")} className="rounded-lg border px-3 py-2 text-sm" />
      <input name="phone" type="tel" placeholder={t("phone")} className="rounded-lg border px-3 py-2 text-sm" />
      <input name="start_date" type="date" aria-label={t("startDate")} className="rounded-lg border px-3 py-2 text-sm" />
      <button type="submit" className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground sm:col-span-2">
        {t("addSubmit")}
      </button>
    </form>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">{t("eyebrow")}</p>
          <h1 className="mt-1 text-2xl font-bold">{t("title")}</h1>
        </div>
        {canManage && <span className="rounded-full border px-3 py-1 text-xs text-muted-foreground">{t("orgLicensing")}</span>}
      </div>

      {staff.length === 0 ? (
        <div className="space-y-6">
          <EmptyState title={t("empty.title")} description={t("empty.description")} />
          {canManage && <details className="rounded-xl border border-border p-4"><summary className="cursor-pointer text-sm font-medium">{t("add")}</summary><div className="mt-4">{addForm}</div></details>}
        </div>
      ) : (
        <div className="space-y-6">
          <div className="overflow-hidden rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr><th className="px-4 py-2">{t("table.name")}</th><th className="px-4 py-2">{t("table.title")}</th><th className="px-4 py-2">{t("table.teams")}</th><th className="px-4 py-2">{t("table.license")}</th><th className="px-4 py-2">{t("table.account")}</th></tr>
              </thead>
              <tbody>
                {staff.map((person) => {
                  const license = person.licenses[0];
                  const tone = license?.status ?? "red";
                  return (
                    <tr key={person.id} className="border-t border-border">
                      <td className="px-4 py-3 font-medium"><Link href={`/people/${person.id}`} className="hover:text-primary">{person.last_name} {person.first_name}</Link><div className="text-xs text-muted-foreground">{person.phone || person.email || "—"}</div></td>
                      <td className="px-4 py-3">{person.title || t("notSet")}</td>
                      <td className="px-4 py-3">{person.teams.length ? person.teams.map((team) => team.team_name).join(", ") : t("noTeams")}</td>
                      <td className="px-4 py-3">{license ? <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${toneClasses[tone]}`}>{t(`status.${tone}`)} · {license.valid_until}</span> : <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${toneClasses.red}`}>{t("status.red")}</span>}</td>
                      <td className="px-4 py-3">{person.user_id ? t("linked") : t("notLinked")}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {canManage && <details className="rounded-xl border border-border p-4"><summary className="cursor-pointer text-sm font-medium">{t("add")}</summary><div className="mt-4">{addForm}</div></details>}
        </div>
      )}
    </div>
  );
}
