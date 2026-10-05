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
export type TeamEquipmentItem = Database["public"]["Tables"]["team_equipment"]["Row"];
export type EquipmentRequest = Database["public"]["Tables"]["equipment_requests"]["Row"];

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
  item_id: string;
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
    .from("team_equipment_item_requirements")
    .select("id, team_id, item_id")
    .eq("organization_id", orgId);
  if (teamId) query = query.eq("team_id", teamId);
  const { data, error } = await query;
  return error ? [] : ((data ?? []) as TeamEquipmentRequirement[]);
}

export async function setTeamEquipmentRequirements(
  supabase: Supabase,
  orgId: string,
  teamId: string,
  itemIds: string[]
): Promise<{ ok: true } | { error: string }> {
  const [{ data: team }, { data: items }] = await Promise.all([
    supabase.from("teams").select("id").eq("organization_id", orgId).eq("id", teamId).maybeSingle(),
    itemIds.length
      ? supabase.from("equipment_items").select("id").eq("organization_id", orgId).in("id", itemIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (!team || (items?.length ?? 0) !== new Set(itemIds).size) {
    return { error: "Team or equipment item is outside the organization" };
  }
  const { error: deleteError } = await supabase
    .from("team_equipment_item_requirements")
    .delete()
    .eq("organization_id", orgId)
    .eq("team_id", teamId);
  if (deleteError) return { error: deleteError.message };
  const uniqueItemIds = [...new Set(itemIds)];
  if (uniqueItemIds.length === 0) return { ok: true };
  const { error } = await supabase.from("team_equipment_item_requirements").insert(
    uniqueItemIds.map((itemId) => ({
      organization_id: orgId,
      team_id: teamId,
      item_id: itemId,
    }))
  );
  return error ? { error: error.message } : { ok: true };
}

export interface PlayerEquipmentSummary {
  /** False when the team has no required equipment configured yet. */
  hasRequirements: boolean;
  /** Number of required catalog articles for the team. */
  requiredCount: number;
  /** Required articles currently covered by an active (issued) assignment. */
  coveredCount: number;
  /** Required articles NOT covered by any active assignment. */
  missingCount: number;
  /** Ids of the required articles that are missing. */
  missingItemIds: string[];
  /** Active (issued) catalog items (regardless of requirements). */
  issuedCount: number;
  /** Items currently marked lost or damaged. */
  lostDamagedCount: number;
  /** All required articles covered (and at least one requirement exists). */
  complete: boolean;
}

/**
 * Compute the operational summary for one player from the team's REQUIRED
 * catalog articles. A requirement (equipment item) is covered when the player
 * has an ACTIVE (issued) assignment for that exact item — returned, lost and
 * damaged assignments do not satisfy a requirement. Articles that share the
 * same underlying parts stay independent because coverage is by item id, not
 * by part. No requirements configured → neutral summary, never "everything is
 * missing".
 */
export function summarizePlayerEquipment(
  assignments: AthleteItemAssignment[],
  requiredItemIds: Set<string>
): PlayerEquipmentSummary {
  const issued = assignments.filter((assignment) => assignment.state === "issued");
  const coveredItemIds = new Set(issued.map((assignment) => assignment.item_id));
  const missingItemIds = [...requiredItemIds].filter(
    (itemId) => !coveredItemIds.has(itemId)
  );
  const hasRequirements = requiredItemIds.size > 0;
  return {
    hasRequirements,
    requiredCount: requiredItemIds.size,
    coveredCount: requiredItemIds.size - missingItemIds.length,
    missingCount: missingItemIds.length,
    missingItemIds,
    issuedCount: issued.length,
    lostDamagedCount: assignments.filter(
      (assignment) => assignment.state === "lost" || assignment.state === "damaged"
    ).length,
    complete: hasRequirements && missingItemIds.length === 0,
  };
}

/**
 * Default types seeded by migration 00009 and disabled by 00018 (their data
 * was carried into the six single-piece types). Kept in the database for
 * history only: hidden from the settings UI and never offered in the
 * issue/size workflows.
 */
export const LEGACY_EQUIPMENT_TYPE_NAMES = [
  "Match Kit",
  "Tracksuit",
  "Training Kit",
] as const;

export function isLegacyEquipmentType(name: string): boolean {
  return (LEGACY_EQUIPMENT_TYPE_NAMES as readonly string[]).includes(name);
}

/** Default seeded equipment type names → i18n key for natural localized labels. */
export const DEFAULT_EQUIPMENT_TYPE_KEYS: Record<string, string> = {
  "Match Shirt": "matchShirt",
  "Match Shorts": "matchShorts",
  "Tracksuit Top": "tracksuitTop",
  "Tracksuit Bottom": "tracksuitBottom",
  "Training Shirt": "trainingShirt",
  "Training Shorts": "trainingShorts",
  // Legacy upper/lower defaults (disabled by migration 00018) — keep mapped so
  // old records still render localized names.
  "Match Kit": "matchKit",
  Tracksuit: "tracksuit",
  "Training Kit": "trainingKit",
};

export function localizeEquipmentTypeName(
  name: string,
  t: (key: string) => string
): string {
  const key = DEFAULT_EQUIPMENT_TYPE_KEYS[name];
  return key ? t(`typeNames.${key}`) : name;
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
  const references = await ensureTeamAndStaffReferences(supabase, orgId, input.team_id, input.responsible_staff_id, input.season_id);
  if ("error" in references) return references;
  const { error } = await supabase.from("team_equipment").insert({ organization_id: orgId, ...input });
  return error ? { error: error.message } : { ok: true };
}

export async function updateTeamEquipment(
  supabase: Supabase,
  orgId: string,
  id: string,
  input: Pick<Database["public"]["Tables"]["team_equipment"]["Update"], "team_id" | "responsible_staff_id" | "item_name" | "quantity" | "state" | "note">
): Promise<{ ok: true } | { error: string }> {
  const references = await ensureTeamAndStaffReferences(supabase, orgId, input.team_id, input.responsible_staff_id, undefined);
  if ("error" in references) return references;
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

async function ensureTeamAndStaffReferences(
  supabase: Supabase,
  orgId: string,
  teamId: string | null | undefined,
  staffId: string | null | undefined,
  seasonId: string | null | undefined
): Promise<{ ok: true } | { error: string }> {
  const checks = await Promise.all([
    teamId
      ? supabase.from("teams").select("id").eq("id", teamId).eq("organization_id", orgId).maybeSingle()
      : Promise.resolve({ data: { id: "optional" }, error: null }),
    staffId
      ? supabase.from("staff").select("id").eq("id", staffId).eq("organization_id", orgId).maybeSingle()
      : Promise.resolve({ data: { id: "optional" }, error: null }),
    seasonId
      ? supabase.from("seasons").select("id").eq("id", seasonId).eq("organization_id", orgId).maybeSingle()
      : Promise.resolve({ data: { id: "optional" }, error: null }),
  ]);
  return checks.every((check) => check.data) ? { ok: true } : { error: "Team, staff, or season is outside the organization" };
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
  if (input.team_id) {
    const { data: team } = await supabase.from("teams").select("id").eq("id", input.team_id).eq("organization_id", orgId).maybeSingle();
    if (!team) return { error: "Team is outside the organization" };
  }
  if (input.requester_staff_id) {
    const { data: requester } = await supabase.from("staff").select("id").eq("id", input.requester_staff_id).eq("organization_id", orgId).maybeSingle();
    if (!requester) return { error: "Requester is outside the organization" };
  }
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

export type EquipmentItem = Database["public"]["Tables"]["equipment_items"]["Row"];
export type AthleteItemAssignment = Database["public"]["Tables"]["athlete_item_assignments"]["Row"];

/** How many size values a catalog article uses. */
export type EquipmentSizeMode = "none" | "single" | "split";

export async function listEquipmentItems(
  supabase: Supabase,
  orgId: string
): Promise<EquipmentItem[]> {
  const { data, error } = await supabase
    .from("equipment_items")
    .select("*")
    .eq("organization_id", orgId)
    .order("sort_order");
  if (error || !data) return [];
  return data as EquipmentItem[];
}

export async function createEquipmentItem(
  supabase: Supabase,
  orgId: string,
  name: string,
  sizeMode: EquipmentSizeMode,
  hasNumber: boolean
): Promise<{ ok: true } | { error: string }> {
  const { error } = await supabase.from("equipment_items").insert({
    organization_id: orgId,
    name: name.trim(),
    size_mode: sizeMode,
    has_number: hasNumber,
  });
  return error ? { error: error.message } : { ok: true };
}

export async function updateEquipmentItem(
  supabase: Supabase,
  orgId: string,
  itemId: string,
  input: {
    name: string;
    sizeMode: EquipmentSizeMode;
    hasNumber: boolean;
  }
): Promise<{ ok: true } | { error: string }> {
  const { error } = await supabase
    .from("equipment_items")
    .update({
      name: input.name.trim(),
      size_mode: input.sizeMode,
      has_number: input.hasNumber,
    })
    .eq("id", itemId)
    .eq("organization_id", orgId);
  return error ? { error: error.message } : { ok: true };
}

/**
 * Delete a catalog item. Refuses when the item has player assignments: the
 * FK cascade would silently remove real issue records, so the operator must
 * clean those up explicitly (or keep the item and disable it in settings).
 */
export async function deleteEquipmentItem(
  supabase: Supabase,
  orgId: string,
  itemId: string
): Promise<{ ok: true } | { error: string }> {
  const { count, error: countError } = await supabase
    .from("athlete_item_assignments")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", orgId)
    .eq("item_id", itemId);
  if (countError) return { error: countError.message };
  if ((count ?? 0) > 0) {
    return {
      error: "Artikal ne može biti obrisan jer postoje zaduženja igrača.",
    };
  }
  const { error } = await supabase
    .from("equipment_items")
    .delete()
    .eq("organization_id", orgId)
    .eq("id", itemId);
  return error ? { error: error.message } : { ok: true };
}

export async function listAthleteItemAssignments(
  supabase: Supabase,
  orgId: string,
  athleteId?: string
): Promise<AthleteItemAssignment[]> {
  let query = supabase
    .from("athlete_item_assignments")
    .select("*")
    .eq("organization_id", orgId);
  if (athleteId) query = query.eq("athlete_id", athleteId);
  const { data, error } = await query;
  if (error || !data) return [];
  return data as AthleteItemAssignment[];
}

/** Save the player's six clothing-piece sizes in one write. */
export async function savePlayerSizes(
  supabase: Supabase,
  orgId: string,
  athleteId: string,
  sizes: Record<string, string | null>
): Promise<{ ok: true } | { error: string }> {
  // Every submitted piece is written, including explicit nulls: clearing a
  // size on the profile must clear the stored value, not keep the old one.
  const rows = Object.entries(sizes).map(([typeId, size]) => ({
    organization_id: orgId,
    athlete_id: athleteId,
    equipment_type_id: typeId,
    size_value: size?.trim() || null,
    size_value_upper: null,
  }));
  if (rows.length === 0) return { ok: true };
  const { error } = await supabase
    .from("athlete_equipment")
    .upsert(rows, { onConflict: "athlete_id,equipment_type_id" });
  return error ? { error: error.message } : { ok: true };
}

/**
 * Whether the catalog article supports an equipment number (has_number). The
 * server decides this itself — never trust the client — so a submitted number
 * is stored only for articles that genuinely support one.
 */
export async function itemUsesNumber(
  supabase: Supabase,
  orgId: string,
  itemId: string
): Promise<boolean> {
  const { data } = await supabase
    .from("equipment_items")
    .select("has_number")
    .eq("organization_id", orgId)
    .eq("id", itemId)
    .maybeSingle();
  return Boolean(data?.has_number);
}

export async function issueItemToAthlete(
  supabase: Supabase,
  orgId: string,
  athleteId: string,
  itemId: string,
  sizeTop: string | null,
  sizeBottom: string | null,
  note?: string | null,
  number?: string | null
): Promise<{ ok: true } | { error: string }> {
  const [athleteRes, itemRes] = await Promise.all([
    supabase
      .from("athletes")
      .select("id")
      .eq("id", athleteId)
      .eq("organization_id", orgId)
      .maybeSingle(),
    supabase
      .from("equipment_items")
      .select("id")
      .eq("id", itemId)
      .eq("organization_id", orgId)
      .maybeSingle(),
  ]);
  if (!athleteRes.data || !itemRes.data) {
    return { error: "Igrac ili artikal nije pronaden u organizaciji" };
  }
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("athlete_item_assignments")
    .upsert(
      {
        organization_id: orgId,
        athlete_id: athleteId,
        item_id: itemId,
        state: "issued",
        size_top: sizeTop?.trim() || null,
        size_bottom: sizeBottom?.trim() || null,
        note: note?.trim() || null,
        number: number?.trim() || null,
        issued_at: now,
        returned_at: null,
      },
      { onConflict: "athlete_id,item_id" }
    );
  return error ? { error: error.message } : { ok: true };
}

const itemTransition: Record<EquipmentItemState, EquipmentItemState[]> = {
  missing: ["missing", "issued"],
  issued: ["issued", "returned", "lost", "damaged"],
  returned: ["returned", "issued"],
  lost: ["lost", "issued"],
  damaged: ["damaged", "issued"],
};

export async function transitionItemAssignment(
  supabase: Supabase,
  orgId: string,
  athleteId: string,
  itemId: string,
  state: EquipmentItemState,
  note?: string | null
): Promise<{ ok: true } | { error: string }> {
  const { data: existing, error: readError } = await supabase
    .from("athlete_item_assignments")
    .select("*")
    .eq("organization_id", orgId)
    .eq("athlete_id", athleteId)
    .eq("item_id", itemId)
    .maybeSingle();
  if (readError) return { error: readError.message };
  const current = existing?.state ?? "missing";
  if (!itemTransition[current].includes(state)) {
    return { error: `Invalid equipment transition: ${current} -> ${state}` };
  }
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("athlete_item_assignments")
    .upsert(
      {
        organization_id: orgId,
        athlete_id: athleteId,
        item_id: itemId,
        state,
        issued_at: state === "issued" ? now : existing?.issued_at ?? null,
        returned_at:
          state === "returned" ? now : state === "issued" ? null : existing?.returned_at ?? null,
        note: note?.trim() || existing?.note || null,
      },
      { onConflict: "athlete_id,item_id" }
    );
  return error ? { error: error.message } : { ok: true };
}

export async function deleteItemAssignment(
  supabase: Supabase,
  orgId: string,
  athleteId: string,
  itemId: string
): Promise<{ ok: true } | { error: string }> {
  const { error } = await supabase
    .from("athlete_item_assignments")
    .delete()
    .eq("organization_id", orgId)
    .eq("athlete_id", athleteId)
    .eq("item_id", itemId);
  return error ? { error: error.message } : { ok: true };
}

export interface EquipmentPlayerRow {
  athlete_id: string;
  first_name: string;
  last_name: string;
  club_athlete_number: number;
  jersey_number: number | null;
  jersey_name: string | null;
  assignments: Array<{ item: EquipmentItem; assignment: AthleteItemAssignment | null }>;
  issuedCount: number;
  missingCount: number;
  lostDamagedCount: number;
}

/**
 * Team-filtered player equipment list (scalable alternative to the old matrix).
 * Rows = active-season members of the selected team, each with every catalog
 * item + its assignment state.
 */
export async function getPlayerEquipmentByTeam(
  supabase: Supabase,
  orgId: string,
  teamId: string | undefined,
  seasonId: string
): Promise<EquipmentPlayerRow[]> {
  const [items, assignmentsRes, membershipsRes, athletesRes] = await Promise.all([
    listEquipmentItems(supabase, orgId),
    supabase
      .from("athlete_item_assignments")
      .select("*")
      .eq("organization_id", orgId),
    supabase
      .from("seasonal_memberships")
      .select("athlete_id, team_id, jersey_number, jersey_name")
      .eq("organization_id", orgId)
      .eq("season_id", seasonId)
      .eq("status", "active"),
    supabase
      .from("athletes")
      .select("id, first_name, last_name, club_athlete_number")
      .eq("organization_id", orgId)
      .order("last_name")
      .order("first_name"),
  ]);

  const assignments = (assignmentsRes.data ?? []) as AthleteItemAssignment[];
  const memberships = (membershipsRes.data ?? []) as Array<{
    athlete_id: string;
    team_id: string;
    jersey_number: number | null;
    jersey_name: string | null;
  }>;
  const athletes = (athletesRes.data ?? []) as Array<{
    id: string;
    first_name: string;
    last_name: string;
    club_athlete_number: number;
  }>;

  const memberIds = new Set(
    (teamId
      ? memberships.filter((m) => m.team_id === teamId)
      : memberships
    ).map((m) => m.athlete_id)
  );
  const membershipByAthlete = new Map(memberships.map((m) => [m.athlete_id, m]));
const assignmentByKey = new Map(
    assignments.map((a) => [`${a.athlete_id}:${a.item_id}`, a])
  );

  return athletes
    .filter((athlete) => memberIds.has(athlete.id))
    .map((athlete) => {
      const membership = membershipByAthlete.get(athlete.id);
      const rowAssignments = items.map((item) => ({
        item,
        assignment: assignmentByKey.get(`${athlete.id}:${item.id}`) ?? null,
      }));
      const issuedCount = rowAssignments.filter(
        (a) => a.assignment?.state === "issued"
      ).length;
      const missingCount = rowAssignments.filter(
        (a) => !a.assignment || a.assignment.state === "missing" || a.assignment.state === "returned"
      ).length;
      const lostDamagedCount = rowAssignments.filter(
        (a) => a.assignment?.state === "lost" || a.assignment?.state === "damaged"
      ).length;
      return {
        athlete_id: athlete.id,
        first_name: athlete.first_name,
        last_name: athlete.last_name,
        club_athlete_number: athlete.club_athlete_number,
        jersey_number: membership?.jersey_number ?? null,
        jersey_name: membership?.jersey_name ?? null,
        assignments: rowAssignments,
        issuedCount,
        missingCount,
        lostDamagedCount,
      };
    });
}
