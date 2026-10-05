/**
 * Turns raw role_permissions rows into the UI's role presentation:
 *
 *   - `summary`  one short phrase per capability group (the main flow)
 *   - `denied`   short "no access" phrases, priority-ordered
 *   - `details`  the real area -> actions rows, grouped for the collapsible
 *                "Prikaži detaljne dozvole" section
 *
 * This is presentation only: it never decides access. The permission set
 * always comes from the backend role/permission tables (see `loadRoleMetadata`
 * in staff-profile.ts); this module only groups and names it so the UI never
 * shows raw permission keys and never invents capabilities.
 */

export type CapabilityArea =
  | "athletes"
  | "teams"
  | "registrations"
  | "medical"
  | "contracts"
  | "firstTeamFinance"
  | "staffFinance"
  | "youthFinance"
  | "equipment"
  | "staff"
  | "documents"
  | "seasons"
  | "reports"
  | "sponsors"
  | "attendance"
  | "notifications"
  | "clubSettings"
  | "users"
  | "venue"
  | "calendar"
  | "match";

export type CapabilityAction =
  | "view"
  | "create"
  | "edit"
  | "delete"
  | "report"
  | "export";

/** Short phrases used in the main role summary. */
export type CapabilitySummaryKey =
  | "playersTeams"
  | "registrationsMedical"
  | "registrations"
  | "medical"
  | "staffDocs"
  | "staff"
  | "documents"
  | "equipment"
  | "finance"
  | "seasons"
  | "usersSettings";

/**
 * Modules that actually exist in the shipped app (Phase 2). Permissions for
 * later phases stay in the backend, but the UI must never advertise a
 * capability the user cannot reach: no attendance, reports, sponsors, youth
 * finance or notifications screens exist yet.
 *
 * Presentation-only allowlist — backend grants are untouched.
 */
export const AVAILABLE_AREAS: readonly CapabilityArea[] = [
  "athletes",
  "teams",
  "registrations",
  "medical",
  "contracts",
  "firstTeamFinance",
  "staffFinance",
  "equipment",
  "staff",
  "documents",
  "seasons",
  "venue",
  "clubSettings",
  "users",
];

export function isAvailableArea(area: CapabilityArea): boolean {
  return AVAILABLE_AREAS.includes(area);
}

/** Detail sections for the expandable "Prikaži detaljne dozvole". */
export type CapabilityDetailGroupKey =
  | "playersTeams"
  | "health"
  | "equipment"
  | "finance"
  | "club"
  | "access";

export interface CapabilityDetailItem {
  area: CapabilityArea;
  actions: CapabilityAction[];
  denied: boolean;
}

export interface RoleCapabilityBreakdown {
  summary: CapabilitySummaryKey[];
  denied: CapabilitySummaryKey[];
  details: { key: CapabilityDetailGroupKey; items: CapabilityDetailItem[] }[];
}

export interface CapabilityGroup {
  area: CapabilityArea;
  actions: CapabilityAction[];
}

const AREA_ORDER: CapabilityArea[] = [
  "athletes",
  "teams",
  "registrations",
  "medical",
  "contracts",
  "firstTeamFinance",
  "staffFinance",
  "youthFinance",
  "equipment",
  "staff",
  "documents",
  "seasons",
  "reports",
  "sponsors",
  "attendance",
  "notifications",
  "clubSettings",
  "users",
  "venue",
  "calendar",
  "match",
];

const AREA_BY_PREFIX: Record<string, CapabilityArea> = {
  athletes: "athletes",
  teams: "teams",
  registrations: "registrations",
  medical: "medical",
  contracts: "contracts",
  first_team_finance: "firstTeamFinance",
  staff_finance: "staffFinance",
  youth_finance: "youthFinance",
  equipment: "equipment",
  staff: "staff",
  documents: "documents",
  seasons: "seasons",
  reports: "reports",
  sponsors: "sponsors",
  attendance: "attendance",
  notifications: "notifications",
  club_settings: "clubSettings",
  users: "users",
  venue: "venue",
  calendar: "calendar",
  match: "match",
};

const ACTION_ORDER: CapabilityAction[] = [
  "view",
  "create",
  "edit",
  "delete",
  "report",
  "export",
];

/**
 * Verbs fold into a short vocabulary: the sensitive variants read as their base
 * action, and `.manage` reads as edit. The summary stays honest and scannable.
 */
const ACTION_BY_SUFFIX: Record<string, CapabilityAction> = {
  view: "view",
  view_sensitive: "view",
  create: "create",
  edit: "edit",
  edit_sensitive: "edit",
  manage: "edit",
  delete: "delete",
  report: "report",
  export: "export",
};

/** Group permissions by area; unknown permissions are ignored, never rendered. */
export function summarizeRolePermissions(
  permissions: readonly string[]
): CapabilityGroup[] {
  const byArea = new Map<CapabilityArea, Set<CapabilityAction>>();
  for (const permission of permissions) {
    const [prefix, suffix] = permission.split(".");
    const area = AREA_BY_PREFIX[prefix];
    const action = ACTION_BY_SUFFIX[suffix];
    if (!area || !action) continue;
    const actions = byArea.get(area) ?? new Set<CapabilityAction>();
    actions.add(action);
    byArea.set(area, actions);
  }

  return AREA_ORDER.filter((area) => byArea.has(area)).map((area) => {
    const actions = byArea.get(area) as Set<CapabilityAction>;
    return {
      area,
      actions: ACTION_ORDER.filter((action) => actions.has(action)),
    };
  });
}

/** Detail sections, ordered the way a club person reads them. */
const DETAIL_GROUPS: { key: CapabilityDetailGroupKey; areas: CapabilityArea[] }[] =
  [
    { key: "playersTeams", areas: ["athletes", "teams"] },
    { key: "health", areas: ["registrations", "medical", "attendance"] },
    { key: "equipment", areas: ["equipment"] },
    { key: "finance", areas: ["contracts", "youthFinance", "firstTeamFinance", "staffFinance"] },
    {
      key: "club",
      areas: ["staff", "documents", "sponsors", "reports", "seasons", "notifications", "venue"],
    },
    { key: "access", areas: ["clubSettings", "users"] },
  ];

const DENIED_ORDER: CapabilitySummaryKey[] = [
  "finance",
  "registrationsMedical",
  "registrations",
  "medical",
  "usersSettings",
  "equipment",
  "staffDocs",
  "staff",
  "documents",
];

function permissionChecker(permissions: readonly string[]) {
  const hasPrefix = (prefix: string) =>
    permissions.some((permission) => permission.startsWith(`${prefix}.`));
  const hasManage = (prefix: string) =>
    permissions.includes(`${prefix}.manage`);
  return { hasPrefix, hasManage };
}

/**
 * Short positive phrases for the main role summary. Only shipped modules are
 * mentioned, and the list stays short (roughly 4-6 rows): registrations and
 * medical merge into one health row when both exist, staff and documents merge
 * into one row, and youth finance/sponsors/reports/attendance are omitted
 * because no screen exists for them yet.
 */
export function summaryCapabilities(
  permissions: readonly string[]
): CapabilitySummaryKey[] {
  const { hasPrefix, hasManage } = permissionChecker(permissions);
  const registrations = hasPrefix("registrations");
  const medical = hasPrefix("medical");
  const staff = hasPrefix("staff");
  const documents = hasPrefix("documents");

  const summary: CapabilitySummaryKey[] = [];
  if (hasPrefix("athletes") || hasPrefix("teams")) summary.push("playersTeams");
  if (registrations && medical) summary.push("registrationsMedical");
  else if (registrations) summary.push("registrations");
  else if (medical) summary.push("medical");
  if (staff && documents) summary.push("staffDocs");
  else if (staff) summary.push("staff");
  else if (documents) summary.push("documents");
  if (hasPrefix("equipment")) summary.push("equipment");
  if (
    hasPrefix("contracts") ||
    hasPrefix("first_team_finance") ||
    hasPrefix("staff_finance")
  ) {
    summary.push("finance");
  }
  if (hasPrefix("users") || hasPrefix("club_settings")) {
    // Club administration: user access, branding, thresholds, currency.
    summary.push("usersSettings");
  } else if (hasManage("seasons")) {
    // Season management alone is not user/access administration.
    summary.push("seasons");
  }
  return summary;
}

/**
 * Short "no access" phrases. A role is only denied medical when it has no
 * medical permission AND no registrations permission — registration views
 * carry medical-clearance status at the database level (D-38).
 */
export function deniedSummaryCapabilities(
  permissions: readonly string[]
): CapabilitySummaryKey[] {
  const { hasPrefix } = permissionChecker(permissions);
  const registrations = hasPrefix("registrations");
  const medical = hasPrefix("medical");
  const staff = hasPrefix("staff");
  const documents = hasPrefix("documents");

  const denied: CapabilitySummaryKey[] = [];
  // Only shipped modules are named: denying an unbuilt module would advertise
  // functionality that does not exist yet.
  if (
    !hasPrefix("contracts") &&
    !hasPrefix("first_team_finance") &&
    !hasPrefix("staff_finance")
  ) {
    denied.push("finance");
  }
  if (!registrations && !medical) denied.push("registrationsMedical");
  else if (!registrations) denied.push("registrations");
  else if (!medical) {
    // Registrations grant the medical clearance view; not a denial.
  }
  // Seasons are not part of the denial phrase: the label only speaks about
  // user/access administration, which seasons.manage does not grant.
  if (!hasPrefix("users") && !hasPrefix("club_settings")) {
    denied.push("usersSettings");
  }
  if (!hasPrefix("equipment")) denied.push("equipment");
  if (!staff && !documents) denied.push("staffDocs");
  else if (!staff) denied.push("staff");
  else if (!documents) denied.push("documents");

  return DENIED_ORDER.filter((key) => denied.includes(key));
}

/**
 * Grouped real capabilities for the collapsible details. Every shipped area of
 * every group is listed: granted areas show their action words, denied areas
 * show "Nema pristup" so the groups stay comparable between roles. Future-phase
 * areas (attendance, reports, sponsors, youth finance, notifications) are
 * filtered out — the details must not present unbuilt modules as features.
 */
export function detailCapabilities(
  permissions: readonly string[]
): { key: CapabilityDetailGroupKey; items: CapabilityDetailItem[] }[] {
  const groups = summarizeRolePermissions(permissions);
  const byArea = new Map<CapabilityArea, CapabilityAction[]>(
    groups.map((group) => [group.area, group.actions])
  );
  // Medical records are readable with registrations.view at the DB level.
  if (!byArea.has("medical") && byArea.has("registrations")) {
    byArea.set("medical", ["view"]);
  }

  return DETAIL_GROUPS.map((group) => ({
    key: group.key,
    items: group.areas
      .filter(isAvailableArea)
      .map((area) => ({
        area,
        actions: byArea.get(area) ?? [],
        denied: !byArea.has(area),
      })),
  })).filter((group) => group.items.length > 0);
}

/**
 * One-shot breakdown used by the role metadata loader. Keeps the four
 * derivations on the same permission list so they can never disagree.
 */
export function summarizeCapabilities(
  permissions: readonly string[]
): RoleCapabilityBreakdown {
  return {
    summary: summaryCapabilities(permissions),
    denied: deniedSummaryCapabilities(permissions),
    details: detailCapabilities(permissions),
  };
}
