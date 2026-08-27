import { getTranslations } from "next-intl/server";
import { differenceInCalendarYears } from "date-fns";
import { requireOrganization, hasPermission } from "@/lib/organization";
import { createServerClient } from "@/lib/supabase/server";
import {
  getActiveSeason,
  listAthletesWithCurrentMembership,
  listTeams,
} from "@/lib/club-data";
import { formatClubAthleteNumber } from "@/lib/athlete-id";
import { EmptyState } from "@/components/layout/EmptyState";
import { createPlayer } from "./actions";

function ageOf(birthDate: string): number {
  return differenceInCalendarYears(new Date(), new Date(birthDate));
}

export default async function PlayersPage() {
  const org = await requireOrganization();
  const canCreate = await hasPermission("athletes.create");
  const supabase = await createServerClient();
  const t = await getTranslations("players");

  const activeSeason = await getActiveSeason(supabase, org.organizationId);
  const athletes = activeSeason
    ? await listAthletesWithCurrentMembership(
        supabase,
        org.organizationId,
        activeSeason.id
      )
    : [];
  const teams = await listTeams(supabase, org.organizationId);

  const addForm = (
    <form action={createPlayer} className="grid gap-3 sm:grid-cols-2">
      <input
        name="first_name"
        placeholder={t("firstName")}
        required
        className="rounded-lg border px-3 py-2 text-sm"
      />
      <input
        name="last_name"
        placeholder={t("lastName")}
        required
        className="rounded-lg border px-3 py-2 text-sm"
      />
      <input
        name="birth_date"
        type="date"
        required
        aria-label={t("birthDate")}
        className="rounded-lg border px-3 py-2 text-sm"
      />
      <select
        name="gender"
        defaultValue=""
        aria-label={t("gender")}
        className="rounded-lg border px-3 py-2 text-sm"
      >
        <option value="">{t("genderNone")}</option>
        <option value="male">{t("genderMale")}</option>
        <option value="female">{t("genderFemale")}</option>
        <option value="other">{t("genderOther")}</option>
      </select>
      <input
        name="nationality"
        placeholder={t("nationality")}
        className="rounded-lg border px-3 py-2 text-sm"
      />
      <input
        name="position"
        placeholder={t("position")}
        className="rounded-lg border px-3 py-2 text-sm"
      />
      <input
        name="federation_id"
        placeholder={t("federationId")}
        className="rounded-lg border px-3 py-2 text-sm"
      />
      <select
        name="team_id"
        defaultValue=""
        aria-label={t("team")}
        className="rounded-lg border px-3 py-2 text-sm"
      >
        <option value="">{t("teamNone")}</option>
        {teams.map((team) => (
          <option key={team.id} value={team.id}>
            {team.name}
          </option>
        ))}
      </select>
      <input
        name="jersey_number"
        type="number"
        min={1}
        max={99}
        placeholder={t("jersey")}
        aria-label={t("jersey")}
        className="rounded-lg border px-3 py-2 text-sm"
      />
      <button
        type="submit"
        className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground sm:col-span-2"
      >
        {t("submit")}
      </button>
    </form>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
      </div>

      {!activeSeason ? (
        <EmptyState
          title={t("activeSeasonNone")}
          description={t("empty.description")}
        />
      ) : athletes.length === 0 ? (
        <div className="space-y-6">
          <EmptyState title={t("empty.title")} description={t("empty.description")} />
          {canCreate && (
            <details className="rounded-xl border border-border p-4">
              <summary className="cursor-pointer text-sm font-medium">
                {t("add")}
              </summary>
              <div className="mt-4">{addForm}</div>
            </details>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          <div className="overflow-hidden rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2">{t("table.clubId")}</th>
                  <th className="px-4 py-2">{t("table.name")}</th>
                  <th className="px-4 py-2">{t("table.age")}</th>
                  <th className="px-4 py-2">{t("table.team")}</th>
                  <th className="px-4 py-2">{t("table.jersey")}</th>
                  <th className="px-4 py-2">{t("table.position")}</th>
                </tr>
              </thead>
              <tbody>
                {athletes.map((a) => (
                  <tr key={a.id} className="border-t border-border">
                    <td className="px-4 py-2 font-mono text-xs">
                      {formatClubAthleteNumber(a.club_athlete_number)}
                    </td>
                    <td className="px-4 py-2 font-medium">
                      {a.last_name} {a.first_name}
                    </td>
                    <td className="px-4 py-2">{ageOf(a.birth_date)}</td>
                    <td className="px-4 py-2">
                      {a.membership?.team_name ?? "—"}
                    </td>
                    <td className="px-4 py-2">
                      {a.membership?.jersey_number ?? "—"}
                    </td>
                    <td className="px-4 py-2">{a.position ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {canCreate && (
            <details className="rounded-xl border border-border p-4">
              <summary className="cursor-pointer text-sm font-medium">
                {t("add")}
              </summary>
              <div className="mt-4">{addForm}</div>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
