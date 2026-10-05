"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { hasPermission, requireOrganization } from "@/lib/organization";
import { createServerClient } from "@/lib/supabase/server";
import {
  createEquipmentItem,
  createEquipmentRequest,
  createEquipmentType,
  createTeamEquipment,
  decideEquipmentRequest,
  deleteEquipmentItem,
  deleteItemAssignment,
  deleteTeamEquipment,
  issueItemToAthlete,
  itemUsesNumber,
  savePlayerSizes,
  setTeamEquipmentRequirements,
  toggleEquipmentType,
  transitionItemAssignment,
  updateEquipmentItem,
  updateTeamEquipment,
} from "@/lib/equipment";
import type { EquipmentItemState, EquipmentRequestStatus } from "@/types/database";

const id = z.string().uuid();
const state = z.enum(["missing", "issued", "returned", "lost", "damaged"]);
const sizeModeSchema = z.enum(["none", "single", "split"]);
const requestStatus = z.enum(["requested", "approved", "purchased", "rejected"]);

function text(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

async function requireEquipmentPermission(permission: "equipment.report" | "equipment.manage") {
  const org = await requireOrganization();
  if (!(await hasPermission(permission))) throw new Error("Nemate dozvolu za upravljanje opremom");
  return { org, supabase: await createServerClient() };
}

function refreshEquipment() {
  revalidatePath("/equipment");
  revalidatePath("/players", "layout");
}

/** Resolve a size field: custom value wins, "__custom__" sentinel = no size. */
function sizeValue(formData: FormData, name: string): string | null {
  const custom = text(formData, `${name}_custom`);
  if (custom) return custom;
  const preset = text(formData, `${name}_preset`);
  return preset && preset !== "__custom__" ? preset : null;
}

export async function createEquipmentTypeAction(formData: FormData) {
  const { org, supabase } = await requireEquipmentPermission("equipment.manage");
  const name = z.string().min(1).max(80).parse(text(formData, "name"));
  const sizeModel = z.enum(["single", "upper_lower"]).parse(text(formData, "size_model"));
  const result = await createEquipmentType(supabase, org.organizationId, name, sizeModel, text(formData, "is_club_property") === "true");
  if ("error" in result) throw new Error(result.error);
  refreshEquipment();
}

/**
 * Save all player clothing-piece sizes in one action. Every submitted piece is
 * written, including explicit nulls, so clearing a size on the profile really
 * removes the stored value.
 */
export async function savePlayerSizesAction(formData: FormData) {
  const { org, supabase } = await requireEquipmentPermission("equipment.report");
  const athleteId = id.parse(text(formData, "athlete_id"));
  const sizes: Record<string, string | null> = {};
  const typeIds = new Set<string>();
  for (const [key, value] of formData.entries()) {
    if (key.startsWith("size_") && typeof value === "string") {
      const rest = key.slice(5);
      const idx = rest.lastIndexOf("_");
      if (idx <= 0) continue;
      const typeId = rest.slice(0, idx);
      const kind = rest.slice(idx + 1);
      if (!typeId || !kind) continue;
      typeIds.add(typeId);
      if (kind === "custom" && value) sizes[typeId] = value;
      else if (kind === "preset" && value && value !== "__custom__") sizes[typeId] = value;
    }
  }
  for (const typeId of typeIds) {
    if (!(typeId in sizes)) sizes[typeId] = null;
  }
  const result = await savePlayerSizes(supabase, org.organizationId, athleteId, sizes);
  if ("error" in result) throw new Error(result.error);
  revalidatePath(`/players/${athleteId}`);
}

/** Create a club equipment catalog item with its size mode + numbering. */
export async function createEquipmentItemAction(formData: FormData) {
  const { org, supabase } = await requireEquipmentPermission("equipment.manage");
  const name = z.string().min(1).max(120).parse(text(formData, "name"));
  const sizeMode = sizeModeSchema.parse(text(formData, "size_mode"));
  const result = await createEquipmentItem(
    supabase,
    org.organizationId,
    name,
    sizeMode,
    text(formData, "has_number") === "true"
  );
  if ("error" in result) throw new Error(result.error);
  refreshEquipment();
}

/** Update a catalog item (name, size mode, numbering). */
export async function updateEquipmentItemAction(formData: FormData) {
  const { org, supabase } = await requireEquipmentPermission("equipment.manage");
  const itemId = id.parse(text(formData, "item_id"));
  const name = z.string().min(1).max(120).parse(text(formData, "name"));
  const sizeMode = sizeModeSchema.parse(text(formData, "size_mode"));
  const result = await updateEquipmentItem(supabase, org.organizationId, itemId, {
    name,
    sizeMode,
    hasNumber: text(formData, "has_number") === "true",
  });
  if ("error" in result) throw new Error(result.error);
  refreshEquipment();
}

export async function deleteEquipmentItemAction(formData: FormData) {
  const { org, supabase } = await requireEquipmentPermission("equipment.manage");
  const itemId = id.parse(text(formData, "item_id"));
  const result = await deleteEquipmentItem(supabase, org.organizationId, itemId);
  // Returned (not thrown) so the guarded message reaches the user verbatim.
  if ("error" in result) return { error: result.error };
  refreshEquipment();
  return { ok: true };
}

/** Issue a catalog item to a player (sizes chosen at issue time). */
export async function issueItemAction(formData: FormData) {
  const { org, supabase } = await requireEquipmentPermission("equipment.report");
  const athleteId = id.parse(text(formData, "athlete_id"));
  const itemId = id.parse(text(formData, "item_id"));
  const sizeTop = sizeValue(formData, "size_top");
  const sizeBottom = sizeValue(formData, "size_bottom");
  const note = text(formData, "note") || null;
  const number = (await itemUsesNumber(supabase, org.organizationId, itemId))
    ? text(formData, "number") || null
    : null;
  const result = await issueItemToAthlete(
    supabase,
    org.organizationId,
    athleteId,
    itemId,
    sizeTop,
    sizeBottom,
    note,
    number
  );
  if ("error" in result) throw new Error(result.error);
  refreshEquipment();
}

export async function transitionItemAction(formData: FormData) {
  const { org, supabase } = await requireEquipmentPermission("equipment.report");
  const athleteId = id.parse(text(formData, "athlete_id"));
  const itemId = id.parse(text(formData, "item_id"));
  const nextState = state.parse(text(formData, "state"));
  const result = await transitionItemAssignment(supabase, org.organizationId, athleteId, itemId, nextState, text(formData, "note") || null);
  if ("error" in result) throw new Error(result.error);
  refreshEquipment();
}

export async function deleteItemAssignmentAction(formData: FormData) {
  const { org, supabase } = await requireEquipmentPermission("equipment.manage");
  const athleteId = id.parse(text(formData, "athlete_id"));
  const itemId = id.parse(text(formData, "item_id"));
  const result = await deleteItemAssignment(supabase, org.organizationId, athleteId, itemId);
  if ("error" in result) throw new Error(result.error);
  refreshEquipment();
}

export async function toggleEquipmentTypeAction(formData: FormData) {
  const { org, supabase } = await requireEquipmentPermission("equipment.manage");
  const typeId = id.parse(text(formData, "equipment_type_id"));
  const enabled = text(formData, "enabled") === "true";
  const result = await toggleEquipmentType(supabase, org.organizationId, typeId, enabled);
  if ("error" in result) throw new Error(result.error);
  refreshEquipment();
}

export async function saveTeamRequirementsAction(formData: FormData) {
  const { org, supabase } = await requireEquipmentPermission("equipment.manage");
  const teamId = id.parse(text(formData, "team_id"));
  const itemIds = formData.getAll("item_id").filter((value): value is string => typeof value === "string").map((value) => id.parse(value));
  const result = await setTeamEquipmentRequirements(supabase, org.organizationId, teamId, itemIds);
  if ("error" in result) throw new Error(result.error);
  refreshEquipment();
}

function teamEquipmentInput(formData: FormData) {
  return {
    team_id: text(formData, "team_id") || null,
    responsible_staff_id: text(formData, "responsible_staff_id") || null,
    item_name: z.string().min(1).max(120).parse(text(formData, "item_name")),
    quantity: z.coerce.number().int().min(0).max(9999).parse(text(formData, "quantity")),
    state: state.parse(text(formData, "state")) as EquipmentItemState,
    note: text(formData, "note") || null,
  };
}

export async function createTeamEquipmentAction(formData: FormData) {
  const { org, supabase } = await requireEquipmentPermission("equipment.manage");
  const activeSeasonId = text(formData, "season_id");
  const result = await createTeamEquipment(supabase, org.organizationId, { ...teamEquipmentInput(formData), season_id: activeSeasonId || null });
  if ("error" in result) throw new Error(result.error);
  refreshEquipment();
}

export async function updateTeamEquipmentAction(formData: FormData) {
  const { org, supabase } = await requireEquipmentPermission("equipment.manage");
  const equipmentId = id.parse(text(formData, "equipment_id"));
  const result = await updateTeamEquipment(supabase, org.organizationId, equipmentId, teamEquipmentInput(formData));
  if ("error" in result) throw new Error(result.error);
  refreshEquipment();
}

export async function deleteTeamEquipmentAction(formData: FormData) {
  const { org, supabase } = await requireEquipmentPermission("equipment.manage");
  const equipmentId = id.parse(text(formData, "equipment_id"));
  const result = await deleteTeamEquipment(supabase, org.organizationId, equipmentId);
  if ("error" in result) throw new Error(result.error);
  refreshEquipment();
}

export async function createEquipmentRequestAction(formData: FormData) {
  const { org, supabase } = await requireEquipmentPermission("equipment.report");
  const teamId = text(formData, "team_id");
  const { data: requester } = await supabase
    .from("staff")
    .select("id")
    .eq("organization_id", org.organizationId)
    .eq("user_id", org.userId)
    .maybeSingle();
  if (!requester) throw new Error("Povežite svoj nalog sa profilom osoblja pre slanja zahteva");
  const result = await createEquipmentRequest(supabase, org.organizationId, {
    team_id: teamId ? id.parse(teamId) : null,
    item_name: z.string().min(1).max(120).parse(text(formData, "item_name")),
    quantity: z.coerce.number().int().min(1).max(9999).parse(text(formData, "quantity")),
    note: text(formData, "note") || null,
    requester_staff_id: requester.id,
  });
  if ("error" in result) throw new Error(result.error);
  refreshEquipment();
}

export async function decideEquipmentRequestAction(formData: FormData) {
  const { org, supabase } = await requireEquipmentPermission("equipment.manage");
  const requestId = id.parse(text(formData, "request_id"));
  const nextStatus = requestStatus.parse(text(formData, "status")) as EquipmentRequestStatus;
  const { data: staff } = await supabase.from("staff").select("id").eq("organization_id", org.organizationId).eq("user_id", org.userId).maybeSingle();
  if (!staff) throw new Error("Povežite svoj nalog sa profilom osoblja pre odlučivanja o zahtevima");
  const result = await decideEquipmentRequest(supabase, org.organizationId, requestId, nextStatus, staff.id);
  if ("error" in result) throw new Error(result.error);
  refreshEquipment();
}
