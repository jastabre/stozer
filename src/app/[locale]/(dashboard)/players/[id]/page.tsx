import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { differenceInCalendarDays, format } from "date-fns";
import { hasPermission } from "@/lib/organization";
import { loadPlayerShell } from "@/lib/player-profile";
import {
  getOrganizationSettings,
  listContracts,
  listMedicalExaminations,
  listRegistrations,
} from "@/lib/club-data";
import {
  listEquipmentTypes,
  listEquipmentItems,
  listAthleteItemAssignments,
  localizeEquipmentTypeName,
} from "@/lib/equipment";
import { deriveStatus, medicalStatus } from "@/lib/status";
import { FormSubmitButton } from "@/components/FormSubmitButton";
import { MutationForm } from "@/components/ui/MutationForm";
import { PlayerSizesForm } from "@/components/equipment/PlayerSizesForm";
import { EditablePanel } from "@/components/players/EditablePanel";
import { PositionSelect } from "@/components/ui/PositionSelect";
import { DateField } from "@/components/ui/DateField";
import { savePlayerEdit } from "../actions";
import { savePlayerSizesAction } from "../../equipment/actions";

const REG_DOT: Record<string, string> = {
  green: "bg-emerald-500",
  yellow: "bg-amber-500",
  red: "bg-rose-500",
};
const MED_DOT: Record<string, string> = {
  not_recorded: "bg-slate-300",
  valid: "bg-emerald-500",
  expiring_soon: "bg-amber-500",
  expired: "bg-rose-500",
};

type StatusCell = {
  href: string;
  dot: string;
  label: string;
  value: string;
  sub: string | null;
};

export default async function PlayerProfilePage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;

  // Shared shell data (athlete + teams + active season) comes from the cached
  // loader also used by layout.tsx — no duplicate query in the same request.
  const { org, supabase, athlete, teams, activeSeason } = await loadPlayerShell(id);
  if (!athlete) notFound();

  const t = await getTranslations("players.profile");
  const te = await getTranslations("equipment");
  const tc = await getTranslations("common");
  const tf = await getTranslations("feedback");

  const [
    canEdit,
    canViewReg,
    canViewMedical,
    canViewContracts,
    canViewEquipment,
  ] = await Promise.all([
    hasPermission("athletes.edit"),
    hasPermission("registrations.view"),
    Promise.all([hasPermission("medical.view"), hasPermission("registrations.view")]).then(
      ([m, r]) => m || r
    ),
    hasPermission("contracts.view"),
    hasPermission("equipment.view"),
  ]);

  const [
    pieceTypes,
    pieceSizes,
    equipmentItems,
    equipmentAssignments,
    canEditMembership,
    settings,
    registrations,
    medical,
    contracts,
    orgRow,
  ] = await Promise.all([
    canViewEquipment
      ? listEquipmentTypes(supabase, org.organizationId)
      : Promise.resolve([]),
    canViewEquipment
      ? supabase
          .from("athlete_equipment")
          .select("equipment_type_id, size_value")
          .eq("organization_id", org.organizationId)
          .eq("athlete_id", athlete.id)
      : Promise.resolve({ data: [] }),
    canViewEquipment
      ? listEquipmentItems(supabase, org.organizationId)
      : Promise.resolve([]),
    canViewEquipment
      ? listAthleteItemAssignments(supabase, org.organizationId, athlete.id)
      : Promise.resolve([]),
    Promise.all([hasPermission("athletes.edit"), hasPermission("teams.edit")]).then(
      ([a, b]) => a || b
    ),
    getOrganizationSettings(supabase, org.organizationId),
    canViewReg
      ? listRegistrations(supabase, org.organizationId, athlete.id)
      : Promise.resolve([]),
    canViewMedical
      ? listMedicalExaminations(supabase, org.organizationId, athlete.id)
      : Promise.resolve([]),
    canViewContracts
      ? listContracts(supabase, org.organizationId, athlete.id)
      : Promise.resolve([]),
    supabase
      .from("organizations")
      .select("sport")
      .eq("id", org.organizationId)
      .maybeSingle()
      .then((r) => r.data),
  ]);

  const sizeByPieceType = new Map(
    (pieceSizes.data ?? []).map((row) => [row.equipment_type_id, row.size_value])
  );
  const assignmentByItem = new Map(
    equipmentAssignments.map((a) => [a.item_id, a])
  );
  // Read-only equipment: only items actually in the player's hands.
  const assignedEquipment = equipmentItems
    .map((item) => ({ item, assignment: assignmentByItem.get(item.id) ?? null }))
    .filter((row) => row.assignment && row.assignment.state !== "returned");

  const current = athlete.memberships.find((m) => m.isActive) ?? null;
  const past = athlete.memberships.filter((m) => !m.isActive);
  const currentTeam = current
    ? teams.find((team) => team.id === current.teamId)
    : undefined;
  // Context: first-team players get contracts (no guardians); everyone else
  // gets guardians (no first-team contract) — determined by the CURRENT team.
  const isFirstTeam = currentTeam?.category === "first_team";

  const threshold = settings?.warning_threshold_days ?? 30;
  const reg = registrations[0] ?? null;
  const med = medical[0] ?? null;
  const contract =
    contracts.find((c) => c.status === "active") ?? contracts[0] ?? null;
  const regTone = reg ? deriveStatus(new Date(reg.valid_until), threshold) : "red";
  const medTone = med
    ? medicalStatus(new Date(med.valid_until), threshold)
    : "not_recorded";
  const contractTone = contract?.valid_until
    ? deriveStatus(new Date(contract.valid_until), threshold)
    : "red";

  const fm = (date: string | null | undefined) =>
    date ? format(new Date(`${date}T00:00:00`), "dd.MM.yyyy") : null;
  const medDaysLeft = med
    ? differenceInCalendarDays(new Date(med.valid_until), new Date())
    : null;

  // ------------------------------------------------------------------
  // Status strip — the operational state, scannable at a glance. Sits under the
  // shared header/tabs and jumps to the matching tab.
  // ------------------------------------------------------------------
  const statusCells: StatusCell[] = [];
  if (canViewReg) {
    statusCells.push({
      href: `/${locale}/players/${athlete.id}/registrations`,
      dot: REG_DOT[regTone],
      label: t("sections.registrations"),
      value: !reg
        ? t("status.regNone")
        : regTone === "red"
          ? t("status.regExpired", { date: fm(reg.valid_until)! })
          : t("status.regValid", { date: fm(reg.valid_until)! }),
      sub: reg
        ? `${t(`regTones.${regTone}`)}${reg.season_name ? ` · ${reg.season_name}` : ""}`
        : null,
    });
  }
  if (canViewMedical) {
    statusCells.push({
      href: `/${locale}/players/${athlete.id}/medical`,
      dot: MED_DOT[medTone],
      label: t("sections.medical"),
      value: !med
        ? t("status.medNone")
        : medTone === "expired"
          ? t("status.medExpired", { date: fm(med.valid_until)! })
          : medTone === "expiring_soon"
            ? t("status.medExpiresIn", { count: medDaysLeft ?? 0 })
            : t("status.medValid", { date: fm(med.valid_until)! }),
      sub: med ? t(`medTones.${medTone}`) : null,
    });
  }
  if (isFirstTeam && canViewContracts) {
    const activeContract = contract?.status === "active";
    statusCells.push({
      href: `/${locale}/players/${athlete.id}/contracts`,
      dot: activeContract
        ? "bg-emerald-500"
        : contractTone === "red"
          ? "bg-rose-500"
          : "bg-amber-500",
      label: t("sections.contracts"),
      value: !contract
        ? t("status.contractNone")
        : contract.valid_until
          ? t("status.contractUntil", { date: fm(contract.valid_until)! })
          : t("contractActive"),
      sub: contract && activeContract ? t("contractActive") : null,
    });
  }

  const inputClass = "rounded-lg border px-3 py-2 text-sm";

  const editForm = (
    <MutationForm
      action={savePlayerEdit}
      successMessage={tf("playerUpdated")}
      errorMessage={tf("saveFailed")}
      className="grid gap-3 sm:grid-cols-2"
    >
      <input type="hidden" name="id" value={athlete.id} />
      <input
        name="first_name"
        defaultValue={athlete.first_name}
        required
        placeholder={t("firstName")}
        className={inputClass}
      />
      <input
        name="last_name"
        defaultValue={athlete.last_name}
        required
        placeholder={t("lastName")}
        className={inputClass}
      />
      <DateField
        name="birth_date"
        defaultValue={athlete.birth_date}
        required
        ariaLabel={t("birthDate")}
      />
      <select
        name="gender"
        defaultValue={athlete.gender ?? ""}
        aria-label={t("gender")}
        className={inputClass}
      >
        <option value="">{t("genderNone")}</option>
        <option value="male">{t("genders.male")}</option>
        <option value="female">{t("genders.female")}</option>
        <option value="other">{t("genders.other")}</option>
      </select>
      <input
        name="nationality"
        defaultValue={athlete.nationality ?? ""}
        placeholder={t("nationality")}
        className={inputClass}
      />
      <PositionSelect
        name="position"
        current={athlete.position}
        sport={orgRow?.sport}
        locale={locale === "en" ? "en" : "sr"}
        ariaLabel={t("position")}
        className={inputClass}
      />
      <input
        name="federation_id"
        defaultValue={athlete.federation_id ?? ""}
        placeholder={t("federationIdPlaceholder")}
        className={inputClass}
      />
      {canEditMembership && activeSeason && (
        <>
          <select
            name="team_id"
            defaultValue={current?.teamId ?? ""}
            aria-label={t("team")}
            className={inputClass}
          >
            <option value="">{t("noTeamAssign")}</option>
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
            defaultValue={current?.jerseyNumber ?? ""}
            placeholder={t("jerseyNumber")}
            aria-label={t("jerseyNumber")}
            className={inputClass}
          />
          <input
            name="jersey_name"
            defaultValue={current?.jerseyName ?? ""}
            placeholder={t("jerseyName")}
            className={inputClass}
          />
        </>
      )}
      <FormSubmitButton
        idleLabel={t("editSave")}
        pendingLabel={t("submitting")}
        className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground sm:col-span-2"
      />
    </MutationForm>
  );

  return (
    <div className="space-y-4">
      {statusCells.length > 0 && (
        <section className="overflow-hidden rounded-xl border border-border bg-card">
          <div
            className={`grid grid-cols-1 gap-px bg-border ${
              statusCells.length >= 2 ? "sm:grid-cols-2" : ""
            } ${statusCells.length >= 3 ? "sm:grid-cols-3" : ""}`}
          >
            {statusCells.map((cell) => (
              <Link
                key={cell.href}
                href={cell.href}
                className="flex items-start gap-3 bg-card px-4 py-3 transition-colors hover:bg-muted/40 sm:px-5"
              >
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${cell.dot}`} />
                <span className="flex min-w-0 flex-col">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    {cell.label}
                  </span>
                  <span className="mt-0.5 truncate text-sm font-semibold">{cell.value}</span>
                  {cell.sub && (
                    <span className="truncate text-xs text-muted-foreground">{cell.sub}</span>
                  )}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ============================================================
          OSNOVNI PODACI — view-first, compact groups, explicit Izmeni
          ============================================================ */}
      <EditablePanel
        title={t("identity")}
        editLabel={tc("edit")}
        cancelLabel={tc("cancel")}
        editable={canEdit}
        editForm={editForm}
      >
        <div className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {t("groupPersonal")}
            </p>
            <dl className="mt-2 space-y-1.5 text-sm">
              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-muted-foreground">{t("birthDate")}</dt>
                <dd className="text-right font-medium">
                  {fm(athlete.birth_date)}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-muted-foreground">{t("gender")}</dt>
                <dd className="text-right font-medium">
                  {athlete.gender ? t(`genders.${athlete.gender}`) : t("notSet")}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-muted-foreground">{t("nationality")}</dt>
                <dd className="text-right font-medium">
                  {athlete.nationality || t("notSet")}
                </dd>
              </div>
              {athlete.federation_id && (
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="text-muted-foreground">{t("federationId")}</dt>
                  <dd className="text-right font-medium">
                    {athlete.federation_id}
                  </dd>
                </div>
              )}
            </dl>
          </div>

          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {t("groupSport")}
            </p>
            <dl className="mt-2 space-y-1.5 text-sm">
              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-muted-foreground">{t("team")}</dt>
                <dd className="text-right font-medium">
                  {current?.teamName ?? t("noTeamAssign")}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-muted-foreground">{t("position")}</dt>
                <dd className="text-right font-medium">{athlete.position || t("notSet")}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-muted-foreground">{t("jerseyNumber")}</dt>
                <dd className="text-right font-medium tabular-nums">
                  {current?.jerseyNumber ?? "—"}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-muted-foreground">{t("season")}</dt>
                <dd className="text-right font-medium">
                  {current?.seasonName ?? activeSeason?.name ?? t("noSeason")}
                </dd>
              </div>
            </dl>

            {past.length > 0 && (
              <details className="mt-4">
                <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
                  {t("history")} ({past.length})
                </summary>
                <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                  {past.map((m) => (
                    <li key={m.seasonId} className="flex justify-between">
                      <span>{m.seasonName}</span>
                      <span>
                        {m.teamName}
                        {m.jerseyNumber ? ` · ${m.jerseyNumber}` : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        </div>
      </EditablePanel>

      {/* ============================================================
          VELIČINE — one coherent sports-kit section
          ============================================================ */}
      {canViewEquipment && pieceTypes.length > 0 && (
        <section className="rounded-xl border border-border bg-card">
          <header className="flex items-center justify-between border-b border-border px-4 py-2.5 sm:px-5">
            <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {te("sizesTitle")}
            </h2>
          </header>
          <div className="px-4 py-4 sm:px-5">
            <PlayerSizesForm
              action={savePlayerSizesAction}
              athleteId={athlete.id}
              rows={pieceTypes.map((type) => ({
                typeId: type.id,
                name: type.name,
                label: localizeEquipmentTypeName(type.name, te),
                size: sizeByPieceType.get(type.id) ?? null,
              }))}
              noneLabel={te("sizeNone")}
              otherLabel={te("sizes.other")}
              customPlaceholder={te("sizes.customPlaceholder")}
              saveLabel={te("saveSizes")}
              savingLabel={te("savingSizes")}
              groupLabels={{
                matchKit: te("sizes.groupMatch"),
                tracksuit: te("sizes.groupTracksuit"),
                training: te("sizes.groupTraining"),
              }}
              topLabel={te("topLabel")}
              bottomLabel={te("bottomLabel")}
              shirtLabel={te("sizes.shirt")}
              shortsLabel={te("sizes.shorts")}
            />
          </div>
        </section>
      )}

      {/* ============================================================
          ZADUŽENA OPREMA — read-only, assigned items only
          ============================================================ */}
      {canViewEquipment && (
        <section className="rounded-xl border border-border bg-card">
          <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2.5 sm:px-5">
            <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {te("profileEquipmentTitle")}
            </h2>
            <Link
              href={`/${locale}/equipment?tab=players`}
              className="text-xs font-medium text-primary hover:underline"
            >
              {te("openEquipment")}
            </Link>
          </header>
          <div className="px-4 py-3 sm:px-5">
            {assignedEquipment.length === 0 ? (
              <p className="py-2 text-sm text-muted-foreground">{te("playerNoEquipment")}</p>
            ) : (
              <ul className="divide-y divide-border">
                {assignedEquipment.map(({ item, assignment }) => (
                  <li
                    key={item.id}
                    className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2.5 text-sm"
                  >
                    <span className="font-medium">{item.name}</span>
                    <span className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                      {(assignment!.size_top || assignment!.size_bottom) && (
                        <span>
                          {assignment!.size_top && assignment!.size_bottom
                            ? `${te("topLabel")}: ${assignment!.size_top} · ${te("bottomLabel")}: ${assignment!.size_bottom}`
                            : `${te("sizes.size")}: ${assignment!.size_top ?? assignment!.size_bottom}`}
                        </span>
                      )}
                      {assignment!.number && (
                        <span>
                          {te("numberLabel")}: {assignment!.number}
                        </span>
                      )}
                      <span>{te(`states.${assignment!.state}`)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
