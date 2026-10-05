import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

type Supabase = SupabaseClient<Database>;

export type Venue = Database["public"]["Tables"]["venues"]["Row"];
export type VenueType = Database["public"]["Enums"]["venue_type"];

export const VENUE_TYPES: VenueType[] = ["field", "hall", "balloon", "other"];

export interface VenueInput {
  name: string;
  venueType: VenueType;
  address: string | null;
  note: string | null;
}

export interface VenuePatch extends VenueInput {
  isActive: boolean;
}

export async function listVenues(supabase: Supabase, orgId: string): Promise<Venue[]> {
  const { data, error } = await supabase
    .from("venues")
    .select("*")
    .eq("organization_id", orgId)
    .order("name");
  return error ? [] : ((data ?? []) as Venue[]);
}

export async function createVenue(
  supabase: Supabase,
  orgId: string,
  input: VenueInput
): Promise<{ ok: true } | { error: string }> {
  const { error } = await supabase.from("venues").insert({
    organization_id: orgId,
    name: input.name.trim(),
    venue_type: input.venueType,
    address: input.address?.trim() || null,
    note: input.note?.trim() || null,
  });
  return error ? { error: error.message } : { ok: true };
}

export async function updateVenue(
  supabase: Supabase,
  orgId: string,
  id: string,
  input: VenuePatch
): Promise<{ ok: true } | { error: string }> {
  const { error } = await supabase
    .from("venues")
    .update({
      name: input.name.trim(),
      venue_type: input.venueType,
      address: input.address?.trim() || null,
      note: input.note?.trim() || null,
      is_active: input.isActive,
    })
    .eq("id", id)
    .eq("organization_id", orgId);
  return error ? { error: error.message } : { ok: true };
}
