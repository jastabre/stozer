import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { AppRole, Database } from "@/types/database";
import { ACCESS_ROLES, isTeamScopedRole } from "@/lib/roles";
import { deriveAccountStatus, type AccountStatus } from "@/lib/account-status";

export interface OrgUser {
  userId: string;
  email: string;
  role: AppRole;
  staffId: string | null;
  staffName: string | null;
  teamIds: string[];
  teamNames: string[];
  status: AccountStatus;
  isSelf: boolean;
}

export interface LinkableStaffFunction {
  function_key: string;
  custom_label: string | null;
}

export interface LinkableStaff {
  id: string;
  name: string;
  title: string | null;
  email: string | null;
  /** Club functions (read-only hint; never mapped to a Stožer role). */
  functions: LinkableStaffFunction[];
}

/** Whether the given user is a club president of the organization. */
export async function isClubPresident(
  orgId: string,
  userId: string
): Promise<boolean> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("organization_memberships")
    .select("id")
    .eq("organization_id", orgId)
    .eq("user_id", userId)
    .eq("role", "club_president")
    .maybeSingle();
  return data != null;
}

type AdminClient = SupabaseClient<Database>;

function createAdminClient(): AdminClient {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!serviceKey || !url) {
    throw new Error("Admin klijent nije konfigurisan");
  }
  return createClient<Database>(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/** GoTrue errors are technical; every user-facing message must be readable. */
function humanizeInviteError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("already") && lower.includes("registered")) {
    return "Korisnik sa ovim emailom je već registrovan.";
  }
  if (lower.includes("rate limit") || lower.includes("security purposes")) {
    return "Previše zahteva za kratko vreme. Pokušajte ponovo kasnije.";
  }
  if (lower.includes("invalid") && lower.includes("email")) {
    return "Email adresa nije validna.";
  }
  if (lower.includes("smtp") || lower.includes("sending") || lower.includes("email")) {
    return "Slanje poziva nije uspelo. Proverite email adresu ili pokušajte kasnije.";
  }
  return "Slanje poziva nije uspelo. Pokušajte ponovo.";
}

function accountIsConfirmed(user: {
  email_confirmed_at?: string | null;
  confirmed_at?: string | null;
  last_sign_in_at?: string | null;
}): boolean {
  return Boolean(
    user.email_confirmed_at || user.confirmed_at || user.last_sign_in_at
  );
}

/**
 * Count staff profiles that are linked to an app account but have NO
 * organization_memberships row (and therefore no assigned role/access). A
 * profile without a linked account is intentionally NOT counted — that is a
 * valid personnel record, not an access error.
 */
export async function countLinkedStaffWithoutMembership(
  orgId: string
): Promise<number> {
  const admin = createAdminClient();
  const [memberships, staff] = await Promise.all([
    admin
      .from("organization_memberships")
      .select("user_id")
      .eq("organization_id", orgId),
    admin
      .from("staff")
      .select("user_id")
      .eq("organization_id", orgId)
      .not("user_id", "is", null),
  ]);
  const memberIds = new Set((memberships.data ?? []).map((m) => m.user_id));
  return (staff.data ?? []).filter((s) => s.user_id && !memberIds.has(s.user_id))
    .length;
}

/**
 * List every application user of an organization with their role, linked staff
 * profile (name), current-season team assignments and real account status.
 * Membership rows and emails are read through the service-role client because
 * organization_memberships.membership_select only exposes the caller's own row.
 */
export async function listOrgUsers(
  orgId: string,
  currentUserId: string
): Promise<OrgUser[]> {
  const admin = createAdminClient();

  const [memberships, staffRows, usersResp, season, teams] = await Promise.all([
    admin
      .from("organization_memberships")
      .select("user_id, role")
      .eq("organization_id", orgId),
    admin
      .from("staff")
      .select("id, first_name, last_name, user_id, role")
      .eq("organization_id", orgId),
    admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    admin
      .from("seasons")
      .select("id")
      .eq("organization_id", orgId)
      .eq("is_active", true)
      .maybeSingle(),
    admin
      .from("teams")
      .select("id, name")
      .eq("organization_id", orgId)
      .order("name"),
  ]);

  const seasonId = season.data?.id ?? null;
  const staffTeams = seasonId
    ? await admin
        .from("staff_teams")
        .select("staff_id, team_id")
        .eq("organization_id", orgId)
        .eq("season_id", seasonId)
    : { data: [] };

  const accountByUserId = new Map(
    (usersResp.data?.users ?? []).map((u) => [u.id, u])
  );
  const staffByUserId = new Map(
    (staffRows.data ?? []).map((s) => [s.user_id, s])
  );
  const teamById = new Map((teams.data ?? []).map((t) => [t.id, t.name]));
  const teamIdsByStaff = new Map<string, string[]>();
  for (const row of staffTeams.data ?? []) {
    const arr = teamIdsByStaff.get(row.staff_id) ?? [];
    arr.push(row.team_id);
    teamIdsByStaff.set(row.staff_id, arr);
  }

  return (memberships.data ?? []).map((m) => {
    const staff = staffByUserId.get(m.user_id);
    const staffTeamIds = staff ? teamIdsByStaff.get(staff.id) ?? [] : [];
    const account = accountByUserId.get(m.user_id);
    return {
      userId: m.user_id,
      email: account?.email ?? "—",
      role: m.role,
      staffId: staff?.id ?? null,
      staffName: staff ? `${staff.last_name} ${staff.first_name}`.trim() : null,
      teamIds: staffTeamIds,
      teamNames: staffTeamIds.map((id) => teamById.get(id) ?? "?"),
      status: deriveAccountStatus(account),
      isSelf: m.user_id === currentUserId,
    };
  });
}

/** Staff profiles in the org that do not have a Stožer account yet. */
export async function listLinkableStaff(orgId: string): Promise<LinkableStaff[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("staff")
    .select("id, first_name, last_name, title, email")
    .eq("organization_id", orgId)
    .is("user_id", null)
    .order("last_name")
    .order("first_name");

  const staffIds = (data ?? []).map((row) => row.id);
  const { data: functions } =
    staffIds.length > 0
      ? await admin
          .from("staff_functions")
          .select("staff_id, function_key, custom_label")
          .eq("organization_id", orgId)
          .in("staff_id", staffIds)
          .order("created_at")
      : { data: [] };

  const functionsByStaff = new Map<string, LinkableStaffFunction[]>();
  for (const row of functions ?? []) {
    const list = functionsByStaff.get(row.staff_id) ?? [];
    list.push({
      function_key: row.function_key,
      custom_label: row.custom_label,
    });
    functionsByStaff.set(row.staff_id, list);
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    name: `${row.last_name} ${row.first_name}`.trim(),
    title: row.title,
    email: row.email,
    functions: functionsByStaff.get(row.id) ?? [],
  }));
}

export interface AccountOverview {
  userId: string;
  email: string;
  status: AccountStatus;
}

/**
 * Live account of one user (used by the staff profile shell). Read-only and
 * best-effort: a missing admin key degrades to "no status shown" instead of
 * taking down the whole profile.
 */
export async function getAccountOverview(
  userId: string
): Promise<AccountOverview | null> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.auth.admin.getUserById(userId);
    if (error || !data.user) return null;
    return {
      userId,
      email: data.user.email ?? "",
      status: deriveAccountStatus(data.user),
    };
  } catch {
    return null;
  }
}

/** Status/email of every auth account, keyed by user id (staff list view). */
export async function listAllAccountOverviews(): Promise<
  Map<string, AccountOverview>
> {
  const map = new Map<string, AccountOverview>();
  try {
    const admin = createAdminClient();
    const { data } = await admin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    for (const user of data?.users ?? []) {
      map.set(user.id, {
        userId: user.id,
        email: user.email ?? "",
        status: deriveAccountStatus(user),
      });
    }
  } catch {
    // Best-effort read: the staff list renders without account status.
  }
  return map;
}

export interface AddOrgAccountInput {
  staffId: string;
  email: string;
  role: AppRole;
  teamIds: string[];
  seasonId: string | null;
  /** Where the invitation email should return to (app origin + /verify). */
  redirectTo?: string;
}

export type AddOrgAccountResult =
  | { ok: true; status: Exclude<AccountStatus, "none"> }
  | { error: string };

async function replaceStaffTeams(
  admin: AdminClient,
  orgId: string,
  staffId: string,
  seasonId: string,
  teamIds: string[]
): Promise<{ ok: true } | { error: string }> {
  const uniqueTeamIds = [...new Set(teamIds)];
  if (uniqueTeamIds.length > 0) {
    const { data: teams, error } = await admin
      .from("teams")
      .select("id")
      .eq("organization_id", orgId)
      .in("id", uniqueTeamIds);
    if (error || !teams || teams.length !== uniqueTeamIds.length) {
      return { error: "Jedan od timova nije pronađen u klubu" };
    }
  }

  const { error: deleteError } = await admin
    .from("staff_teams")
    .delete()
    .eq("organization_id", orgId)
    .eq("staff_id", staffId)
    .eq("season_id", seasonId);
  if (deleteError) return { error: deleteError.message };

  if (uniqueTeamIds.length === 0) return { ok: true };
  const { error: insertError } = await admin.from("staff_teams").insert(
    uniqueTeamIds.map((teamId) => ({
      organization_id: orgId,
      staff_id: staffId,
      team_id: teamId,
      season_id: seasonId,
    }))
  );
  return insertError ? { error: insertError.message } : { ok: true };
}

/**
 * Add (or finish adding) a Stožer account for a staff person.
 *
 * The email decides what happens, without asking the user:
 *   - an existing, confirmed account is linked;
 *   - an existing, unconfirmed account gets a fresh invitation;
 *   - an unknown email gets an invitation.
 *
 * Conflicts (another club, another staff profile, an account already linked in
 * this club) fail with a human-readable message before anything is written.
 */
export async function addOrgAccount(
  orgId: string,
  input: AddOrgAccountInput
): Promise<AddOrgAccountResult> {
  if (!ACCESS_ROLES.includes(input.role)) {
    return { error: "Izabrana uloga nije dostupna" };
  }

  const admin = createAdminClient();
  const email = input.email.trim().toLowerCase();

  const { data: staff, error: staffError } = await admin
    .from("staff")
    .select("id, user_id")
    .eq("id", input.staffId)
    .eq("organization_id", orgId)
    .maybeSingle();
  if (staffError || !staff) {
    return { error: "Osoba nije pronađena u klubu" };
  }
  if (staff.user_id) {
    return { error: "Ova osoba već ima Stožer nalog." };
  }

  const { data: usersData, error: usersError } =
    await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (usersError) {
    return { error: "Nije moguće proveriti korisničke naloge. Pokušajte ponovo." };
  }
  let account = usersData.users.find(
    (candidate) => candidate.email?.toLowerCase() === email
  );

  if (account) {
    const { data: memberships, error: membershipError } = await admin
      .from("organization_memberships")
      .select("organization_id")
      .eq("user_id", account.id);
    if (membershipError) {
      return { error: "Nije moguće proveriti članstvo naloga." };
    }
    const foreignMembership = (memberships ?? []).find(
      (membership) => membership.organization_id !== orgId
    );
    if (foreignMembership) {
      return { error: "Ovaj email je već povezan sa drugim klubom." };
    }

    const { data: foreignStaff, error: foreignStaffError } = await admin
      .from("staff")
      .select("id")
      .eq("user_id", account.id)
      .neq("organization_id", orgId);
    if (foreignStaffError) {
      return { error: "Nije moguće proveriti povezanost profila." };
    }
    if (foreignStaff && foreignStaff.length > 0) {
      return { error: "Ovaj email je već povezan sa drugim klubom." };
    }

    const { data: sameOrgStaff, error: sameOrgStaffError } = await admin
      .from("staff")
      .select("id")
      .eq("organization_id", orgId)
      .eq("user_id", account.id)
      .neq("id", input.staffId);
    if (sameOrgStaffError) {
      return { error: "Nije moguće proveriti povezanost profila." };
    }
    if (sameOrgStaff && sameOrgStaff.length > 0) {
      return { error: "Ovaj korisnik već ima Stožer nalog u ovom klubu." };
    }

    // An existing account that never confirmed cannot sign in yet — send a
    // fresh invitation so accepting it also sets the password.
    if (!accountIsConfirmed(account)) {
      const { error: resendError } = await admin.auth.admin.inviteUserByEmail(
        email,
        { redirectTo: input.redirectTo }
      );
      if (resendError) {
        return { error: humanizeInviteError(resendError.message) };
      }
    }
  } else {
    const { data: invited, error: inviteError } =
      await admin.auth.admin.inviteUserByEmail(email, {
        redirectTo: input.redirectTo,
      });
    if (inviteError || !invited.user) {
      return {
        error: humanizeInviteError(inviteError?.message ?? "invite failed"),
      };
    }
    account = invited.user;
  }

  const { error: staffUpdateError } = await admin
    .from("staff")
    .update({ user_id: account.id, role: input.role })
    .eq("id", input.staffId)
    .eq("organization_id", orgId);
  if (staffUpdateError) {
    return { error: "Nije moguće povezati osobu sa nalogom. Pokušajte ponovo." };
  }

  const { error: membershipUpsertError } = await admin
    .from("organization_memberships")
    .upsert(
      { organization_id: orgId, user_id: account.id, role: input.role },
      { onConflict: "organization_id,user_id" }
    );
  if (membershipUpsertError) {
    await admin
      .from("staff")
      .update({ user_id: null, role: null })
      .eq("id", input.staffId)
      .eq("organization_id", orgId);
    return { error: "Nije moguće dodeliti ulogu nalogu. Pokušajte ponovo." };
  }

  if (input.seasonId && isTeamScopedRole(input.role)) {
    const teamsResult = await replaceStaffTeams(
      admin,
      orgId,
      input.staffId,
      input.seasonId,
      input.teamIds
    );
    if ("error" in teamsResult) return { error: teamsResult.error };
  }

  const { data: current, error: getUserError } =
    await admin.auth.admin.getUserById(account.id);
  if (getUserError || !current.user) {
    return { error: "Nalog je dodat, ali nije moguće osvežiti pristup." };
  }
  const { error: claimsError } = await admin.auth.admin.updateUserById(
    account.id,
    {
      app_metadata: {
        ...current.user.app_metadata,
        organization_id: orgId,
        user_role: input.role,
      },
    }
  );
  if (claimsError) {
    return { error: "Nalog je povezan, ali uloga nije aktivirana. Pokušajte ponovo." };
  }

  return { ok: true, status: accountIsConfirmed(account) ? "active" : "invited" };
}

/** Resend the invitation email for an account that never confirmed. */
export async function resendAccountInvite(
  orgId: string,
  userId: string,
  redirectTo?: string
): Promise<{ ok: true } | { error: string }> {
  const admin = createAdminClient();
  const { data: membership } = await admin
    .from("organization_memberships")
    .select("id")
    .eq("organization_id", orgId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!membership) return { error: "Korisnik nije član ovog kluba." };

  const { data, error } = await admin.auth.admin.getUserById(userId);
  if (error || !data.user?.email) {
    return { error: "Korisnički nalog nije pronađen." };
  }
  if (accountIsConfirmed(data.user)) {
    return { error: "Korisnik je već aktivirao nalog." };
  }

  const { error: inviteError } = await admin.auth.admin.inviteUserByEmail(
    data.user.email,
    { redirectTo }
  );
  return inviteError
    ? { error: humanizeInviteError(inviteError.message) }
    : { ok: true };
}

/**
 * Deactivate or reactivate a Stožer account. Deactivation bans the auth
 * account (reversible), keeps the membership and the staff link, and never
 * deletes data. The last remaining club president cannot be deactivated.
 */
export async function setAccountDisabled(
  orgId: string,
  currentUserId: string,
  userId: string,
  disabled: boolean
): Promise<{ ok: true } | { error: string }> {
  if (userId === currentUserId) {
    return { error: "Ne možete deaktivirati sopstveni nalog." };
  }

  const admin = createAdminClient();
  const { data: membership, error: membershipError } = await admin
    .from("organization_memberships")
    .select("id, role")
    .eq("organization_id", orgId)
    .eq("user_id", userId)
    .maybeSingle();
  if (membershipError || !membership) {
    return { error: "Korisnik nije član ovog kluba." };
  }

  if (disabled && membership.role === "club_president") {
    const { count } = await admin
      .from("organization_memberships")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("role", "club_president");
    if ((count ?? 0) <= 1) {
      return { error: "Poslednji administrator kluba ne može biti deaktiviran." };
    }
  }

  const { error } = await admin.auth.admin.updateUserById(userId, {
    ban_duration: disabled ? "876000h" : "none",
  });
  if (error) {
    return {
      error: disabled
        ? "Deaktiviranje naloga nije uspelo. Pokušajte ponovo."
        : "Aktiviranje naloga nije uspelo. Pokušajte ponovo.",
    };
  }
  return { ok: true };
}

export interface UpdateUserAccessInput {
  userId: string;
  role: AppRole;
  teamIds: string[];
  seasonId: string | null;
}

/**
 * Change a member's application role and, for team-scoped roles, their season
 * team assignments. The role is written to the membership row, the linked
 * staff profile and the user's JWT claims (which every access check reads), so
 * the change takes effect immediately. A president may not edit their own
 * access, and the last president cannot be demoted.
 */
export async function updateUserAccess(
  orgId: string,
  currentUserId: string,
  input: UpdateUserAccessInput
): Promise<{ ok: true } | { error: string }> {
  if (!ACCESS_ROLES.includes(input.role)) {
    return { error: "Izabrana uloga nije dostupna" };
  }
  if (input.userId === currentUserId) {
    return { error: "Ne možete menjati sopstveni pristup" };
  }

  const admin = createAdminClient();

  const { data: membership, error: membershipError } = await admin
    .from("organization_memberships")
    .select("id, role")
    .eq("organization_id", orgId)
    .eq("user_id", input.userId)
    .maybeSingle();
  if (membershipError || !membership) {
    return { error: "Korisnik nije član ove organizacije" };
  }

  if (membership.role === "club_president" && input.role !== "club_president") {
    const { count } = await admin
      .from("organization_memberships")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("role", "club_president");
    if ((count ?? 0) <= 1) {
      return { error: "Poslednji administrator kluba ne može promeniti ulogu." };
    }
  }

  const { error: memError } = await admin
    .from("organization_memberships")
    .update({ role: input.role })
    .eq("id", membership.id);
  if (memError) return { error: memError.message };

  const { data: staff, error: staffError } = await admin
    .from("staff")
    .select("id")
    .eq("organization_id", orgId)
    .eq("user_id", input.userId)
    .maybeSingle();
  if (staffError) return { error: staffError.message };

  if (staff) {
    await admin
      .from("staff")
      .update({ role: input.role })
      .eq("id", staff.id)
      .eq("organization_id", orgId);

    if (input.seasonId) {
      const teamsResult = await replaceStaffTeams(
        admin,
        orgId,
        staff.id,
        input.seasonId,
        isTeamScopedRole(input.role) ? input.teamIds : []
      );
      if ("error" in teamsResult) return { error: teamsResult.error };
    }
  }

  const { data: user } = await admin.auth.admin.getUserById(input.userId);
  const { error: claimsError } = await admin.auth.admin.updateUserById(
    input.userId,
    {
      app_metadata: {
        ...(user.user?.app_metadata ?? {}),
        organization_id: orgId,
        user_role: input.role,
      },
    }
  );
  if (claimsError) {
    return { error: "Uloga je sačuvana, ali pristup nije osvežen. Pokušajte ponovo." };
  }

  return { ok: true };
}
