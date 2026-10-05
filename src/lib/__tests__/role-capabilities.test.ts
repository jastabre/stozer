import { describe, expect, it } from "vitest";
import {
  deniedSummaryCapabilities,
  detailCapabilities,
  summarizeCapabilities,
  summarizeRolePermissions,
} from "@/lib/role-capabilities";

describe("summarizeRolePermissions", () => {
  it("groups raw permissions into ordered areas and short actions", () => {
    const groups = summarizeRolePermissions([
      "teams.view",
      "teams.edit",
      "athletes.view",
      "athletes.view_sensitive",
      "athletes.edit",
      "athletes.manage",
      "athletes.create",
      "athletes.delete",
      "documents.manage",
    ]);

    expect(groups).toEqual([
      { area: "athletes", actions: ["view", "create", "edit", "delete"] },
      { area: "teams", actions: ["view", "edit"] },
      { area: "documents", actions: ["edit"] },
    ]);
  });

  it("keeps youth and first-team finance as separate honest areas", () => {
    const groups = summarizeRolePermissions([
      "youth_finance.view",
      "first_team_finance.view",
      "first_team_finance.manage",
    ]);
    expect(groups).toEqual([
      { area: "firstTeamFinance", actions: ["view", "edit"] },
      { area: "youthFinance", actions: ["view"] },
    ]);
  });

  it("ignores unknown or malformed permissions instead of leaking raw keys", () => {
    expect(
      summarizeRolePermissions(["something.unknown", "noSuffix", "club_settings.manage"])
    ).toEqual([{ area: "clubSettings", actions: ["edit"] }]);
  });

  it("returns no groups for an empty permission list", () => {
    expect(summarizeRolePermissions([])).toEqual([]);
  });
});

describe("summaryCapabilities", () => {
  it("merges registrations and medical only when both are present", () => {
    expect(
      summarizeCapabilities([
        "registrations.view",
        "medical.view",
        "teams.view",
      ]).summary
    ).toEqual(["playersTeams", "registrationsMedical"]);

    expect(summarizeCapabilities(["medical.view"]).summary).toEqual(["medical"]);
    expect(summarizeCapabilities(["registrations.manage"]).summary).toEqual([
      "registrations",
    ]);
  });

  it("maps first-team finance to 'finance' and hides unbuilt youth finance", () => {
    expect(
      summarizeCapabilities(["first_team_finance.view"]).summary
    ).toEqual(["finance"]);
    // youth_finance has no screen yet: it must not appear in the summary.
    expect(summarizeCapabilities(["youth_finance.view"]).summary).toEqual([]);
  });

  it("merges staff and documents into one row when both exist", () => {
    expect(
      summarizeCapabilities(["staff.view", "documents.view"]).summary
    ).toEqual(["staffDocs"]);
    expect(summarizeCapabilities(["staff.view"]).summary).toEqual(["staff"]);
    expect(summarizeCapabilities(["documents.view"]).summary).toEqual([
      "documents",
    ]);
  });

  it("separates user/access administration from season management", () => {
    expect(summarizeCapabilities(["users.manage"]).summary).toEqual([
      "usersSettings",
    ]);
    expect(summarizeCapabilities(["club_settings.manage"]).summary).toEqual([
      "usersSettings",
    ]);
    expect(summarizeCapabilities(["seasons.manage"]).summary).toEqual([
      "seasons",
    ]);
    // seasons.view alone is context, not an administration capability.
    expect(summarizeCapabilities(["seasons.view"]).summary).toEqual([]);
  });
});

describe("deniedSummaryCapabilities", () => {
  it("does not deny medical when registrations already grant the clearance view", () => {
    expect(
      deniedSummaryCapabilities([
        "registrations.view",
        "registrations.manage",
        "contracts.view",
        "youth_finance.view",
        "first_team_finance.view",
        "club_settings.manage",
        "sponsors.view",
        "reports.view",
        "equipment.view",
        "documents.view",
        "staff.view",
      ])
    ).toEqual([]);
  });

  it("merges registrations, medical, staff and documents denials", () => {
    expect(deniedSummaryCapabilities(["teams.view", "athletes.view"])).toEqual([
      "finance",
      "registrationsMedical",
      "usersSettings",
      "equipment",
      "staffDocs",
    ]);
  });
});

describe("detailCapabilities", () => {
  it("renders every area in every group, denied areas flagged", () => {
    const groups = detailCapabilities(["athletes.view", "equipment.manage"]);
    const playersTeams = groups.find((group) => group.key === "playersTeams");
    expect(playersTeams?.items).toEqual([
      { area: "athletes", actions: ["view"], denied: false },
      { area: "teams", actions: [], denied: true },
    ]);
    const finance = groups.find((group) => group.key === "finance");
    expect(finance?.items.every((item) => item.denied)).toBe(true);
  });

  it("shows medical read for registrations holders (RLS D-38)", () => {
    const groups = detailCapabilities(["registrations.view"]);
    const health = groups.find((group) => group.key === "health");
    expect(
      health?.items.find((item) => item.area === "medical")
    ).toEqual({ area: "medical", actions: ["view"], denied: false });
  });

  it("filters out areas that have no screen yet", () => {
    const groups = detailCapabilities([
      "athletes.view",
      "attendance.manage",
      "reports.view",
      "sponsors.view",
      "youth_finance.manage",
      "notifications.manage",
    ]);
    const areas = groups.flatMap((group) => group.items.map((item) => item.area));
    for (const unbuilt of [
      "attendance",
      "reports",
      "sponsors",
      "youthFinance",
      "notifications",
    ]) {
      expect(areas).not.toContain(unbuilt);
    }
    // Shipped areas stay visible (granted or denied) so the groups remain
    // comparable between roles.
    expect(areas).toContain("athletes");
    expect(areas).toContain("equipment");
    const athletes = groups
      .flatMap((group) => group.items)
      .find((item) => item.area === "athletes");
    expect(athletes?.denied).toBe(false);
  });
});
