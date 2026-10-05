import type { AppRole } from "@/types/database";

/**
 * Roles a club member may actually hold. `super_admin` is reserved for the
 * product operator (D-00) and is never assignable from a club screen.
 *
 * The permission authority stays in the database (`role_permissions` +
 * `public.authorize()`); this list only says which roles the UI can offer.
 */
export const ACCESS_ROLES: AppRole[] = [
  "club_president",
  "youth_director",
  "coach",
  "admin_finance",
  "equipment_manager",
  "medical_staff",
];

/**
 * Roles whose access is organized around team assignments. Only these get the
 * "Dodeljeni timovi" editor and their `staff_teams` rows are written by
 * `updateUserAccess` / `addOrgAccount`. Mirrors the backend behavior
 * (`public.is_team_scoped()` in 00035): coach only.
 */
export const TEAM_SCOPED_ROLES: readonly AppRole[] = ["coach"];

export function isTeamScopedRole(role: AppRole): boolean {
  return TEAM_SCOPED_ROLES.includes(role);
}
