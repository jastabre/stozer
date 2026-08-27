import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireOrganization, hasPermission } from "@/lib/organization";
import { createServerClient } from "@/lib/supabase/server";
import { listTeams } from "@/lib/club-data";
import { createTeam, deleteTeam, updateTeam } from "./actions";

const CATEGORIES = ["first_team", "youth", "academy", "other"] as const;

function CategorySelect({
  name,
  current,
  t,
}: {
  name: string;
  current?: string;
  t: Awaited<ReturnType<typeof getTranslations>>;
}) {
  return (
    <select
      name={name}
      defaultValue={current ?? ""}
      required
      aria-label={t("category")}
      className="rounded-lg border px-3 py-2 text-sm"
    >
      {!current && <option value="">{t("category")}</option>}
      {CATEGORIES.map((c) => (
        <option key={c} value={c}>
          {t(`categories.${c}`)}
        </option>
      ))}
    </select>
  );
}

export default async function TeamsPage() {
  const org = await requireOrganization();
  const supabase = await createServerClient();
  const t = await getTranslations("teams");

  const [teams, canCreate, canEdit, canDelete] = await Promise.all([
    listTeams(supabase, org.organizationId),
    hasPermission("teams.create"),
    hasPermission("teams.edit"),
    hasPermission("teams.delete"),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
      </div>

      {teams.length === 0 ? (
        <div className="rounded-xl border border-border p-6 text-sm text-muted-foreground">
          {t("empty")}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2">{t("table.name")}</th>
                <th className="px-4 py-2">{t("table.category")}</th>
                <th className="px-4 py-2">{t("table.sport")}</th>
                <th className="px-4 py-2">{t("table.athletes")}</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {teams.map((team) => (
                <tr key={team.id} className="border-t border-border">
                  <td className="px-4 py-2 font-medium">
                    <Link
                      href={`/teams/${team.id}/registrations`}
                      className="hover:text-primary"
                    >
                      {team.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2">{t(`categories.${team.category}`)}</td>
                  <td className="px-4 py-2">{team.sport}</td>
                  <td className="px-4 py-2">{team.athlete_count}</td>
                  <td className="px-4 py-2 text-right">
                    {(canEdit || canDelete) && (
                      <details className="inline-block">
                        <summary className="cursor-pointer text-xs font-medium text-primary">
                          {t("manage")}
                        </summary>
                        <div className="mt-2 w-64 space-y-3 rounded-lg border border-border bg-card p-3 text-left">
                          {canEdit && (
                            <form action={updateTeam} className="space-y-2">
                              <input type="hidden" name="id" value={team.id} />
                              <input
                                name="name"
                                defaultValue={team.name}
                                required
                                className="w-full rounded-lg border px-3 py-2 text-sm"
                              />
                              <CategorySelect name="category" current={team.category} t={t} />
                              <button
                                type="submit"
                                className="rounded-lg bg-primary px-3 py-1.5 text-xs text-primary-foreground"
                              >
                                {t("save")}
                              </button>
                            </form>
                          )}
                          {canDelete && (
                            <form action={deleteTeam}>
                              <input type="hidden" name="id" value={team.id} />
                              <button
                                type="submit"
                                className="w-full rounded-lg border border-destructive px-3 py-1.5 text-xs text-destructive"
                              >
                                {t("delete")}
                              </button>
                            </form>
                          )}
                        </div>
                      </details>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {canCreate && (
        <details className="rounded-xl border border-border p-4">
          <summary className="cursor-pointer text-sm font-medium">{t("add")}</summary>
          <form action={createTeam} className="mt-4 grid gap-3 sm:grid-cols-2">
            <input
              name="name"
              placeholder={t("name")}
              required
              className="rounded-lg border px-3 py-2 text-sm"
            />
            <CategorySelect name="category" t={t} />
            <button
              type="submit"
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground sm:col-span-2"
            >
              {t("submit")}
            </button>
          </form>
        </details>
      )}
    </div>
  );
}
