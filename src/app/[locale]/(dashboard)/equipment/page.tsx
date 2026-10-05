import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Settings } from "lucide-react";
import { EmptyState } from "@/components/layout/EmptyState";
import { ConfirmDeleteButton } from "@/components/ConfirmDeleteButton";
import { FormSubmitButton } from "@/components/FormSubmitButton";
import { MutationForm } from "@/components/ui/MutationForm";
import { hasPermission, requireOrganization } from "@/lib/organization";
import { createServerClient } from "@/lib/supabase/server";
import { getActiveSeason, listTeams } from "@/lib/club-data";
import {
  getPlayerEquipmentByTeam,
  listEquipmentItems,
  listEquipmentRequests,
  listEquipmentTypes,
  listTeamEquipment,
  listTeamEquipmentRequirements,
  summarizePlayerEquipment,
  type AthleteItemAssignment,
} from "@/lib/equipment";
import {
  createEquipmentRequestAction,
  createTeamEquipmentAction,
  decideEquipmentRequestAction,
  deleteItemAssignmentAction,
  deleteTeamEquipmentAction,
  issueItemAction,
  transitionItemAction,
  updateTeamEquipmentAction,
} from "./actions";
import { PlayerEquipmentTable } from "@/components/equipment/PlayerEquipmentTable";
import { TrainingEquipmentDialog } from "@/components/equipment/TrainingEquipmentDialog";
import { ExportButton } from "@/components/equipment/ExportButton";
import { TeamFilter } from "@/components/teams/TeamFilter";
import { SectionTabs } from "@/components/ui/SectionTabs";
import { PageHeader } from "@/components/ui/PageHeader";

const inputClass = "rounded-lg border border-border bg-background px-3 py-2 text-sm";

function tabHref(tab: string, teamId?: string) {
  const params = new URLSearchParams({ tab });
  if (teamId) params.set("team", teamId);
  return params.toString();
}

function Kpi({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | string;
  tone?: string;
}) {
  return (
    <div className="flex items-baseline gap-2 rounded-lg border border-border bg-card px-3 py-1.5">
      <span className={`text-lg font-semibold tabular-nums ${tone ?? "text-foreground"}`}>
        {value}
      </span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

export default async function EquipmentPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ tab?: string; team?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  const tab = sp.tab ?? "players";
  const org = await requireOrganization();
  const supabase = await createServerClient();
  const t = await getTranslations("equipment");
  const tf = await getTranslations("feedback");

  const [canReport, canManage, teams, activeSeason] = await Promise.all([
    hasPermission("equipment.report"),
    hasPermission("equipment.manage"),
    listTeams(supabase, org.organizationId),
    getActiveSeason(supabase, org.organizationId),
  ]);

  // Players tab: a concrete team is always selected (Prvi tim leads).
  const selectedTeamId =
    sp.team && teams.some((team) => team.id === sp.team)
      ? sp.team
      : teams.find((team) => team.category === "first_team")?.id ?? teams[0]?.id;
  // Training tab: "all teams" is a valid default, so only a real param filters.
  const trainingTeamId =
    sp.team && teams.some((team) => team.id === sp.team) ? sp.team : null;

  const [playerRows, items, pieceTypes, teamEquipment, requests, requirements, staff] =
    await Promise.all([
      activeSeason && selectedTeamId
        ? getPlayerEquipmentByTeam(supabase, org.organizationId, selectedTeamId, activeSeason.id)
        : Promise.resolve([]),
      listEquipmentItems(supabase, org.organizationId),
      listEquipmentTypes(supabase, org.organizationId),
      listTeamEquipment(supabase, org.organizationId, activeSeason?.id),
      listEquipmentRequests(supabase, org.organizationId),
      selectedTeamId
        ? listTeamEquipmentRequirements(supabase, org.organizationId, selectedTeamId)
        : Promise.resolve([]),
      supabase
        .from("staff")
        .select("id, first_name, last_name")
        .eq("organization_id", org.organizationId)
        .order("last_name"),
    ]);

  const requiredItemIds = new Set(requirements.map((row) => row.item_id));
  const hasRequirements = requiredItemIds.size > 0;

  // Player size profile (six clothing pieces) for the selected team, used for
  // the sizes column and to prefill the issue form.
  const pieceTypeIds = pieceTypes.map((type) => type.id);
  const { data: pieceSizeRows } =
    activeSeason && selectedTeamId && pieceTypeIds.length
      ? await supabase
          .from("athlete_equipment")
          .select("athlete_id, equipment_type_id, size_value")
          .eq("organization_id", org.organizationId)
          .in("equipment_type_id", pieceTypeIds)
      : { data: [] };
  const sizeByAthletePiece = new Map(
    (pieceSizeRows ?? []).map((row) => [
      `${row.athlete_id}:${row.equipment_type_id}`,
      row.size_value,
    ])
  );
  const pieceByName = new Map(pieceTypes.map((type) => [type.name, type]));
  const sizeOfPiece = (athleteId: string, name: string): string | null => {
    const type = pieceByName.get(name);
    return type
      ? sizeByAthletePiece.get(`${athleteId}:${type.id}`) ?? null
      : null;
  };
  const compactSizes = (athleteId: string): string => {
    const parts: string[] = [];
    const match = [
      sizeOfPiece(athleteId, "Match Shirt"),
      sizeOfPiece(athleteId, "Match Shorts"),
    ].filter(Boolean);
    if (match.length) parts.push(`${t("sizes.groupMatch")} ${match.join("/")}`);
    const tracksuit = [
      sizeOfPiece(athleteId, "Tracksuit Top"),
      sizeOfPiece(athleteId, "Tracksuit Bottom"),
    ].filter(Boolean);
    if (tracksuit.length) {
      parts.push(`${t("sizes.groupTracksuit")} ${tracksuit.join("/")}`);
    }
    const shirt = sizeOfPiece(athleteId, "Training Shirt");
    if (shirt) parts.push(`${t("sizes.shirt")} ${shirt}`);
    const shorts = sizeOfPiece(athleteId, "Training Shorts");
    if (shorts) parts.push(`${t("sizes.shorts")} ${shorts}`);
    return parts.join(" · ");
  };

  const itemById = new Map(items.map((item) => [item.id, item]));
  const tablePlayers = playerRows.map((player) => {
    const assignments = player.assignments
      .map((entry) => entry.assignment)
      .filter((assignment): assignment is AthleteItemAssignment => assignment !== null);
    const summary = summarizePlayerEquipment(assignments, requiredItemIds);
    const missingLabels = summary.missingItemIds
      .map((itemId) => itemById.get(itemId)?.name ?? "")
      .filter(Boolean);
    return {
      athlete_id: player.athlete_id,
      first_name: player.first_name,
      last_name: player.last_name,
      club_athlete_number: player.club_athlete_number,
      jersey_number: player.jersey_number,
      team_name:
        teams.find((team) => team.id === selectedTeamId)?.name ?? null,
      sizes: [
        { label: `${t("sizes.groupMatch")} — ${t("topLabel")}`, value: sizeOfPiece(player.athlete_id, "Match Shirt") },
        { label: `${t("sizes.groupMatch")} — ${t("bottomLabel")}`, value: sizeOfPiece(player.athlete_id, "Match Shorts") },
        { label: `${t("sizes.groupTracksuit")} — ${t("topLabel")}`, value: sizeOfPiece(player.athlete_id, "Tracksuit Top") },
        { label: `${t("sizes.groupTracksuit")} — ${t("bottomLabel")}`, value: sizeOfPiece(player.athlete_id, "Tracksuit Bottom") },
        { label: t("typeNames.trainingShirt"), value: sizeOfPiece(player.athlete_id, "Training Shirt") },
        { label: t("typeNames.trainingShorts"), value: sizeOfPiece(player.athlete_id, "Training Shorts") },
      ],
      sizesCompact: compactSizes(player.athlete_id),
      assignments: assignments.map((assignment) => ({
        item_id: assignment.item_id,
        state: assignment.state,
        size_top: assignment.size_top,
        size_bottom: assignment.size_bottom,
        number: assignment.number,
        issued_at: assignment.issued_at,
        note: assignment.note,
      })),
      summary: {
        hasRequirements: summary.hasRequirements,
        missingLabels,
        issuedCount: summary.issuedCount,
        missingCount: summary.missingCount,
        lostDamagedCount: summary.lostDamagedCount,
        complete: summary.complete,
      },
    };
  });

  const completeCount = tablePlayers.filter((player) => player.summary.complete).length;
  const missingPlayersCount = tablePlayers.filter(
    (player) => player.summary.hasRequirements && !player.summary.complete
  ).length;

  const visibleTeamEquipment = trainingTeamId
    ? teamEquipment.filter((row) => row.team_id === trainingTeamId)
    : teamEquipment;

  const staffOptions = (staff.data ?? []).map((person) => ({
    id: person.id,
    name: `${person.last_name} ${person.first_name}`,
  }));

  return (
    <div className="space-y-4">
      <PageHeader title={t("title")} description={t("description")} eyebrow={t("eyebrow")}>
        <div className="flex flex-wrap items-center gap-2">
          {tab === "players" && canReport && selectedTeamId && (
            <ExportButton
              href={`/${locale}/equipment/export?team_id=${encodeURIComponent(selectedTeamId)}`}
              label={t("export")}
              pendingLabel={t("exporting")}
              className="rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground transition-colors hover:border-primary hover:text-primary"
            />
          )}
          {canManage && (
            <Link
              href={`/${locale}/equipment/settings`}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-medium text-foreground transition-colors hover:border-primary hover:text-primary"
            >
              <Settings className="h-4 w-4" aria-hidden="true" />
              {t("settingsButton")}
            </Link>
          )}
        </div>
      </PageHeader>

      <SectionTabs
        label={t("tabsLabel")}
        activeHref={`/${locale}/equipment?${tabHref(
          tab,
          tab === "team" ? trainingTeamId ?? undefined : selectedTeamId
        )}`}
        items={[
          { href: `/${locale}/equipment?${tabHref("players", selectedTeamId)}`, label: t("tabs.players") },
          { href: `/${locale}/equipment?${tabHref("team", trainingTeamId ?? undefined)}`, label: t("tabs.team") },
          { href: `/${locale}/equipment?${tabHref("requests", selectedTeamId)}`, label: t("tabs.requests") },
        ]}
      />

      {tab === "players" && (
        <section className="space-y-4">
          {teams.length > 0 && (
            <TeamFilter
              teams={teams.map((team) => ({ id: team.id, name: team.name }))}
              selectedTeamId={selectedTeamId ?? null}
              teamHref={(teamId) =>
                `/${locale}/equipment?${tabHref("players", teamId)}`
              }
              ariaLabel={t("team")}
              label={t("team")}
              tone="soft"
            />
          )}

          {!activeSeason ? (
            <EmptyState title={t("noActiveSeason")} description={t("emptyPlayersDescription")} />
          ) : playerRows.length === 0 ? (
            <EmptyState title={t("emptyPlayers")} description={t("emptyPlayersDescription")} />
          ) : (
            <>
              {!hasRequirements && (
                <p className="rounded-xl border border-dashed border-border bg-card px-4 py-3 text-sm text-muted-foreground">
                  {t("noRequirements")}
                  {canManage && (
                    <>
                      {" "}
                      <Link
                        href={`/${locale}/equipment/settings?tab=requirements`}
                        className="font-medium text-primary hover:underline"
                      >
                        {t("settingsButton")}
                      </Link>
                    </>
                  )}
                </p>
              )}

              <div className="flex flex-wrap gap-2">
                <Kpi label={t("kpiPlayers")} value={tablePlayers.length} />
                <Kpi
                  label={t("kpiComplete")}
                  value={hasRequirements ? completeCount : "—"}
                  tone="text-success"
                />
                <Kpi
                  label={t("kpiMissing")}
                  value={hasRequirements ? missingPlayersCount : "—"}
                  tone="text-destructive"
                />
              </div>

              <PlayerEquipmentTable
                players={tablePlayers}
                items={items}
                canReport={canReport}
                canManage={canManage}
                issueAction={issueItemAction}
                transitionAction={transitionItemAction}
                deleteAction={deleteItemAssignmentAction}
              />
            </>
          )}
        </section>
      )}

      {tab === "team" && (
        <section className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">{t("teamTitle")}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("teamDescription")}
              </p>
            </div>
            {canManage && (
              <TrainingEquipmentDialog
                mode="create"
                teams={teams.map((team) => ({ id: team.id, name: team.name }))}
                staff={staffOptions}
                seasonId={activeSeason?.id ?? null}
                createAction={createTeamEquipmentAction}
                updateAction={updateTeamEquipmentAction}
              />
            )}
          </div>

          {teams.length > 0 && (
            <TeamFilter
              teams={teams.map((team) => ({ id: team.id, name: team.name }))}
              selectedTeamId={trainingTeamId}
              allLabel={t("allTeams")}
              allHref={`/${locale}/equipment?tab=team`}
              teamHref={(teamId) =>
                `/${locale}/equipment?${tabHref("team", teamId)}`
              }
              ariaLabel={t("team")}
              label={t("team")}
              tone="soft"
            />
          )}

          {visibleTeamEquipment.length === 0 ? (
            <EmptyState title={t("emptyTeam")} description={t("emptyTeamDescription")} />
          ) : (
            <>
              <div className="hidden overflow-hidden rounded-xl border border-border bg-card md:block">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 font-medium">{t("itemName")}</th>
                      <th className="px-3 py-3 font-medium">{t("team")}</th>
                      <th className="px-3 py-3 font-medium">{t("responsible")}</th>
                      <th className="px-3 py-3 font-medium">{t("quantity")}</th>
                      <th className="px-3 py-3 font-medium">{t("state")}</th>
                      <th className="px-4 py-3 text-right font-medium">
                        {t("actionsLabel")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleTeamEquipment.map((row) => (
                      <tr key={row.id} className="border-t border-border">
                        <td className="px-4 py-3 font-medium text-foreground">
                          {row.item_name}
                        </td>
                        <td className="px-3 py-3 text-muted-foreground">
                          {row.team_name ?? t("unassigned")}
                        </td>
                        <td className="px-3 py-3 text-muted-foreground">
                          {row.responsible_staff_name ?? t("noResponsible")}
                        </td>
                        <td className="px-3 py-3 tabular-nums text-foreground">
                          {row.quantity}
                        </td>
                        <td className="px-3 py-3 text-muted-foreground">
                          {t(`teamStates.${row.state}`)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-2">
                            {canManage && (
                              <TrainingEquipmentDialog
                                mode="edit"
                                equipment={{
                                  id: row.id,
                                  item_name: row.item_name,
                                  team_id: row.team_id,
                                  responsible_staff_id: row.responsible_staff_id,
                                  quantity: row.quantity,
                                  state: row.state,
                                  note: row.note,
                                }}
                                teams={teams.map((team) => ({ id: team.id, name: team.name }))}
                                staff={staffOptions}
                                seasonId={activeSeason?.id ?? null}
                                createAction={createTeamEquipmentAction}
                                updateAction={updateTeamEquipmentAction}
                              />
                            )}
                            {canManage && (
                              <ConfirmDeleteButton
                                action={deleteTeamEquipmentAction}
                                successMessage={tf("itemDeleted")}
                                errorMessage={tf("deleteFailed")}
                                hiddenFields={{ equipment_id: row.id }}
                                triggerLabel={t("delete")}
                                triggerClassName="rounded-lg border border-destructive/60 px-2.5 py-1 text-xs font-medium text-destructive"
                                title={t("deleteConfirmTitle")}
                                body={t("deleteConfirmBody", { name: row.item_name })}
                                confirmLabel={t("deleteConfirm")}
                                cancelLabel={t("cancel")}
                              />
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <ul className="space-y-2 md:hidden">
                {visibleTeamEquipment.map((row) => (
                  <li key={row.id} className="rounded-xl border border-border bg-card p-3 text-sm">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium text-foreground">{row.item_name}</p>
                      <span className="text-xs text-muted-foreground">
                        {t(`teamStates.${row.state}`)}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {row.team_name ?? t("unassigned")} ·{" "}
                      {row.responsible_staff_name ?? t("noResponsible")} ·{" "}
                      {t("quantity")}: {row.quantity}
                    </p>
                    {canManage && (
                      <div className="mt-2 flex items-center gap-2">
                        <TrainingEquipmentDialog
                          mode="edit"
                          equipment={{
                            id: row.id,
                            item_name: row.item_name,
                            team_id: row.team_id,
                            responsible_staff_id: row.responsible_staff_id,
                            quantity: row.quantity,
                            state: row.state,
                            note: row.note,
                          }}
                          teams={teams.map((team) => ({ id: team.id, name: team.name }))}
                          staff={staffOptions}
                          seasonId={activeSeason?.id ?? null}
                          createAction={createTeamEquipmentAction}
                          updateAction={updateTeamEquipmentAction}
                        />
                        <ConfirmDeleteButton
                          action={deleteTeamEquipmentAction}
                          successMessage={tf("itemDeleted")}
                          errorMessage={tf("deleteFailed")}
                          hiddenFields={{ equipment_id: row.id }}
                          triggerLabel={t("delete")}
                          triggerClassName="rounded-lg border border-destructive/60 px-2.5 py-1 text-xs font-medium text-destructive"
                          title={t("deleteConfirmTitle")}
                          body={t("deleteConfirmBody", { name: row.item_name })}
                          confirmLabel={t("deleteConfirm")}
                          cancelLabel={t("cancel")}
                        />
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}

      {tab === "requests" && (
        <section className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold">{t("requestsTitle")}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("requestsDescription")}
            </p>
          </div>

          {canReport && (
            <MutationForm
              action={createEquipmentRequestAction}
              successMessage={tf("equipmentRequestCreated")}
              errorMessage={tf("addFailed")}
              className="grid gap-2 rounded-xl border border-border bg-card p-4 sm:grid-cols-4"
            >
              <select name="team_id" className={inputClass} aria-label={t("team")}>
                <option value="">{t("unassigned")}</option>
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
              <input
                name="item_name"
                required
                placeholder={t("itemName")}
                className={inputClass}
              />
              <input
                name="quantity"
                type="number"
                min="1"
                defaultValue="1"
                className={inputClass}
                aria-label={t("quantity")}
              />
              <FormSubmitButton
                idleLabel={t("newRequest")}
                pendingLabel={t("saving")}
                className="rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground"
              />
              <textarea
                name="note"
                placeholder={t("note")}
                className={`${inputClass} sm:col-span-4`}
                rows={2}
              />
            </MutationForm>
          )}

          {requests.length === 0 ? (
            <EmptyState title={t("emptyRequests")} description={t("emptyRequestsDescription")} />
          ) : (
            <div className="space-y-2">
              {requests.map((request) => (
                <div
                  key={request.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-4"
                >
                  <div>
                    <p className="font-medium">
                      {request.item_name} × {request.quantity}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {request.team_name ?? t("unassigned")} ·{" "}
                      {request.requester_name ?? t("unknownRequester")}
                      {request.note ? ` · ${request.note}` : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-muted px-2 py-1 text-xs">
                      {t(`requestStatuses.${request.status}`)}
                    </span>
                    {canManage && (
                      <>
                        {request.status === "requested" && (
                          <>
                            <MutationForm
                              action={decideEquipmentRequestAction}
                              successMessage={tf("equipmentRequestUpdated")}
                              errorMessage={tf("saveFailed")}
                            >
                              <input type="hidden" name="request_id" value={request.id} />
                              <input type="hidden" name="status" value="approved" />
                              <FormSubmitButton
                                idleLabel={t("actions.approve")}
                                pendingLabel={t("saving")}
                                className="rounded-lg bg-primary px-2 py-1 text-xs text-primary-foreground"
                              />
                            </MutationForm>
                            <MutationForm
                              action={decideEquipmentRequestAction}
                              successMessage={tf("equipmentRequestUpdated")}
                              errorMessage={tf("saveFailed")}
                            >
                              <input type="hidden" name="request_id" value={request.id} />
                              <input type="hidden" name="status" value="rejected" />
                              <FormSubmitButton
                                idleLabel={t("actions.reject")}
                                pendingLabel={t("saving")}
                                className="rounded-lg border border-destructive px-2 py-1 text-xs text-destructive"
                              />
                            </MutationForm>
                          </>
                        )}
                        <MutationForm
                          action={decideEquipmentRequestAction}
                          successMessage={tf("equipmentRequestUpdated")}
                          errorMessage={tf("saveFailed")}
                        >
                          <input type="hidden" name="request_id" value={request.id} />
                          <input type="hidden" name="status" value="purchased" />
                          <FormSubmitButton
                            idleLabel={t("actions.purchase")}
                            pendingLabel={t("saving")}
                            className="rounded-lg border border-border px-2 py-1 text-xs"
                          />
                        </MutationForm>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
