"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { hasPermission, requireOrganization } from "@/lib/organization";
import { createServerClient } from "@/lib/supabase/server";
import {
  createEquipmentRequest,
  createEquipmentType,
  createTeamEquipment,
  decideEquipmentRequest,
  deleteTeamEquipment,
  setAthleteSize,
  setTeamEquipmentRequirements,
  toggleEquipmentType,
  transitionAthleteItem,
  updateTeamEquipment,
} from "@/lib/equipment";
import type { EquipmentItemState, EquipmentRequestStatus } from "@/types/database";

const id = z.string().uuid();
const state = z.enum(["missing", "issued", "returned", "lost", "damaged"]);
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

export async function setAthleteSizeAction(formData: FormData) {
  const { org, supabase } = await requireEquipmentPermission("equipment.report");
  const athleteId = id.parse(text(formData, "athlete_id"));
  const typeId = id.parse(text(formData, "equipment_type_id"));
  const sizeValue = text(formData, "size_value_custom") || text(formData, "size_value_preset") || null;
  const sizeValueUpper = text(formData, "size_value_upper_custom") || text(formData, "size_value_upper_preset") || null;
  const result = await setAthleteSize(supabase, org.organizationId, athleteId, typeId, sizeValue, sizeValueUpper);
  if ("error" in result) throw new Error(result.error);
  refreshEquipment();
}

export async function transitionAthleteItemAction(formData: FormData) {
  const { org, supabase } = await requireEquipmentPermission("equipment.report");
  const athleteId = id.parse(text(formData, "athlete_id"));
  const typeId = id.parse(text(formData, "equipment_type_id"));
  const nextState = state.parse(text(formData, "state"));
  const result = await transitionAthleteItem(supabase, org.organizationId, athleteId, typeId, nextState, text(formData, "note") || null);
  if ("error" in result) throw new Error(result.error);
  refreshEquipment();
}

export async function createEquipmentTypeAction(formData: FormData) {
  const { org, supabase } = await requireEquipmentPermission("equipment.manage");
  const name = z.string().min(1).max(80).parse(text(formData, "name"));
  const sizeModel = z.enum(["single", "upper_lower"]).parse(text(formData, "size_model"));
  const result = await createEquipmentType(supabase, org.organizationId, name, sizeModel, text(formData, "is_club_property") === "true");
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
  const typeIds = formData.getAll("equipment_type_id").filter((value): value is string => typeof value === "string").map((value) => id.parse(value));
  const result = await setTeamEquipmentRequirements(supabase, org.organizationId, teamId, typeIds);
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
