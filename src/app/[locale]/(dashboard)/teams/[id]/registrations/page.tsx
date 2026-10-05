import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireOrganization, hasPermission } from "@/lib/organization";
import { createServerClient } from "@/lib/supabase/server";
import {
  listTeamStatusOverview,
  getActiveSeason,
  getOrganizationSettings,
  listAthletes,
  listSeasonMemberAthleteIds,
} from "@/lib/club-data";
import { deriveStatus, medicalStatus } from "@/lib/status";
import { positionsForSport } from "@/lib/positions";
import { addPlayerToTeam, removePlayerFromTeam } from "../../actions";
import { TeamHeader } from "@/components/teams/TeamHeader";
import { AddTeamPlayer } from "@/components/teams/AddTeamPlayer";
import {
  TeamRoster,
  type RosterRow,
  type TeamRosterLabels,
} from "@/components/teams/TeamRoster";

export default async function TeamOverviewPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id: teamId } = await params;
  const org = await requireOrganization();
  const supabase = await createServerClient();
  const t = await getTranslations("teams.overview");
  const tt = await getTranslations("teams");
  const tc = await getTranslations("common");

  const [canViewReg, canViewMed] = await Promise.all([
    hasPermission("registrations.view"),
    hasPermission("medical.view"),
  ]);
  if (!canViewReg && !canViewMed) notFound();

  const [active, settings, teamResp] = await Promise.all([
    getActiveSeason(supabase, org.organizationId),
    getOrganizationSettings(supabase, org.organizationId),
    supabase
      .from("teams")
      .select("id, name, category, sport, organization_id")
      .eq("id", teamId)
      .eq("organization_id", org.organizationId)
      .maybeSingle(),
  ]);
  const team = teamResp.data;
  if (!team) notFound();

  const [canEditTeams, canEditAthletes, athletes, seasonMemberIds] =
    await Promise.all([
      hasPermission("teams.edit"),
      hasPermission("athletes.edit"),
      listAthletes(supabase, org.organizationId),
      active
        ? listSeasonMemberAthleteIds(supabase, org.organizationId, active.id)
        : Promise.resolve([]),
    ]);
  const canAssign = canEditTeams || canEditAthletes;

  // Eligibility is "no membership in the ACTIVE season" — an athlete with only
  // historical memberships is still available.
  const assignedThisSeason = new Set(seasonMemberIds);
  const eligibleAthletes = athletes
    .filter((a) => !assignedThisSeason.has(a.id))
    .map((a) => ({ id: a.id, name: `${a.last_name} ${a.first_name}` }));

  const threshold =
    settings?.warning_threshold_days != null
      ? settings.warning_threshold_days
      : 30;

  const rows = active
    ? await listTeamStatusOverview(
        supabase,
        org.organizationId,
        teamId,
        active.id
      )
    : [];

  const rosterRows: RosterRow[] = rows.map((row) => ({
    athleteId: row.athleteId,
    firstName: row.first_name,
    lastName: row.last_name,
    position: row.position,
    clubAthleteNumber: row.club_athlete_number,
    jerseyNumber: row.jersey_number,
    regState: !row.latestRegistrationValidUntil
      ? "none"
      : deriveStatus(new Date(row.latestRegistrationValidUntil), threshold),
    medTone: medicalStatus(
      row.latestMedicalValidUntil
        ? new Date(row.latestMedicalValidUntil)
        : null,
      threshold
    ),
  }));

  const seasonNode = active ? (
    <span>{active.name}</span>
  ) : (
    <Link
      href={`/${locale}/seasons`}
      className="font-medium text-primary hover:underline"
    >
      {t("startSeason")}
    </Link>
  );

  const meta = (
    <>
      {tt(`categories.${team.category}`)} · {seasonNode}
      {active ? ` · ${t("memberCount", { count: rows.length })}` : ""}
    </>
  );

  const tabs =
    team.category === "first_team"
      ? [
          {
            href: `/${locale}/teams/${team.id}/registrations`,
            label: t("tabPlayers"),
          },
          {
            href: `/${locale}/teams/${team.id}/payments`,
            label: t("tabPayments"),
          },
        ]
      : undefined;

  // Position filter options come from the shared sport preset system (localized
  // labels that match the stored position values). "all" is the neutral default.
  const positionOptions = [
    { value: "all", label: t("filterAll") },
    ...positionsForSport(team.sport, locale === "en" ? "en" : "sr").map(
      (position) => ({ value: position.label, label: position.label })
    ),
  ];

  const rosterLabels: TeamRosterLabels = {
    searchPlaceholder: t("searchPlaceholder"),
    filters: t("filters"),
    clearFilters: t("clearFilters"),
    filterPosition: t("table.position"),
    positionOptions,
    filterReg: t("filterReg"),
    filterMed: t("filterMed"),
    regOptions: [
      { value: "all", label: t("filterAll") },
      { value: "green", label: t("regGreen") },
      { value: "yellow", label: t("regYellow") },
      { value: "red", label: t("regRed") },
      { value: "none", label: t("regNone") },
    ],
    medOptions: [
      { value: "all", label: t("filterAll") },
      { value: "valid", label: t("medValid") },
      { value: "expiring_soon", label: t("medSoon") },
      { value: "expired", label: t("medExpired") },
      { value: "not_recorded", label: t("medNone") },
    ],
    table: {
      clubId: t("table.clubId"),
      name: t("table.name"),
      jersey: t("table.jersey"),
      position: t("table.position"),
      registration: t("table.registration"),
      medical: t("table.medical"),
      actions: t("table.actions"),
    },
    empty: t("emptyRoster"),
    emptyFiltered: t("emptyFiltered"),
    remove: t("removePlayer"),
    removeTitle: t("removeConfirmTitle"),
    removeBody: t("removeConfirmBody"),
    removeConfirm: t("removeConfirm"),
    removing: t("removing"),
    cancel: tc("cancel"),
  };

  return (
    <div className="space-y-5">
      <TeamHeader
        backHref={`/${locale}/teams`}
        backLabel={t("back")}
        title={team.name}
        meta={meta}
        description={t("subtitle")}
        action={
          canAssign && active ? (
            <AddTeamPlayer
              teamId={team.id}
              athletes={eligibleAthletes}
              totalPlayers={athletes.length}
              playersHref={`/${locale}/players`}
              action={addPlayerToTeam}
              labels={{
                addToTeam: t("addToTeam"),
                addTitle: t("addPlayerTitle"),
                player: t("playerLabel"),
                choosePlayer: t("choosePlayer"),
                jerseyNumber: t("jerseyNumber"),
                add: t("addPlayer"),
                adding: t("adding"),
                cancel: tc("cancel"),
                noPlayersInClub: t("noPlayersInClub"),
                noPlayersInClubHint: t("noPlayersInClubHint"),
                goToPlayers: t("goToPlayers"),
                noEligiblePlayers: t("noEligiblePlayers"),
                noEligiblePlayersHint: t("noEligiblePlayersHint"),
              }}
            />
          ) : null
        }
        tabs={tabs}
        activeHref={`/${locale}/teams/${team.id}/registrations`}
        tabsLabel={tt("title")}
      />

      {!active ? (
        <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
          {t("noActiveSeason")}
        </div>
      ) : (
        <TeamRoster
          locale={locale}
          teamId={team.id}
          rows={rosterRows}
          canAssign={canAssign}
          removeAction={removePlayerFromTeam}
          labels={rosterLabels}
        />
      )}
    </div>
  );
}
