import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Plus } from "lucide-react";
import { requireOrganization, hasPermission } from "@/lib/organization";
import { createServerClient } from "@/lib/supabase/server";
import {
  getActiveSeason,
  getOrganizationSettings,
  listAthletes,
  listTeams,
} from "@/lib/club-data";
import { deriveStatus, medicalStatus } from "@/lib/status";
import { formatClubAthleteNumber } from "@/lib/athlete-id";
import { EmptyState } from "@/components/layout/EmptyState";
import { FormSubmitButton } from "@/components/FormSubmitButton";
import { MutationForm } from "@/components/ui/MutationForm";
import { PageHeader } from "@/components/ui/PageHeader";
import { TeamFilter } from "@/components/teams/TeamFilter";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { createPlayer } from "./actions";
import { PositionSelect } from "@/components/ui/PositionSelect";
import { DateField } from "@/components/ui/DateField";

export default async function PlayersPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ team?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  const org = await requireOrganization();
  const canCreate = await hasPermission("athletes.create");
  const supabase = await createServerClient();
  const t = await getTranslations("players");
  const tf = await getTranslations("feedback");

  const [athletes, teams, activeSeason, orgRow, settings, regStatus, medStatus] =
    await Promise.all([
      listAthletes(supabase, org.organizationId),
      listTeams(supabase, org.organizationId),
      getActiveSeason(supabase, org.organizationId),
      supabase
        .from("organizations")
        .select("sport")
        .eq("id", org.organizationId)
        .maybeSingle()
        .then((r) => r.data),
      getOrganizationSettings(supabase, org.organizationId),
      supabase
        .from("registrations")
        .select("athlete_id, valid_until")
        .eq("organization_id", org.organizationId)
        .order("created_at", { ascending: false }),
      supabase
        .from("medical_examinations")
        .select("athlete_id, valid_until")
        .eq("organization_id", org.organizationId)
        .order("created_at", { ascending: false }),
    ]);

  const threshold = settings?.warning_threshold_days ?? 30;
  // Latest record per athlete wins (matches the profile's "current" logic).
  const regByAthlete = new Map<string, string>();
  for (const row of regStatus.data ?? []) {
    if (!regByAthlete.has(row.athlete_id)) regByAthlete.set(row.athlete_id, row.valid_until);
  }
  const medByAthlete = new Map<string, string>();
  for (const row of medStatus.data ?? []) {
    if (!medByAthlete.has(row.athlete_id)) medByAthlete.set(row.athlete_id, row.valid_until);
  }

  const regToneOf = (athleteId: string) => {
    const until = regByAthlete.get(athleteId);
    return until ? deriveStatus(new Date(until), threshold) : "red";
  };
  const medToneOf = (athleteId: string) => {
    const until = medByAthlete.get(athleteId);
    return until ? medicalStatus(new Date(until), threshold) : "not_recorded";
  };

  // Team context first: Prvi tim always leads, the rest alphabetically.
  const sortedTeams = [...teams].sort((a, b) => {
    const aFirst = a.category === "first_team" ? 0 : 1;
    const bFirst = b.category === "first_team" ? 0 : 1;
    if (aFirst !== bFirst) return aFirst - bFirst;
    return a.name.localeCompare(b.name, "sr");
  });
  const selectedTeamId =
    sp.team && teams.some((team) => team.id === sp.team) ? sp.team : null;

  const visible = selectedTeamId
    ? athletes.filter((a) => a.membership?.team_id === selectedTeamId)
    : athletes;

  const inputClass = "field";

  const addForm = (
    <MutationForm
      action={createPlayer}
      successMessage={tf("playerAdded")}
      errorMessage={tf("addFailed")}
      className="grid gap-3 sm:grid-cols-2"
    >
      <input
        name="first_name"
        placeholder={t("firstName")}
        required
        className={inputClass}
      />
      <input
        name="last_name"
        placeholder={t("lastName")}
        required
        className={inputClass}
      />
      <DateField
        name="birth_date"
        required
        ariaLabel={t("birthDate")}
      />
      <select
        name="gender"
        defaultValue=""
        aria-label={t("gender")}
        className={inputClass}
      >
        <option value="">{t("genderNone")}</option>
        <option value="male">{t("genderMale")}</option>
        <option value="female">{t("genderFemale")}</option>
        <option value="other">{t("genderOther")}</option>
      </select>
      <input
        name="nationality"
        placeholder={t("nationality")}
        className={inputClass}
      />
      <PositionSelect
        name="position"
        sport={orgRow?.sport}
        locale={locale === "en" ? "en" : "sr"}
        ariaLabel={t("position")}
        className={inputClass}
      />
      <input
        name="federation_id"
        placeholder={t("federationId")}
        className={inputClass}
      />
      {activeSeason && (
        <>
          <select
            name="team_id"
            defaultValue=""
            aria-label={t("team")}
            className={inputClass}
          >
            <option value="">{t("teamNone")}</option>
            {sortedTeams.map((team) => (
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
            className={inputClass}
          />
        </>
      )}
      <FormSubmitButton
        idleLabel={t("submit")}
        pendingLabel={t("submitting")}
        className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground sm:col-span-2"
      />
    </MutationForm>
  );

  const addTrigger = (
    <details className="relative">
      <summary className="flex h-9 cursor-pointer list-none items-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 [&::-webkit-details-marker]:hidden">
        <Plus className="h-4 w-4" />
        {t("add")}
      </summary>
      <div className="absolute right-0 z-20 mt-2 w-[calc(100vw-2rem)] max-w-md rounded-xl border border-border bg-popover p-4 shadow-lg animate-fade">
        {addForm}
      </div>
    </details>
  );

  return (
    <div className="space-y-5">
      <PageHeader title={t("title")}>
        {canCreate && (
          <>
            <Link
              href={`/${locale}/import`}
              className="flex h-9 items-center rounded-lg border border-border bg-card px-3.5 text-sm font-medium text-foreground hover:border-primary hover:text-primary"
            >
              {t("import")}
            </Link>
            {addTrigger}
          </>
        )}
      </PageHeader>

      {sortedTeams.length > 0 && (
        <TeamFilter
          teams={sortedTeams.map((team) => ({ id: team.id, name: team.name }))}
          selectedTeamId={selectedTeamId}
          allLabel={t("filterAll")}
          allHref={`/${locale}/players`}
          teamHref={(teamId) => `/${locale}/players?team=${teamId}`}
          ariaLabel={t("teamFilterLabel")}
        />
      )}

      {visible.length === 0 ? (
        <div className="space-y-5">
          <EmptyState
            title={selectedTeamId ? t("emptyTeam.title") : t("empty.title")}
            description={
              selectedTeamId
                ? t("emptyTeam.description")
                : t("empty.description")
            }
          />
          {canCreate && !selectedTeamId && (
            <div className="flex justify-center">{addTrigger}</div>
          )}
        </div>
      ) : (
        <>
          {/* Desktop roster table */}
          <div className="hidden overflow-hidden rounded-xl border border-border bg-card md:block">
            <div className="max-h-[70vh] overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10 bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground backdrop-blur">
                  <tr>
                    <th className="px-4 py-2 font-medium">{t("table.clubId")}</th>
                    <th className="px-4 py-2 font-medium">{t("table.name")}</th>
                    <th className="px-4 py-2 font-medium">{t("table.team")}</th>
                    <th className="px-4 py-2 font-medium">{t("table.jersey")}</th>
                    <th className="px-4 py-2 font-medium">{t("table.position")}</th>
                    <th className="px-4 py-2 font-medium">{t("table.reg")}</th>
                    <th className="px-4 py-2 font-medium">{t("table.med")}</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((a) => {
                    const regTone = regToneOf(a.id);
                    const medTone = medToneOf(a.id);
                    const profileHref = `/${locale}/players/${a.id}`;
                    return (
                      <tr
                        key={a.id}
                        className="border-t border-border transition-colors hover:bg-muted/40"
                      >
                        <td className="px-4 py-2 font-mono text-xs text-muted-foreground">
                          {formatClubAthleteNumber(a.club_athlete_number)}
                        </td>
                        <td className="px-4 py-2">
                          <Link href={profileHref} className="group flex items-center gap-3">
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-xs font-semibold text-primary">
                              {a.first_name.charAt(0)}
                              {a.last_name.charAt(0)}
                            </span>
                            <span className="font-medium text-foreground group-hover:text-primary">
                              {a.last_name} {a.first_name}
                            </span>
                          </Link>
                        </td>
                        <td className="px-4 py-2 text-muted-foreground">
                          {a.membership?.team_name ?? "—"}
                        </td>
                        <td className="px-4 py-2 tabular-nums text-muted-foreground">
                          {a.membership?.jersey_number ?? "—"}
                        </td>
                        <td className="px-4 py-2 text-muted-foreground">
                          {a.position ?? "—"}
                        </td>
                        <td className="px-4 py-2">
                          <StatusBadge
                            tone={regTone === "green" ? "green" : regTone === "yellow" ? "yellow" : "red"}
                            label={
                              regTone === "green"
                                ? t("statusShort.regOk")
                                : regTone === "yellow"
                                  ? t("statusShort.regSoon")
                                  : t("statusShort.regBad")
                            }
                          />
                        </td>
                        <td className="px-4 py-2">
                          <StatusBadge
                            tone={
                              medTone === "valid"
                                ? "green"
                                : medTone === "expiring_soon"
                                  ? "yellow"
                                  : medTone === "expired"
                                    ? "red"
                                    : "neutral"
                            }
                            label={
                              medTone === "not_recorded"
                                ? t("statusShort.medNone")
                                : medTone === "valid"
                                  ? t("statusShort.medOk")
                                  : medTone === "expiring_soon"
                                    ? t("statusShort.medSoon")
                                    : t("statusShort.medBad")
                            }
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile roster cards — identity only. Registration / medical status
            * lives on the desktop table (clear column headers), the player
            * profile, and "Zahteva pažnju"; it is not repeated here where the
            * meaning of a bare "Istekao" badge would be ambiguous. */}
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card md:hidden">
            {visible.map((a) => {
              const profileHref = `/${locale}/players/${a.id}`;
              const meta = [
                a.membership?.team_name,
                a.membership?.jersey_number
                  ? `#${a.membership.jersey_number}`
                  : "",
                a.position,
              ].filter(Boolean) as string[];
              return (
                <li key={a.id}>
                  <Link
                    href={profileHref}
                    className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/40"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-sm font-semibold text-primary">
                      {a.first_name.charAt(0)}
                      {a.last_name.charAt(0)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block break-words text-sm font-medium text-foreground">
                        {a.last_name} {a.first_name}
                      </span>
                      {meta.length > 0 ? (
                        <span className="mt-0.5 flex flex-wrap items-baseline gap-x-1.5 text-xs text-muted-foreground">
                          {meta.map((piece, i) => (
                            <span key={i} className={i === 0 ? "break-words" : "whitespace-nowrap"}>
                              {i === 0 ? "" : "·"}
                              {i === 0 ? piece : ` ${piece}`}
                            </span>
                          ))}
                        </span>
                      ) : (
                        <span className="mt-0.5 block font-mono text-xs text-muted-foreground">
                          {formatClubAthleteNumber(a.club_athlete_number)}
                        </span>
                      )}
                    </span>
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