import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

type Supabase = SupabaseClient<Database>;

export type PreferredContact = "phone" | "email" | "sms" | "other";

export interface GuardianInput {
  id?: string;
  athlete_id?: string;
  full_name: string;
  relationship: string;
  phone: string | null;
  email: string | null;
  preferred_contact: PreferredContact | null;
  is_primary: boolean;
}

export interface Guardian extends GuardianInput {
  id: string;
  athlete_id: string;
  created_at: string;
  updated_at: string;
}

/**
 * Normalize an athlete's complete guardian payload so there is at most one
 * primary. If no row is marked primary, the first row becomes primary; an
 * empty set remains empty. When several rows are marked primary, the last one
 * wins, matching the user's most recent radio selection.
 */
export function normalizeGuardians(
  rows: GuardianInput[],
  athleteId?: string
): GuardianInput[] {
  if (rows.length === 0) return [];
  const primaryIndex = rows.findLastIndex((row) => row.is_primary);
  const selectedIndex = primaryIndex >= 0 ? primaryIndex : 0;
  return rows.map((row, index) => ({
    ...row,
    ...(athleteId ? { athlete_id: athleteId } : {}),
    is_primary: index === selectedIndex,
  }));
}

/** Merge changed rows into an existing set, then apply the primary invariant. */
export function normalizeGuardianPrimary(
  athleteId: string,
  existing: GuardianInput[],
  changes: GuardianInput[]
): GuardianInput[] {
  const merged = existing.map((row) => ({ ...row }));
  for (const change of changes) {
    const index = change.id ? merged.findIndex((row) => row.id === change.id) : -1;
    if (index >= 0) merged[index] = { ...merged[index], ...change };
    else merged.push({ ...change });
  }
  return normalizeGuardians(merged, athleteId);
}

export async function listGuardians(
  supabase: Supabase,
  orgId: string,
  athleteId: string
): Promise<Guardian[]> {
  const { data, error } = await supabase
    .from("guardians")
    .select("*")
    .eq("organization_id", orgId)
    .eq("athlete_id", athleteId)
    .order("is_primary", { ascending: false })
    .order("full_name");
  if (error) return [];
  return (data ?? []) as Guardian[];
}

/**
 * Replace the athlete's guardian set. The pure normalizer runs immediately
 * before the insert, while the partial unique index remains the DB backstop.
 */
export async function updateGuardians(
  supabase: Supabase,
  orgId: string,
  athleteId: string,
  rows: GuardianInput[]
): Promise<{ ok: true } | { error: string }> {
  const normalized = normalizeGuardians(rows, athleteId);
  const { error: deleteError } = await supabase
    .from("guardians")
    .delete()
    .eq("organization_id", orgId)
    .eq("athlete_id", athleteId);
  if (deleteError) return { error: deleteError.message };

  if (normalized.length === 0) return { ok: true };
  const { error: insertError } = await supabase.from("guardians").insert(
    normalized.map((row) => ({
      organization_id: orgId,
      athlete_id: athleteId,
      full_name: row.full_name,
      relationship: row.relationship,
      phone: row.phone,
      email: row.email,
      preferred_contact: row.preferred_contact,
      is_primary: row.is_primary,
    }))
  );
  return insertError ? { error: insertError.message } : { ok: true };
}
