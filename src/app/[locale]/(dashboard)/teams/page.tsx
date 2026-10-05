import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireOrganization, hasPermission } from "@/lib/organization";
import { createServerClient } from "@/lib/supabase/server";
import { listTeams } from "@/lib/club-data";
import { createTeam, deleteTeam, updateTeam } from "./actions";
import { AddTeam } from "@/components/teams/AddTeam";
import { TeamManageDialog } from "@/components/teams/TeamManageDialog";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/layout/EmptyState";

const CATEGORIES = ["first_team", "youth", "academy", "other"] as const;

export default async function TeamsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const org = await requireOrganization();
  const supabase = await createServerClient();
  const t = await getTranslations("teams");
  const tc = await getTranslations("common");

  const [teams, canCreate, canEdit, canDelete] = await Promise.all([
    listTeams(supabase, org.organizationId),
    hasPermission("teams.create"),
    hasPermission("teams.edit"),
    hasPermission("teams.delete"),
  ]);

  const categories = CATEGORIES.map((value) => ({
    value,
    label: t(`categories.${value}`),
  }));

  const addLabels = {
    add: t("add"),
    name: t("name"),
    category: t("category"),
    submit: t("submit"),
    submitting: t("submitting"),
    cancel: tc("cancel"),
  };

  const addTeam = canCreate ? (
    <AddTeam action={createTeam} categories={categories} labels={addLabels} />
  ) : null;

  return (
    <div className="space-y-5">
      <PageHeader title={t("title")}>
        {canCreate && teams.length > 0 ? addTeam : null}
      </PageHeader>

      {teams.length === 0 ? (
        <EmptyState
          title={t("empty")}
          description={t("emptyDescription")}
          action={addTeam}
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full min-w-[520px] text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">{t("table.name")}</th>
                <th className="px-4 py-2 font-medium">{t("table.category")}</th>
                <th className="px-4 py-2 font-medium">{t("table.athletes")}</th>
                <th className="px-4 py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {teams.map((team) => (
                <tr
                  key={team.id}
                  className="border-t border-border transition-colors hover:bg-muted/40"
                >
                  <td className="px-4 py-2">
                    <Link
                      href={`/${locale}/teams/${team.id}/registrations`}
                      className="font-medium text-foreground hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                    >
                      {team.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {t(`categories.${team.category}`)}
                  </td>
                  <td className="px-4 py-2 tabular-nums text-muted-foreground">
                    {team.athlete_count}
                  </td>
                  <td className="px-4 py-2 text-right">
                    {(canEdit || canDelete) && (
                      <TeamManageDialog
                        team={{
                          id: team.id,
                          name: team.name,
                          category: team.category,
                        }}
                        categories={categories}
                        canEdit={canEdit}
                        canDelete={canDelete}
                        updateAction={updateTeam}
                        deleteAction={deleteTeam}
                        labels={{
                          manage: t("manage"),
                          name: t("name"),
                          category: t("category"),
                          save: t("save"),
                          saving: t("saving"),
                          delete: t("delete"),
                          deleteBody: t("manageDeleteBody"),
                          deleteConfirm: t("deleteConfirm"),
                          deleting: t("deleting"),
                          cancel: tc("cancel"),
                        }}
                      />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
