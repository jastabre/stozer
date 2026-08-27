import { getTranslations } from "next-intl/server";
import { requireOrganization, hasPermission } from "@/lib/organization";
import { createServerClient } from "@/lib/supabase/server";
import {
  getActiveSeason,
  listAthletesWithCurrentMembership,
  listSeasons,
  listTeams,
} from "@/lib/club-data";
import { createSeason, startNewSeason } from "./actions";

export default async function SeasonsPage() {
  const org = await requireOrganization();
  const supabase = await createServerClient();
  const t = await getTranslations("seasons");

  const [activeSeason, seasons, teams] = await Promise.all([
    getActiveSeason(supabase, org.organizationId),
    listSeasons(supabase, org.organizationId),
    listTeams(supabase, org.organizationId),
  ]);

  // Athletes to carry forward when starting a new season (from the active one).
  const prevAthletes = activeSeason
    ? await listAthletesWithCurrentMembership(supabase, org.organizationId, activeSeason.id)
    : [];

  const pastSeasons = seasons.filter((s) => !s.is_active);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t("title")}</h1>

      {/* Active season */}
      <section className="rounded-xl border border-border p-5">
        <h2 className="text-lg font-semibold">{t("activeSeason")}</h2>
        {activeSeason ? (
          <div className="mt-2 text-sm text-muted-foreground">
            <p className="text-base font-medium text-foreground">{activeSeason.name}</p>
            <p>
              {activeSeason.starts_on}
              {activeSeason.ends_on ? ` — ${activeSeason.ends_on}` : ""}
            </p>
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">{t("noActiveSeason")}</p>
        )}
      </section>

      {/* Start New Season guided rollover (D-03) */}
      <section className="rounded-xl border border-border p-5">
        <h2 className="text-lg font-semibold">{t("startNewSeason")}</h2>
        <form action={startNewSeason} className="mt-4 grid gap-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              name="name"
              placeholder={t("name")}
              required
              className="rounded-lg border px-3 py-2 text-sm"
            />
            <input
              name="starts_on"
              type="date"
              required
              aria-label={t("startsOn")}
              className="rounded-lg border px-3 py-2 text-sm"
            />
          </div>

          {prevAthletes.length > 0 && (
            <div className="rounded-lg border border-border bg-muted/40 p-4">
              <p className="text-sm font-medium">{t("movesTitle")}</p>
              <p className="mb-3 text-xs text-muted-foreground">{t("movesHint")}</p>
              <ul className="space-y-2">
                {prevAthletes.map((a) => (
                  <li
                    key={a.id}
                    className="flex flex-wrap items-center justify-between gap-2 text-sm"
                  >
                    <span>
                      {a.last_name} {a.first_name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {a.membership?.team_name ?? t("noTeam")}
                      {a.membership?.jersey_number
                        ? ` · ${a.membership.jersey_number}`
                        : ""}
                    </span>
                    <select
                      name={`move_${a.id}`}
                      defaultValue=""
                      aria-label={t("moveTo")}
                      className="rounded-lg border px-2 py-1 text-sm"
                    >
                      <option value="">{t("keepTeam")}</option>
                      {teams.map((team) => (
                        <option key={team.id} value={team.id}>
                          {team.name}
                        </option>
                      ))}
                    </select>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <button
            type="submit"
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            {t("submit")}
          </button>
        </form>
      </section>

      {/* Previous seasons (archived, hidden by default — D-04) */}
      <details className="rounded-xl border border-border p-4">
        <summary className="cursor-pointer text-sm font-medium">
          {t("previousSeasons")} ({pastSeasons.length})
        </summary>
        <ul className="mt-3 space-y-1">
          {pastSeasons.length === 0 ? (
            <li className="text-sm text-muted-foreground">{t("noPreviousSeasons")}</li>
          ) : (
            pastSeasons.map((s) => (
              <li key={s.id} className="flex justify-between text-sm">
                <span>{s.name}</span>
                <span className="text-muted-foreground">{s.starts_on}</span>
              </li>
            ))
          )}
        </ul>
      </details>
    </div>
  );
}
