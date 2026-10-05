import { describe, expect, it } from "vitest";
import {
  deniedSummaryCapabilities,
  detailCapabilities,
  summarizeCapabilities,
  summarizeRolePermissions,
  type CapabilityArea,
} from "@/lib/role-capabilities";
import { ACCESS_ROLES, TEAM_SCOPED_ROLES, isTeamScopedRole } from "@/lib/roles";

/**
 * Contract test: the capability UI must reflect the REAL seeded permission
 * matrix. These lists mirror supabase/migrations 00001 + 00010 + 00013 +
 * 00023 + 00029 + 00034 + 00047 (the role_permissions rows). If a migration changes a
 * role's grants, this test fails and the UI copy must be updated with it — the
 * UI can never claim access the backend does not grant.
 *
 * Team scope is NOT a permission: `staff_teams` narrows WHAT a coach may see
 * (00035 RLS). Only the coach is team-scoped; every other role stays
 * organization-wide within its permissions.
 */
const PRESIDENT = [
  "teams.view", "teams.create", "teams.edit", "teams.delete",
  "athletes.view", "athletes.create", "athletes.edit", "athletes.delete",
  "athletes.view_sensitive", "athletes.edit_sensitive",
  "attendance.manage",
  "youth_finance.view", "youth_finance.manage",
  "first_team_finance.view", "first_team_finance.manage",
  "registrations.view", "registrations.manage",
  "contracts.view", "contracts.manage",
  "documents.view", "documents.manage",
  "sponsors.view", "sponsors.manage",
  "staff.view", "staff.manage",
  "reports.view", "reports.export",
  "club_settings.manage", "notifications.manage",
  "seasons.view", "seasons.manage",
  "medical.view", "medical.manage",
  "equipment.view", "equipment.report", "equipment.manage",
  "users.manage",
  "calendar.view", "venue.view", "venue.manage",
  "match.view", "match.manage", "attendance.view",
];

const YOUTH_DIRECTOR = [
  "teams.view", "teams.create", "teams.edit",
  "athletes.view", "athletes.create", "athletes.edit",
  "athletes.view_sensitive", "athletes.edit_sensitive",
  "attendance.manage",
  "youth_finance.view", "youth_finance.manage",
  "documents.view", "documents.manage",
  "registrations.view", "registrations.manage",
  "reports.view", "reports.export",
  "staff.view", "notifications.manage",
  "seasons.view", "seasons.manage",
  "medical.view", "medical.manage",
  "equipment.view", "equipment.report", "equipment.manage",
  "calendar.view", "venue.view", "venue.manage",
  "match.view", "match.manage", "attendance.view",
];

const COACH = [
  "teams.view",
  "athletes.view", "athletes.view_sensitive",
  "attendance.manage",
  "documents.view",
  "notifications.manage",
  "medical.view",
  "equipment.view", "equipment.report",
  "staff.view",
  "calendar.view", "venue.view",
  "match.view", "attendance.view",
];

const ADMIN_FINANCE = [
  "teams.view",
  "athletes.view", "athletes.view_sensitive",
  "youth_finance.view", "youth_finance.manage",
  "first_team_finance.view", "first_team_finance.manage",
  "registrations.view", "registrations.manage",
  "contracts.view", "contracts.manage",
  "documents.view", "documents.manage",
  "staff.view", "staff.manage",
  "reports.view", "reports.export",
  "notifications.manage",
  "sponsors.view", "sponsors.manage",
  "equipment.view", "equipment.report",
];

const EQUIPMENT_MANAGER = [
  "teams.view",
  "athletes.view",
  "staff.view",
  "seasons.view",
  "equipment.view", "equipment.report", "equipment.manage",
  "notifications.manage",
];

const MEDICAL_STAFF = [
  "teams.view",
  "athletes.view",
  "seasons.view",
  "medical.view", "medical.manage",
  "notifications.manage",
];

const ALL_LISTS: Record<string, string[]> = {
  club_president: PRESIDENT,
  youth_director: YOUTH_DIRECTOR,
  coach: COACH,
  admin_finance: ADMIN_FINANCE,
  equipment_manager: EQUIPMENT_MANAGER,
  medical_staff: MEDICAL_STAFF,
};

const KNOWN_AREAS: CapabilityArea[] = [
  "athletes", "teams", "registrations", "medical", "contracts",
  "firstTeamFinance", "staffFinance", "youthFinance", "equipment", "staff", "documents",
  "seasons", "reports", "sponsors", "attendance", "notifications",
  "clubSettings", "users",
  "venue", "calendar", "match",
];

describe("real role permission matrix", () => {
  it("club_president: nothing denied, a 6-row user-facing summary", () => {
    const breakdown = summarizeCapabilities(PRESIDENT);
    expect(breakdown.denied).toEqual([]);
    expect(breakdown.summary).toEqual([
      "playersTeams",
      "registrationsMedical",
      "staffDocs",
      "equipment",
      "finance",
      "usersSettings",
    ]);
  });

  it("youth_director: youth management, no finance screen or user access", () => {
    const breakdown = summarizeCapabilities(YOUTH_DIRECTOR);
    expect(breakdown.denied).toEqual(["finance", "usersSettings"]);
    expect(breakdown.summary).toEqual([
      "playersTeams",
      "registrationsMedical",
      "staffDocs",
      "equipment",
      "seasons",
    ]);
    // youth_finance exists in the backend but has no screen yet: it must not
    // show up in the summary (presentation availability filter).
    expect(breakdown.summary).not.toContain("finance");
  });

  it("coach: team operations only, view-only players", () => {
    const breakdown = summarizeCapabilities(COACH);
    expect(breakdown.denied).toEqual(["finance", "registrations", "usersSettings"]);
    expect(breakdown.summary).toEqual([
      "playersTeams",
      "medical",
      "staffDocs",
      "equipment",
    ]);
    const groups = summarizeRolePermissions(COACH);
    expect(groups.find((group) => group.area === "athletes")?.actions).toEqual([
      "view",
    ]);
    expect(groups.find((group) => group.area === "equipment")?.actions).toEqual([
      "view",
      "report",
    ]);
  });

  it("admin_finance: financial capabilities WITHOUT users/access or club settings", () => {
    const breakdown = summarizeCapabilities(ADMIN_FINANCE);
    expect(breakdown.denied).toEqual(["usersSettings"]);
    expect(breakdown.summary).toEqual([
      "playersTeams",
      "registrations",
      "staffDocs",
      "equipment",
      "finance",
    ]);
    // Players are read-only for finance (no create/edit/delete grants).
    const groups = summarizeRolePermissions(ADMIN_FINANCE);
    expect(groups.find((group) => group.area === "athletes")?.actions).toEqual([
      "view",
    ]);
    // The access group is visible in the details as fully denied.
    const access = detailCapabilities(ADMIN_FINANCE).find(
      (group) => group.key === "access"
    );
    expect(access?.items.every((item) => item.denied)).toBe(true);
  });

  it("equipment_manager: equipment module + basic athlete/team/staff read only", () => {
    const breakdown = summarizeCapabilities(EQUIPMENT_MANAGER);
    expect(breakdown.denied).toEqual([
      "finance",
      "registrationsMedical",
      "usersSettings",
      "documents",
    ]);
    expect(breakdown.summary).toEqual(["playersTeams", "staff", "equipment"]);
    const groups = summarizeRolePermissions(EQUIPMENT_MANAGER);
    expect(groups.find((group) => group.area === "equipment")?.actions).toEqual([
      "view",
      "edit",
      "report",
    ]);
    expect(groups.map((group) => group.area)).not.toContain("contracts");
    expect(groups.map((group) => group.area)).not.toContain("medical");
  });

  it("medical_staff: medical exams + basic athlete/team read", () => {
    const breakdown = summarizeCapabilities(MEDICAL_STAFF);
    expect(breakdown.denied).toEqual([
      "finance",
      "registrations",
      "usersSettings",
      "equipment",
      "staffDocs",
    ]);
    expect(breakdown.summary).toEqual(["playersTeams", "medical"]);
    const groups = summarizeRolePermissions(MEDICAL_STAFF);
    expect(groups.find((group) => group.area === "medical")?.actions).toEqual([
      "view",
      "edit",
    ]);
    expect(groups.map((group) => group.area)).not.toContain("equipment");
    expect(groups.map((group) => group.area)).not.toContain("contracts");
  });

  it("never advertises modules that have no screen yet", () => {
    const unavailable = [
      "attendance",
      "reports",
      "sponsors",
      "youthFinance",
      "notifications",
      "calendar",
      "match",
    ];
    for (const permissions of Object.values(ALL_LISTS)) {
      const breakdown = summarizeCapabilities(permissions);
      expect(breakdown.summary.length).toBeLessThanOrEqual(6);
      expect(breakdown.denied.length).toBeLessThanOrEqual(6);
      for (const group of breakdown.details) {
        for (const item of group.items) {
          expect(unavailable).not.toContain(item.area);
        }
      }
    }
  });

  it("only known capability areas are produced (i18n has labels for all)", () => {
    for (const permissions of Object.values(ALL_LISTS)) {
      for (const group of summarizeRolePermissions(permissions)) {
        expect(KNOWN_AREAS).toContain(group.area);
      }
      for (const group of detailCapabilities(permissions)) {
        for (const item of group.items) {
          expect(KNOWN_AREAS).toContain(item.area);
        }
      }
    }
  });

  it("only the coach is team-scoped, and the scope is not a permission", () => {
    expect(TEAM_SCOPED_ROLES).toEqual(["coach"]);
    for (const role of ACCESS_ROLES) {
      expect(isTeamScopedRole(role)).toBe(role === "coach");
    }
    // A team-scoped coach gains no roster/equipment capabilities from the
    // scope: staff_teams narrows visibility and never widens the capability
    // set. (The only "edit" a coach has is notifications.manage.)
    const coachGroups = summarizeRolePermissions(COACH);
    const actionsFor = (area: string) =>
      coachGroups.find((group) => group.area === area)?.actions ?? [];
    expect(actionsFor("athletes")).toEqual(["view"]);
    expect(actionsFor("teams")).toEqual(["view"]);
    expect(actionsFor("equipment")).toEqual(["view", "report"]);
    expect(actionsFor("documents")).toEqual(["view"]);
    expect(actionsFor("contracts")).toEqual([]);
  });

  it("denied lists never overlap with summary lists", () => {
    for (const permissions of Object.values(ALL_LISTS)) {
      const breakdown = summarizeCapabilities(permissions);
      const overlap = breakdown.summary.filter((key) =>
        breakdown.denied.includes(key)
      );
      expect(overlap).toEqual([]);
      expect(deniedSummaryCapabilities(permissions)).toEqual(breakdown.denied);
    }
  });
});
