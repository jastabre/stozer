import { getTranslations } from "next-intl/server";
import { ChevronDown } from "lucide-react";
import { requireOrganization, hasPermission } from "@/lib/organization";
import { createServerClient } from "@/lib/supabase/server";
import {
  getActiveSeason,
  listAthletesWithCurrentMembership,
  listSeasons,
  listTeams,
} from "@/lib/club-data";
import { startNewSeason, updateSeason } from "./actions";
import { saveCompetitionMonths } from "../teams/first-team-actions";
import { SeasonForm, type SeasonFormLabels } from "@/components/seasons/SeasonForm";
import { FormSubmitButton } from "@/components/FormSubmitButton";
import { MutationForm } from "@/components/ui/MutationForm";

const ALL_MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

export default async function SeasonsPage() {
  const org = await requireOrganization();
  const supabase = await createServerClient();
  const t = await getTranslations("seasons");
  const tf = await getTranslations("feedback");

  const [activeSeason, seasons, teams, canManage] = await Promise.all([
    getActiveSeason(supabase, org.organizationId),
    listSeasons(supabase, org.organizationId),
    listTeams(supabase, org.organizationId),
    hasPermission("seasons.manage"),
  ]);

  // Athletes to carry forward when starting a new season (from the active one).
  const prevAthletes = activeSeason
    ? await listAthletesWithCurrentMembership(supabase, org.organizationId, activeSeason.id)
    : [];

  const pastSeasons = seasons.filter((s) => !s.is_active);

  const formLabels = (mode: "edit" | "create"): SeasonFormLabels => ({
    name: t("name"),
    startsOn: t("startsOn"),
    endsOn: t("endsOn"),
    submit: mode === "edit" ? t("saveChanges") : t("submit"),
    submitting: mode === "edit" ? t("savingSeason") : t("submitting"),
    dateRangeError: t("dateRangeError"),
  });

  const carryForward =
    prevAthletes.length > 0 ? (
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
                {a.membership?.jersey_number ? ` · ${a.membership.jersey_number}` : ""}
              </span>
              <select
                name={`move_${a.id}`}
                defaultValue=""
                aria-label={t("moveTo")}
                className="field w-auto"
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
    ) : null;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t("title")}</h1>

      {/* Active season — the everyday focus, with an inline edit. */}
      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="text-lg font-semibold">{t("activeSeason")}</h2>
        {activeSeason ? (
          <>
            <div className="mt-2 text-sm text-muted-foreground">
              <p className="text-base font-medium text-foreground">{activeSeason.name}</p>
              <p>
                {activeSeason.starts_on}
                {activeSeason.ends_on ? ` — ${activeSeason.ends_on}` : ""}
              </p>
            </div>

            {canManage && (
              <details className="group mt-3">
                <summary className="inline-flex h-9 cursor-pointer list-none items-center rounded-lg border border-border px-3 text-sm font-medium text-foreground transition-colors hover:border-primary hover:text-primary [&::-webkit-details-marker]:hidden">
                  {t("editSeason")}
                </summary>
                <div className="mt-3 rounded-lg border border-border p-4">
                  <SeasonForm
                    action={updateSeason}
                    defaults={{
                      name: activeSeason.name,
                      starts_on: activeSeason.starts_on,
                      ends_on: activeSeason.ends_on ?? "",
                    }}
                    labels={formLabels("edit")}
                    successMessage={tf("seasonSaved")}
                  >
                    <input type="hidden" name="season_id" value={activeSeason.id} />
                  </SeasonForm>
                </div>
              </details>
            )}
          </>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">{t("noActiveSeason")}</p>
        )}
      </section>

      {/* Competition months for first-team payments — only with an active season. */}
      {canManage && activeSeason && (
        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-lg font-semibold">{t("competitionMonths")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t("competitionMonthsHint")}</p>
          <MutationForm
            action={saveCompetitionMonths}
            successMessage={tf("competitionMonthsSaved")}
            errorMessage={tf("seasonFailed")}
            className="mt-3"
          >
            <input type="hidden" name="season_id" value={activeSeason.id} />
            <div className="flex flex-wrap items-center gap-2">
              {ALL_MONTHS.map((m) => (
                <label
                  key={m}
                  className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-sm"
                >
                  <input
                    type="checkbox"
                    name="month"
                    value={m}
                    defaultChecked={(activeSeason.competition_months ?? []).includes(m)}
                  />
                  {t(`months.${m}`)}
                </label>
              ))}
            </div>
            <FormSubmitButton
              idleLabel={t("saveMonths")}
              pendingLabel={t("savingMonths")}
              className="mt-3 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            />
          </MutationForm>
        </section>
      )}

      {/* Start a new season — on demand only. */}
      {canManage && (
        <details className="group rounded-xl border border-border bg-card">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 [&::-webkit-details-marker]:hidden">
            <div className="min-w-0">
              <h2 className="text-base font-semibold">
                {activeSeason ? t("startNewSeason") : t("startSeason")}
              </h2>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {activeSeason ? t("startNewSeasonHint") : t("startSeasonHint")}
              </p>
            </div>
            <ChevronDown
              className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
              aria-hidden="true"
            />
          </summary>

          <div className="border-t border-border px-5 py-4">
            <SeasonForm
              action={startNewSeason}
              labels={formLabels("create")}
              successMessage={tf("seasonStarted")}
            >
              {carryForward}
            </SeasonForm>
          </div>
        </details>
      )}

      {/* Previous seasons (archived, hidden by default — D-04) */}
      <details className="rounded-xl border border-border bg-card">
        <summary className="cursor-pointer list-none px-5 py-4 text-sm font-medium [&::-webkit-details-marker]:hidden">
          {t("previousSeasons")} ({pastSeasons.length})
        </summary>
        <ul className="space-y-1 border-t border-border px-5 py-4">
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
