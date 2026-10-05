"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { hasPermission, requireOrganization } from "@/lib/organization";
import { createServerClient } from "@/lib/supabase/server";
import { createVenue, updateVenue } from "@/lib/venue";

const venueTypeSchema = z.enum(["field", "hall", "balloon", "other"]);

function text(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

async function requireVenueManage() {
  const org = await requireOrganization();
  if (!(await hasPermission("venue.manage"))) {
    throw new Error("Nemate dozvolu za upravljanje terenima");
  }
  return { org, supabase: await createServerClient() };
}

function refreshFacilities() {
  revalidatePath("/club/facilities");
}

export async function createVenueAction(formData: FormData) {
  const { org, supabase } = await requireVenueManage();
  const name = z.string().min(1).max(120).parse(text(formData, "name"));
  const venueType = venueTypeSchema.parse(text(formData, "venue_type"));
  const result = await createVenue(supabase, org.organizationId, {
    name,
    venueType,
    address: text(formData, "address") || null,
    note: text(formData, "note") || null,
  });
  if ("error" in result) throw new Error(result.error);
  refreshFacilities();
}

export async function updateVenueAction(formData: FormData) {
  const { org, supabase } = await requireVenueManage();
  const id = z.string().uuid().parse(text(formData, "venue_id"));
  const name = z.string().min(1).max(120).parse(text(formData, "name"));
  const venueType = venueTypeSchema.parse(text(formData, "venue_type"));
  const isActive = text(formData, "is_active") === "true";
  const result = await updateVenue(supabase, org.organizationId, id, {
    name,
    venueType,
    address: text(formData, "address") || null,
    note: text(formData, "note") || null,
    isActive,
  });
  if ("error" in result) throw new Error(result.error);
  refreshFacilities();
}
