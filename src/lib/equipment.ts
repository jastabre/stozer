import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Database,
  EquipmentItemState,
  EquipmentRequestStatus,
} from "@/types/database";

type Supabase = SupabaseClient<Database>;

export const SIZE_PRESETS = {
  youth: ["128", "140", "152", "164", "176"],
  adult: ["XS", "S", "M", "L", "XL", "XXL", "3XL"],
} as const;

export type EquipmentType = Database["public"]["Tables"]["equipment_types"]["Row"];
export type AthleteEquipmentItem = Database["public"]["Tables"]["athlete_equipment"]["Row"];
export type TeamEquipmentItem = Database["public"]["Tables"]["team_equipment"]["Row"];
export type EquipmentRequest = Database["public"]["Tables"]["equipment_requests"]["Row"];

export type EquipmentFilter = "complete" | "missing" | "not_issued" | "lost_damaged";

export interface PlayerEquipmentRow {
  athlete_id: string;
  first_name: string;
  last_name: string;
  club_athlete_number: number;
  team_id: string;
  jersey_number: number | null;
  items: Array<AthleteEquipmentItem & { equipment_type: EquipmentType }>;
  summary: {
    complete: boolean;
    missing: boolean;
    not_issued: boolean;
    lost_or_damaged: boolean;
  };
}

export interface PlayerEquipmentOverview {
  types: EquipmentType[];
  rows: PlayerEquipmentRow[];
  counts: Record<EquipmentFilter, number>;
}

export interface TeamEquipmentListItem extends TeamEquipmentItem {
  team_name: string | null;
  responsible_staff_name: string | null;
}

export interface EquipmentRequestListItem extends EquipmentRequest {
  team_name: string | null;
  requester_name: string | null;
  decided_by_name: string | null;
}

export interface TeamEquipmentRequirement {
  id: string;
  team_id: string;
  equipment_type_id: string;
}

export async function listEquipmentTypes(
  supabase: Supabase,
  orgId: string,
  includeDisabled = false
): Promise<EquipmentType[]> {
  let query = supabase
    .from("equipment_types")
    .select("*")
    .eq("organization_id", orgId)
    .order("enabled", { ascending: false })
    .order("sort_order")
    .order("name");
  if (!includeDisabled) query = query.eq("enabled", true);
  const { data, error } = await query;
  return error ? [] : ((data ?? []) as EquipmentType[]);
}

export async function createEquipmentType(
  supabase: Supabase,
  orgId: string,
  name: string,
  sizeModel: "single" | "upper_lower",
  isClubProperty: boolean
): Promise<{ ok: true } | { error: string }> {
  const { error } = await supabase.from("equipment_types").insert({
    organization_id: orgId,
    name: name.trim(),
    size_model: sizeModel,
    is_club_property: isClubProperty,
  });
  return error ? { error: error.message } : { ok: true };
}

export async function toggleEquipmentType(
  supabase: Supabase,
  orgId: string,
  typeId: string,
  enabled: boolean
): Promise<{ ok: true } | { error: string }> {
  const { error } = await supabase
    .from("equipment_types")
    .update({ enabled })
    .eq("id", typeId)
    .eq("organization_id", orgId);
  return error ? { error: error.message } : { ok: true };
}

export async function listTeamEquipmentRequirements(
  supabase: Supabase,
  orgId: string,
  teamId?: string
): Promise<TeamEquipmentRequirement[]> {
  let query = supabase
    .from("team_equipment_requirements")
    .select("id, team_id, equipment_type_id")
    .eq("organization_id", orgId);
  if (teamId) query = query.eq("team_id", teamId);
  const { data, error } = await query;
  return error ? [] : ((data ?? []) as TeamEquipmentRequirement[]);
}

export async function setTeamEquipmentRequirements(
  supabase: Supabase,
  orgId: string,
  teamId: string,
  equipmentTypeIds: string[]
): Promise<{ ok: true } | { error: string }> {
  const { error: deleteError } = await supabase
    .from("team_equipment_requirements")
    .delete()
    .eq("organization_id", orgId)
    .eq("team_id", teamId);
  if (deleteError) return { error: deleteError.message };
  const uniqueTypeIds = [...new Set(equipmentTypeIds)];
  if (uniqueTypeIds.length === 0) return { ok: true };
  const { error } = await supabase.from("team_equipment_requirements").insert(
    uniqueTypeIds.map((equipmentTypeId) => ({
      organization_id: orgId,
      team_id: teamId,
      equipment_type_id: equipmentTypeId,
    }))
  );
  return error ? { error: error.message } : { ok: true };
}

/**
 * Return one row for each current-season athlete and enabled equipment type.
 * Missing rows are intentionally materialized as `missing` so a promoted or
 * newly added athlete is immediately visible in the operational overview.
 */
export async function getPlayerEquipmentOverview(
  supabase: Supabase,
  orgId: string,
  teamId: string | undefined,
  seasonId: string,
  filter?: EquipmentFilter
): Promise<PlayerEquipmentOverview> {
  const [types, membershipResult] = await Promise.all([
    listEquipmentTypes(supabase, orgId),
    supabase
      .from("seasonal_memberships")
      .select("athlete_id, team_id, jersey_number, athletes(first_name, last_name, club_athlete_number)")
      .eq("organization_id", orgId)
      .eq("season_id", seasonId)
      .eq("status", "active")
      .order("athlete_id"),
  ]);

  const memberships = (membershipResult.data ?? []) as unknown as Array<{
    athlete_id: string;
    team_id: string;
    jersey_number: number | null;
    athletes: {
      first_name: string;
      last_name: string;
      club_athlete_number: number;
    } | null;
  }>;
  const selected = teamId
    ? memberships.filter((membership) => membership.team_id === teamId)
    : memberships;
  const athleteIds = selected.map((membership) => membership.athlete_id);
  const typeIds = types.map((type) => type.id);
  const itemResult = athleteIds.length && typeIds.length
    ? await supabase
        .from("athlete_equipment")
        .select("*")
        .eq("organization_id", orgId)
        .in("athlete_id", athleteIds)
        .in("equipment_type_id", typeIds)
    : { data: [], error: null };
  const items = (itemResult.data ?? []) as AthleteEquipmentItem[];
  const itemsByKey = new Map(items.map((item) => [`${item.athlete_id}:${item.equipment_type_id}`, item]));
  const typeById = new Map(types.map((type) => [type.id, type]));
  const counts: Record<EquipmentFilter, number> = {
    complete: 0,
    missing: 0,
    not_issued: 0,
    lost_damaged: 0,
  };

  const rows = selected.flatMap((membership) => {
    const athlete = membership.athletes;
    if (!athlete) return [];
    const rowItems = types.map((type) => {
      const existing = itemsByKey.get(`${membership.athlete_id}:${type.id}`);
      return {
        ...(existing ?? {
          id: `missing:${membership.athlete_id}:${type.id}`,
          organization_id: orgId,
          athlete_id: membership.athlete_id,
          equipment_type_id: type.id,
          size_value: null,
          size_value_upper: null,
          state: "missing" as EquipmentItemState,
          issued_at: null,
          returned_at: null,
          note: null,
          created_at: "",
          updated_at: "",
        }),
        equipment_type: typeById.get(type.id) as EquipmentType,
      };
    });
    const absent = rowItems.some((item) => item.id.startsWith("missing:"));
    const missing = absent || rowItems.some((item) => item.state === "missing");
    const notIssued = missing || rowItems.some((item) => item.state === "returned");
    const lostOrDamaged = rowItems.some(
      (item) => item.state === "lost" || item.state === "damaged"
    );
    const complete = rowItems.length > 0 && rowItems.every((item) => item.state === "issued");
    const summary = { complete, missing, not_issued: notIssued, lost_or_damaged: lostOrDamaged };
    const row: PlayerEquipmentRow = {
      athlete_id: membership.athlete_id,
      first_name: athlete.first_name,
      last_name: athlete.last_name,
      club_athlete_number: athlete.club_athlete_number,
      team_id: membership.team_id,
      jersey_number: membership.jersey_number,
      items: rowItems,
      summary,
    };
    for (const key of Object.keys(counts) as EquipmentFilter[]) {
      if (summary[key === "lost_damaged" ? "lost_or_damaged" : key]) counts[key] += 1;
    }
    return filter && !summary[filter === "lost_damaged" ? "lost_or_damaged" : filter]
      ? []
      : [row];
  });

  return { types, rows, counts };
}

async function ensureEquipmentReferences(
  supabase: Supabase,
  orgId: string,
  athleteId: string,
  typeId: string
): Promise<{ ok: true } | { error: string }> {
  const [{ data: athlete }, { data: equipmentType }] = await Promise.all([
    supabase.from("athletes").select("id").eq("id", athleteId).eq("organization_id", orgId).maybeSingle(),
    supabase.from("equipment_types").select("id").eq("id", typeId).eq("organization_id", orgId).maybeSingle(),
  ]);
  if (!athlete || !equipmentType) return { error: "Equipment reference is outside the organization" };
  return { ok: true };
}

export async function setAthleteSize(
  supabase: Supabase,
  orgId: string,
  athleteId: string,
  typeId: string,
  sizeValue: string | null,
  sizeValueUpper?: string | null
): Promise<{ ok: true } | { error: string }> {
  const references = await ensureEquipmentReferences(supabase, orgId, athleteId, typeId);
  if ("error" in references) return references;
  const { error } = await supabase.from("athlete_equipment").upsert(
    {
      organization_id: orgId,
      athlete_id: athleteId,
      equipment_type_id: typeId,
      size_value: sizeValue?.trim() || null,
      size_value_upper: sizeValueUpper?.trim() || null,
    },
    { onConflict: "athlete_id,equipment_type_id" }
  );
  return error ? { error: error.message } : { ok: true };
}

const allowedTransitions: Record<EquipmentItemState, EquipmentItemState[]> = {
  missing: ["missing", "issued"],
  issued: ["issued", "returned", "lost", "damaged"],
  returned: ["returned", "issued"],
  lost: ["lost", "issued"],
  damaged: ["damaged", "issued"],
};

export async function transitionAthleteItem(
  supabase: Supabase,
  orgId: string,
  athleteId: string,
  typeId: string,
  state: EquipmentItemState,
  note?: string | null
): Promise<{ ok: true } | { error: string }> {
  const references = await ensureEquipmentReferences(supabase, orgId, athleteId, typeId);
  if ("error" in references) return references;
  const { data: existing, error: readError } = await supabase
    .from("athlete_equipment")
    .select("*")
    .eq("organization_id", orgId)
    .eq("athlete_id", athleteId)
    .eq("equipment_type_id", typeId)
    .maybeSingle();
  if (readError) return { error: readError.message };
  const current = existing?.state ?? "missing";
  if (!allowedTransitions[current].includes(state)) {
    return { error: `Invalid equipment transition: ${current} -> ${state}` };
  }
  const now = new Date().toISOString();
  const { error } = await supabase.from("athlete_equipment").upsert(
    {
      organization_id: orgId,
      athlete_id: athleteId,
      equipment_type_id: typeId,
      state,
      issued_at: state === "issued" ? now : existing?.issued_at ?? null,
      returned_at: state === "returned" ? now : state === "issued" ? null : existing?.returned_at ?? null,
      note: note?.trim() || existing?.note || null,
    },
    { onConflict: "athlete_id,equipment_type_id" }
  );
  return error ? { error: error.message } : { ok: true };
}

export async function listTeamEquipment(
  supabase: Supabase,
  orgId: string,
  seasonId?: string
): Promise<TeamEquipmentListItem[]> {
  let query = supabase
    .from("team_equipment")
    .select("*")
    .eq("organization_id", orgId)
    .order("item_name");
  if (seasonId) query = query.eq("season_id", seasonId);
  const { data, error } = await query;
  if (error || !data) return [];
  const rows = data as TeamEquipmentItem[];
  const [teams, staff] = await Promise.all([
    supabase.from("teams").select("id, name").eq("organization_id", orgId),
    supabase.from("staff").select("id, first_name, last_name").eq("organization_id", orgId),
  ]);
  const teamNames = new Map((teams.data ?? []).map((team) => [team.id, team.name]));
  const staffNames = new Map((staff.data ?? []).map((person) => [person.id, `${person.last_name} ${person.first_name}`]));
  return rows.map((row) => ({
    ...row,
    team_name: row.team_id ? teamNames.get(row.team_id) ?? null : null,
    responsible_staff_name: row.responsible_staff_id ? staffNames.get(row.responsible_staff_id) ?? null : null,
  }));
}

export async function createTeamEquipment(
  supabase: Supabase,
  orgId: string,
  input: Pick<Database["public"]["Tables"]["team_equipment"]["Insert"], "team_id" | "responsible_staff_id" | "item_name" | "quantity" | "state" | "season_id" | "note">
): Promise<{ ok: true } | { error: string }> {
  const { error } = await supabase.from("team_equipment").insert({ organization_id: orgId, ...input });
  return error ? { error: error.message } : { ok: true };
}

export async function updateTeamEquipment(
  supabase: Supabase,
  orgId: string,
  id: string,
  input: Pick<Database["public"]["Tables"]["team_equipment"]["Update"], "team_id" | "responsible_staff_id" | "item_name" | "quantity" | "state" | "note">
): Promise<{ ok: true } | { error: string }> {
  const { error } = await supabase.from("team_equipment").update(input).eq("id", id).eq("organization_id", orgId);
  return error ? { error: error.message } : { ok: true };
}

export async function deleteTeamEquipment(
  supabase: Supabase,
  orgId: string,
  id: string
): Promise<{ ok: true } | { error: string }> {
  const { error } = await supabase.from("team_equipment").delete().eq("id", id).eq("organization_id", orgId);
  return error ? { error: error.message } : { ok: true };
}

export async function listEquipmentRequests(
  supabase: Supabase,
  orgId: string
): Promise<EquipmentRequestListItem[]> {
  const { data, error } = await supabase
    .from("equipment_requests")
    .select("*")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  const [teams, staff] = await Promise.all([
    supabase.from("teams").select("id, name").eq("organization_id", orgId),
    supabase.from("staff").select("id, first_name, last_name").eq("organization_id", orgId),
  ]);
  const teamNames = new Map((teams.data ?? []).map((team) => [team.id, team.name]));
  const staffNames = new Map((staff.data ?? []).map((person) => [person.id, `${person.last_name} ${person.first_name}`]));
  return (data as EquipmentRequest[]).map((row) => ({
    ...row,
    team_name: row.team_id ? teamNames.get(row.team_id) ?? null : null,
    requester_name: row.requester_staff_id ? staffNames.get(row.requester_staff_id) ?? null : null,
    decided_by_name: row.decided_by_staff_id ? staffNames.get(row.decided_by_staff_id) ?? null : null,
  }));
}

export async function createEquipmentRequest(
  supabase: Supabase,
  orgId: string,
  input: Pick<Database["public"]["Tables"]["equipment_requests"]["Insert"], "team_id" | "item_name" | "quantity" | "note" | "requester_staff_id">
): Promise<{ ok: true } | { error: string }> {
  const { error } = await supabase.from("equipment_requests").insert({ organization_id: orgId, ...input });
  return error ? { error: error.message } : { ok: true };
}

export async function decideEquipmentRequest(
  supabase: Supabase,
  orgId: string,
  id: string,
  status: EquipmentRequestStatus,
  staffId: string
): Promise<{ ok: true } | { error: string }> {
  const { data: request, error: readError } = await supabase
    .from("equipment_requests")
    .select("status")
    .eq("id", id)
    .eq("organization_id", orgId)
    .maybeSingle();
  if (readError || !request) return { error: readError?.message ?? "Request not found" };
  const allowed: Record<EquipmentRequestStatus, EquipmentRequestStatus[]> = {
    requested: ["requested", "approved", "rejected"],
    approved: ["approved", "purchased", "rejected"],
    purchased: ["purchased"],
    rejected: ["rejected", "requested"],
  };
  if (!allowed[request.status].includes(status)) {
    return { error: `Invalid request transition: ${request.status} -> ${status}` };
  }
  const { error } = await supabase
    .from("equipment_requests")
    .update({ status, decided_by_staff_id: staffId, decided_at: new Date().toISOString() })
    .eq("id", id)
    .eq("organization_id", orgId);
  return error ? { error: error.message } : { ok: true };
}
