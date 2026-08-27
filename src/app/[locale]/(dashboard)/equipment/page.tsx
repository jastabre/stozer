import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/layout/EmptyState";
import { hasPermission, requireOrganization } from "@/lib/organization";
import { createServerClient } from "@/lib/supabase/server";
import { getActiveSeason, listTeams } from "@/lib/club-data";
import {
  getPlayerEquipmentOverview,
  listEquipmentRequests,
  listEquipmentTypes,
  listTeamEquipment,
  listTeamEquipmentRequirements,
  type EquipmentFilter,
  type EquipmentType,
  SIZE_PRESETS,
} from "@/lib/equipment";
import {
  createEquipmentRequestAction,
  createEquipmentTypeAction,
  createTeamEquipmentAction,
  decideEquipmentRequestAction,
  deleteTeamEquipmentAction,
  saveTeamRequirementsAction,
  setAthleteSizeAction,
  toggleEquipmentTypeAction,
  transitionAthleteItemAction,
  updateTeamEquipmentAction,
} from "./actions";

const filters: EquipmentFilter[] = ["complete", "missing", "not_issued", "lost_damaged"];
const states = ["missing", "issued", "returned", "lost", "damaged"] as const;
const inputClass = "rounded-lg border border-border bg-background px-3 py-2 text-sm";

function sizeLabel(item: { size_value: string | null; size_value_upper: string | null }) {
  if (item.size_value && item.size_value_upper) return `${item.size_value} / ${item.size_value_upper}`;
  return item.size_value ?? "—";
}

function tabHref(tab: string, teamId?: string, filter?: string) {
  const params = new URLSearchParams({ tab });
  if (teamId) params.set("team", teamId);
  if (filter) params.set("filter", filter);
  return `/equipment?${params.toString()}`;
}

function SizeSelect({
  name,
  value,
  label,
}: {
  name: string;
  value: string | null;
  label: string;
}) {
  return (
    <label className="grid gap-1 text-xs text-muted-foreground">
      {label}
      <select name={`${name}_preset`} defaultValue={value && [...SIZE_PRESETS.youth, ...SIZE_PRESETS.adult].includes(value as never) ? value : ""} className={inputClass}>
        <option value="">Custom / none</option>
        <optgroup label="Youth">{SIZE_PRESETS.youth.map((preset) => <option key={preset} value={preset}>{preset}</option>)}</optgroup>
        <optgroup label="Adult">{SIZE_PRESETS.adult.map((preset) => <option key={preset} value={preset}>{preset}</option>)}</optgroup>
      </select>
      <input name={`${name}_custom`} defaultValue={value && ![...SIZE_PRESETS.youth, ...SIZE_PRESETS.adult].includes(value as never) ? value : ""} className={inputClass} placeholder="Custom value" />
    </label>
  );
}

function EquipmentTypeSettings({
  types,
  teams,
  selectedTeamId,
  requiredTypeIds,
  t,
}: {
  types: EquipmentType[];
  teams: Array<{ id: string; name: string }>;
  selectedTeamId?: string;
  requiredTypeIds: Set<string>;
  t: (key: string) => string;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">{t("typesTitle")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("typesDescription")}</p>
      </div>
      <div className="grid gap-2">
        {types.map((type) => (
          <div key={type.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3 text-sm">
            <div>
              <span className="font-medium">{type.name}</span>
              <span className="ml-2 text-xs text-muted-foreground">{t(`sizeModels.${type.size_model}`)} · {type.is_club_property ? t("clubProperty") : t("athleteKeeps")}</span>
            </div>
            <form action={toggleEquipmentTypeAction}>
              <input type="hidden" name="equipment_type_id" value={type.id} />
              <input type="hidden" name="enabled" value={String(!type.enabled)} />
              <button type="submit" className="rounded-lg border border-border px-3 py-1.5 text-xs hover:border-primary">
                {type.enabled ? t("disable") : t("enable")}
              </button>
            </form>
          </div>
        ))}
      </div>
      <form action={createEquipmentTypeAction} className="grid gap-2 rounded-lg bg-muted/40 p-3 sm:grid-cols-4">
        <input name="name" required maxLength={80} placeholder={t("typeName")} className={inputClass} />
        <select name="size_model" defaultValue="single" className={inputClass} aria-label={t("sizeModel")}>
          <option value="single">{t("sizeModels.single")}</option>
          <option value="upper_lower">{t("sizeModels.upper_lower")}</option>
        </select>
        <select name="is_club_property" defaultValue="true" className={inputClass} aria-label={t("ownership")}>
          <option value="true">{t("clubProperty")}</option>
          <option value="false">{t("athleteKeeps")}</option>
        </select>
        <button type="submit" className="rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground">{t("addType")}</button>
      </form>
      {teams.length > 0 && selectedTeamId && (
        <form action={saveTeamRequirementsAction} className="rounded-lg border border-border p-4">
          <h3 className="font-medium">{t("requirementsTitle")}</h3>
          <p className="mt-1 text-xs text-muted-foreground">{t("requirementsDescription")}</p>
          <select name="team_id" defaultValue={selectedTeamId} className={`${inputClass} mt-3 w-full`} aria-label={t("team")}>
            {teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
          </select>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {types.filter((type) => type.enabled).map((type) => (
              <label key={type.id} className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="equipment_type_id" value={type.id} defaultChecked={requiredTypeIds.has(type.id)} />
                {type.name}
              </label>
            ))}
          </div>
          <button type="submit" className="mt-3 rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground">{t("saveRequirements")}</button>
        </form>
      )}
    </div>
  );
}

export default async function EquipmentPage({
  searchParams,
}: {
  searchParams?: Promise<{ tab?: string; team?: string; filter?: string }>;
}) {
  const org = await requireOrganization();
  if (!(await hasPermission("equipment.view"))) notFound();
  const supabase = await createServerClient();
  const query = (await searchParams) ?? {};
  const tab = query.tab === "team" || query.tab === "requests" ? query.tab : "players";
  const filter = filters.includes(query.filter as EquipmentFilter) ? query.filter as EquipmentFilter : undefined;
  const [activeSeason, teams, allTypes, requests, teamEquipment, t] = await Promise.all([
    getActiveSeason(supabase, org.organizationId),
    listTeams(supabase, org.organizationId),
    listEquipmentTypes(supabase, org.organizationId, true),
    listEquipmentRequests(supabase, org.organizationId),
    listTeamEquipment(supabase, org.organizationId),
    getTranslations("equipment"),
  ]);
  const selectedTeamId = query.team && teams.some((team) => team.id === query.team) ? query.team : teams[0]?.id;
  const [overview, requirements] = activeSeason
    ? await Promise.all([
        getPlayerEquipmentOverview(supabase, org.organizationId, selectedTeamId, activeSeason.id, filter),
        selectedTeamId ? listTeamEquipmentRequirements(supabase, org.organizationId, selectedTeamId) : Promise.resolve([]),
      ])
    : [{ types: [], rows: [], counts: { complete: 0, missing: 0, not_issued: 0, lost_damaged: 0 } }, []];
  const [canReport, canManage] = await Promise.all([hasPermission("equipment.report"), hasPermission("equipment.manage")]);
  const staff = await supabase.from("staff").select("id, first_name, last_name").eq("organization_id", org.organizationId).order("last_name");
  const requiredTypeIds = new Set(requirements.map((requirement) => requirement.equipment_type_id));
  const exportHref = `/equipment/export${selectedTeamId ? `?team_id=${encodeURIComponent(selectedTeamId)}` : ""}`;
  const tString = (key: string) => t(key as never);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">{t("eyebrow")}</p>
          <h1 className="mt-1 text-2xl font-bold">{t("title")}</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{t("description")}</p>
        </div>
        {tab === "players" && <Link href={exportHref} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">{t("export")}</Link>}
      </div>

      <nav className="flex flex-wrap gap-2 border-b border-border pb-3" aria-label={t("tabsLabel")}>
        <Link href={tabHref("players", selectedTeamId, filter)} className={`rounded-lg px-3 py-2 text-sm ${tab === "players" ? "bg-foreground text-background" : "border border-border"}`}>{t("tabs.players")}</Link>
        <Link href={tabHref("team", selectedTeamId)} className={`rounded-lg px-3 py-2 text-sm ${tab === "team" ? "bg-foreground text-background" : "border border-border"}`}>{t("tabs.team")}</Link>
        <Link href={tabHref("requests", selectedTeamId)} className={`rounded-lg px-3 py-2 text-sm ${tab === "requests" ? "bg-foreground text-background" : "border border-border"}`}>{t("tabs.requests")}</Link>
      </nav>

      {tab === "players" && (
        <section className="space-y-4">
          <form method="get" className="flex flex-wrap items-end gap-3 rounded-xl border border-border p-4">
            <input type="hidden" name="tab" value="players" />
            <label className="grid gap-1 text-xs text-muted-foreground">{t("team")}
              <select name="team" defaultValue={selectedTeamId ?? ""} className={inputClass}>
                {teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-xs text-muted-foreground">{t("filter")}
              <select name="filter" defaultValue={filter ?? ""} className={inputClass}>
                <option value="">{t("filters.all")}</option>
                {filters.map((item) => <option key={item} value={item}>{t(`filters.${item}`)}</option>)}
              </select>
            </label>
            <button type="submit" className="rounded-lg border border-border px-3 py-2 text-sm">{t("apply")}</button>
            <span className="text-xs text-muted-foreground">{activeSeason?.name ?? t("noActiveSeason")}</span>
          </form>
          <div className="grid gap-3 sm:grid-cols-4">
            {filters.map((item) => <div key={item} className="rounded-xl border border-border p-4"><p className="text-xs text-muted-foreground">{t(`filters.${item}`)}</p><p className="mt-1 text-2xl font-semibold">{overview.counts[item]}</p></div>)}
          </div>
          {!activeSeason || overview.rows.length === 0 ? <EmptyState title={t("emptyPlayers")} description={t("emptyPlayersDescription")} /> : (
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="min-w-[900px] w-full text-sm">
                <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="px-4 py-3">{t("player")}</th><th className="px-4 py-3">{t("jersey")}</th>{overview.types.map((type) => <th key={type.id} className="px-4 py-3">{type.name}</th>)}<th className="px-4 py-3">{t("summary")}</th></tr></thead>
                <tbody>{overview.rows.map((row) => <tr key={row.athlete_id} className="border-t border-border align-top">
                  <td className="px-4 py-3 font-medium"><Link href={`/players/${row.athlete_id}/equipment`} className="hover:text-primary">{row.last_name} {row.first_name}</Link><div className="font-mono text-xs text-muted-foreground">C{String(row.club_athlete_number).padStart(4, "0")}</div></td>
                  <td className="px-4 py-3">{row.jersey_number ?? "—"}</td>
                  {row.items.map((item) => <td key={item.equipment_type_id} className="px-4 py-3"><div className="font-medium">{sizeLabel(item)}</div><span className="text-xs text-muted-foreground">{t(`states.${item.state}`)}</span>{canReport && <><form action={setAthleteSizeAction} className="mt-2 grid gap-1"><input type="hidden" name="athlete_id" value={row.athlete_id} /><input type="hidden" name="equipment_type_id" value={item.equipment_type_id} /><div className="grid gap-1 sm:grid-cols-2"><SizeSelect name="size_value" value={item.size_value} label="Size" />{item.equipment_type.size_model === "upper_lower" && <SizeSelect name="size_value_upper" value={item.size_value_upper} label="Lower" />}</div><button type="submit" className="rounded border border-border px-1.5 py-1 text-[10px] hover:border-primary">{t("save")}</button></form><div className="mt-2 flex flex-wrap gap-1">{(item.state === "issued" ? ["returned", "lost", "damaged"] : item.state === "lost" || item.state === "damaged" || item.state === "returned" ? ["issued"] : ["issued"]).map((next) => <form key={next} action={transitionAthleteItemAction}><input type="hidden" name="athlete_id" value={row.athlete_id} /><input type="hidden" name="equipment_type_id" value={item.equipment_type_id} /><input type="hidden" name="state" value={next} /><button type="submit" className="rounded border border-border px-1.5 py-1 text-[10px] hover:border-primary">{t(`actions.${next}`)}</button></form>)}</div></>}</td>)}
                  <td className="px-4 py-3"><div className="flex flex-wrap gap-1">{row.summary.complete && <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs text-emerald-800">{t("filters.complete")}</span>}{row.summary.missing && <span className="rounded-full bg-amber-100 px-2 py-1 text-xs text-amber-800">{t("filters.missing")}</span>}{row.summary.lost_or_damaged && <span className="rounded-full bg-red-100 px-2 py-1 text-xs text-red-800">{t("filters.lost_damaged")}</span>}</div></td>
                </tr>)}</tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {tab === "team" && <section className="space-y-4"><div><h2 className="text-lg font-semibold">{t("teamTitle")}</h2><p className="mt-1 text-sm text-muted-foreground">{t("teamDescription")}</p></div>{canManage && <form action={createTeamEquipmentAction} className="grid gap-2 rounded-xl border border-border p-4 sm:grid-cols-6"><input type="hidden" name="season_id" value={activeSeason?.id ?? ""} /><input name="item_name" required placeholder={t("itemName")} className={`${inputClass} sm:col-span-2`} /><select name="team_id" className={inputClass}><option value="">{t("unassigned")}</option>{teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select><select name="responsible_staff_id" className={inputClass}><option value="">{t("noResponsible")}</option>{(staff.data ?? []).map((person) => <option key={person.id} value={person.id}>{person.last_name} {person.first_name}</option>)}</select><input name="quantity" type="number" min="0" defaultValue="1" className={inputClass} aria-label={t("quantity")} /><select name="state" defaultValue="issued" className={inputClass}>{states.map((state) => <option key={state} value={state}>{t(`states.${state}`)}</option>)}</select><button type="submit" className="rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground sm:col-span-6">{t("addItem")}</button></form>}{teamEquipment.length === 0 ? <EmptyState title={t("emptyTeam") } description={t("emptyTeamDescription")} /> : <div className="overflow-x-auto rounded-xl border border-border"><table className="min-w-[850px] w-full text-sm"><thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="px-4 py-3">{t("itemName")}</th><th className="px-4 py-3">{t("team")}</th><th className="px-4 py-3">{t("responsible")}</th><th className="px-4 py-3">{t("quantity")}</th><th className="px-4 py-3">{t("state")}</th><th className="px-4 py-3">{t("actionsLabel")}</th></tr></thead><tbody>{teamEquipment.map((item) => <tr key={item.id} className="border-t border-border"><td className="px-4 py-3 font-medium">{item.item_name}</td><td className="px-4 py-3">{item.team_name ?? t("unassigned")}</td><td className="px-4 py-3">{item.responsible_staff_name ?? "—"}</td><td className="px-4 py-3">{item.quantity}</td><td className="px-4 py-3">{t(`states.${item.state}`)}</td><td className="px-4 py-3">{canManage && <div className="flex flex-wrap gap-2"><form action={updateTeamEquipmentAction} className="flex flex-wrap gap-1"><input type="hidden" name="equipment_id" value={item.id} /><input name="item_name" defaultValue={item.item_name} className={`${inputClass} w-28`} /><input name="quantity" type="number" min="0" defaultValue={item.quantity} className={`${inputClass} w-20`} /><select name="state" defaultValue={item.state} className={inputClass}>{states.map((state) => <option key={state} value={state}>{t(`states.${state}`)}</option>)}</select><button type="submit" className="rounded-lg bg-primary px-2 py-1 text-xs text-primary-foreground">{t("save")}</button></form><form action={deleteTeamEquipmentAction}><input type="hidden" name="equipment_id" value={item.id} /><button type="submit" className="rounded-lg border border-destructive px-2 py-1 text-xs text-destructive">{t("delete")}</button></form></div>}</td></tr>)}</tbody></table></div>}</section>}

      {tab === "requests" && <section className="space-y-4"><div><h2 className="text-lg font-semibold">{t("requestsTitle")}</h2><p className="mt-1 text-sm text-muted-foreground">{t("requestsDescription")}</p></div>{canReport && <form action={createEquipmentRequestAction} className="grid gap-2 rounded-xl border border-border p-4 sm:grid-cols-4"><select name="team_id" className={inputClass}><option value="">{t("unassigned")}</option>{teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select><input name="item_name" required placeholder={t("itemName")} className={inputClass} /><input name="quantity" type="number" min="1" defaultValue="1" className={inputClass} aria-label={t("quantity")} /><button type="submit" className="rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground">{t("newRequest")}</button><textarea name="note" placeholder={t("note")} className={`${inputClass} sm:col-span-4`} rows={2} /></form>}{requests.length === 0 ? <EmptyState title={t("emptyRequests")} description={t("emptyRequestsDescription")} /> : <div className="space-y-2">{requests.map((request) => <div key={request.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-4"><div><p className="font-medium">{request.item_name} × {request.quantity}</p><p className="text-sm text-muted-foreground">{request.team_name ?? t("unassigned")} · {request.requester_name ?? t("unknownRequester")}{request.note ? ` · ${request.note}` : ""}</p></div><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-muted px-2 py-1 text-xs">{t(`requestStatuses.${request.status}`)}</span>{canManage && <>{request.status === "requested" && <><form action={decideEquipmentRequestAction}><input type="hidden" name="request_id" value={request.id} /><input type="hidden" name="status" value="approved" /><button type="submit" className="rounded-lg bg-primary px-2 py-1 text-xs text-primary-foreground">{t("actions.approve")}</button></form><form action={decideEquipmentRequestAction}><input type="hidden" name="request_id" value={request.id} /><input type="hidden" name="status" value="rejected" /><button type="submit" className="rounded-lg border border-destructive px-2 py-1 text-xs text-destructive">{t("actions.reject")}</button></form></>}{request.status === "approved" && <form action={decideEquipmentRequestAction}><input type="hidden" name="request_id" value={request.id} /><input type="hidden" name="status" value="purchased" /><button type="submit" className="rounded-lg bg-primary px-2 py-1 text-xs text-primary-foreground">{t("actions.purchase")}</button></form>}</>}</div></div>)}</div>}{canManage && <EquipmentTypeSettings types={allTypes} teams={teams} selectedTeamId={selectedTeamId} requiredTypeIds={requiredTypeIds} t={tString} />}</section>}
    </div>
  );
}
