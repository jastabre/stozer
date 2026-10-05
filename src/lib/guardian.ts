import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

type Supabase = SupabaseClient<Database>;

export type PreferredContact = "phone" | "email";

/**
 * Resolve the stored preferred-contact so it always matches a channel the
 * guardian actually has: a preference for a cleared channel falls back to the
 * other, and a lone channel becomes the preference automatically. Returns null
 * when there is no channel at all.
 */
export function resolvePreferredContact(
  preferred: PreferredContact | null,
  hasPhone: boolean,
  hasEmail: boolean
): PreferredContact | null {
  if (preferred === "email" && !hasEmail) return hasPhone ? "phone" : null;
  if (preferred === "phone" && !hasPhone) return hasEmail ? "email" : null;
  if (!preferred) {
    if (hasPhone && !hasEmail) return "phone";
    if (hasEmail && !hasPhone) return "email";
  }
  return preferred;
}

/** At least one real contact channel must exist for a guardian (V1 rule). */
export function hasContactChannel(phone: string | null | undefined, email: string | null | undefined): boolean {
  return Boolean(phone?.trim()) || Boolean(email?.trim());
}

export interface RelationshipOption {
  value: string;
  label: string;
}

/**
 * Relationship options for a guardian form. New guardians see only the standard
 * options (Otac / Majka / Staratelj). When editing a guardian whose stored
 * relationship is a legacy free-text value (e.g. "baka"), that exact value is
 * appended as an extra option so an unrelated edit (phone/email) never forces
 * the user to change it — they may still switch to a standard option, and the
 * legacy value is preserved untouched otherwise.
 */
export function relationshipOptionsFor(
  standard: RelationshipOption[],
  current?: string | null
): RelationshipOption[] {
  const value = current?.trim();
  if (!value || standard.some((option) => option.value === value)) return standard;
  return [...standard, { value, label: value }];
}

/**
 * Whether the "Staratelji" tab should be visible: a permission to manage/view
 * guardians, and either the athlete is a minor or guardian records already
 * exist. Never keyed on team category.
 */
export function shouldShowGuardiansTab(args: {
  canView: boolean;
  isMinor: boolean;
  guardianCount: number;
}): boolean {
  return args.canView && (args.isMinor || args.guardianCount > 0);
}

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
  // WR-05: verify the athlete belongs to this org before replacing the
  // guardian set — otherwise the inserts would reference a foreign parent
  // (now rejected by the composite org FK).
  const { data: athlete, error: athleteError } = await supabase
    .from("athletes")
    .select("id")
    .eq("id", athleteId)
    .eq("organization_id", orgId)
    .maybeSingle();
  if (athleteError || !athlete) {
    return { error: "Igrač nije pronađen u organizaciji" };
  }

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

/**
 * Add or edit a single guardian against the live set — never a destructive
 * replace-all, so untouched guardians (and their timestamps) are preserved.
 *
 * Guarantees the "at most one primary" invariant directly: if this guardian is
 * marked primary (or is the athlete's only guardian), every other guardian is
 * demoted first, so the DB partial-unique index can never be violated. This is
 * the "one tap makes the new guardian primary, old one drops automatically"
 * behavior; the index remains the backstop.
 */
export async function setGuardian(
  supabase: Supabase,
  orgId: string,
  athleteId: string,
  guardian: GuardianInput
): Promise<{ ok: true } | { error: string }> {
  const { count } = await supabase
    .from("guardians")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", orgId)
    .eq("athlete_id", athleteId);
  const isOnlyGuardian = (count ?? 0) === 0 && !guardian.id;
  const makePrimary = guardian.is_primary || isOnlyGuardian;

  const payload = {
    organization_id: orgId,
    athlete_id: athleteId,
    full_name: guardian.full_name,
    relationship: guardian.relationship,
    phone: guardian.phone,
    email: guardian.email,
    preferred_contact: guardian.preferred_contact,
    is_primary: makePrimary,
  };

  let error: { message: string } | null;
  if (guardian.id) {
    ({ error } = await supabase
      .from("guardians")
      .update(payload)
      .eq("id", guardian.id)
      .eq("organization_id", orgId)
      .eq("athlete_id", athleteId));
  } else {
    ({ error } = await supabase.from("guardians").insert(payload));
  }
  if (error) return { error: error.message };

  if (makePrimary) {
    const demote = supabase
      .from("guardians")
      .update({ is_primary: false })
      .eq("organization_id", orgId)
      .eq("athlete_id", athleteId)
      .eq("is_primary", true);
    if (guardian.id) {
      await demote.neq("id", guardian.id);
    } else {
      const { data: created } = await supabase
        .from("guardians")
        .select("id")
        .eq("organization_id", orgId)
        .eq("athlete_id", athleteId)
        .eq("is_primary", true)
        .order("created_at", { ascending: false })
        .limit(1);
      const newId = created?.[0]?.id;
      if (newId) await demote.neq("id", newId);
    }
  }
  return { ok: true };
}

/**
 * Remove a single guardian without re-running the primary normalizer. Deleting a
 * guardian must never silently promote another one to primary — the remaining
 * guardians stay as they were until the user explicitly picks a new primary.
 * Scoped by athlete + org so a foreign id can't be targeted.
 */
export async function removeGuardian(
  supabase: Supabase,
  orgId: string,
  athleteId: string,
  guardianId: string
): Promise<{ ok: true } | { error: string }> {
  const { error } = await supabase
    .from("guardians")
    .delete()
    .eq("organization_id", orgId)
    .eq("athlete_id", athleteId)
    .eq("id", guardianId);
  return error ? { error: error.message } : { ok: true };
}
