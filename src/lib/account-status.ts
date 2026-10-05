/**
 * Stožer account status, derived from the auth account's own timestamps —
 * there is no membership status column in the schema (00001) and this module
 * deliberately does not invent one.
 *
 *   none      no auth account with this email yet
 *   invited   account exists but has never confirmed / signed in (the club
 *             sent an invitation, or the person registered without confirming)
 *   active    account confirmed / signed in at least once
 *   disabled  account is banned (deactivated by the club)
 */
export type AccountStatus = "none" | "invited" | "active" | "disabled";

export interface AuthAccountTimestamps {
  invited_at?: string | null;
  email_confirmed_at?: string | null;
  confirmed_at?: string | null;
  last_sign_in_at?: string | null;
  banned_until?: string | null;
}

export function deriveAccountStatus(
  account: AuthAccountTimestamps | null | undefined,
  now: Date = new Date()
): AccountStatus {
  if (!account) return "none";
  if (
    account.banned_until &&
    new Date(account.banned_until).getTime() > now.getTime()
  ) {
    return "disabled";
  }
  if (account.last_sign_in_at || account.email_confirmed_at || account.confirmed_at) {
    return "active";
  }
  if (account.invited_at) return "invited";
  // An unconfirmed self-registered user: they exist but cannot sign in yet.
  return "invited";
}
