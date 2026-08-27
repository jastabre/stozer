import { describe, expect, it } from "vitest";
import {
  buildCarryForward,
  validateRollover,
  type PrevMembership,
} from "@/lib/rollover";

const prev: PrevMembership[] = [
  { athleteId: "a1", prevTeamId: "u15", jerseyNumber: 7 },
  { athleteId: "a2", prevTeamId: "u17", jerseyNumber: null },
  { athleteId: "a3", prevTeamId: "u15", jerseyNumber: 10 },
];

describe("buildCarryForward", () => {
  it("keeps each athlete with their previous team when there are no moves", () => {
    const result = buildCarryForward(prev, "s-2027", {});
    expect(result.seasonId).toBe("s-2027");
    expect(result.memberships).toEqual([
      { athleteId: "a1", prevTeamId: "u15", jerseyNumber: 7 },
      { athleteId: "a2", prevTeamId: "u17", jerseyNumber: null },
      { athleteId: "a3", prevTeamId: "u15", jerseyNumber: 10 },
    ]);
  });

  it("applies a move for a single athlete (U15 -> U17) without touching others", () => {
    const result = buildCarryForward(prev, "s-2027", { a1: "u17" });
    expect(result.memberships.find((m) => m.athleteId === "a1")?.prevTeamId).toBe(
      "u17"
    );
    expect(result.memberships.find((m) => m.athleteId === "a2")?.prevTeamId).toBe(
      "u17"
    );
    expect(result.memberships.find((m) => m.athleteId === "a3")?.prevTeamId).toBe(
      "u15"
    );
  });

  it("carries jersey numbers through the rollover unchanged", () => {
    const result = buildCarryForward(prev, "s-2027", {});
    expect(result.memberships[0].jerseyNumber).toBe(7);
    expect(result.memberships[1].jerseyNumber).toBeNull();
  });

  it("yields empty output for an empty previous season", () => {
    const result = buildCarryForward([], "s-2027");
    expect(result.memberships).toEqual([]);
  });
});

describe("validateRollover", () => {
  const teams = { u15: { id: "u15" }, u17: { id: "u17" } } as Record<
    string,
    unknown
  >;

  it("returns no errors when every team reference is valid", () => {
    expect(validateRollover(prev, teams)).toEqual([]);
  });

  it("rejects an unknown team reference", () => {
    const bad = [{ athleteId: "a1", prevTeamId: "ghost", jerseyNumber: null }];
    const errors = validateRollover(bad, teams);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("ghost");
    expect(errors[0]).toContain("a1");
  });

  it("rejects multiple unknown team references", () => {
    const bad = [
      { athleteId: "a1", prevTeamId: "x1", jerseyNumber: null },
      { athleteId: "a2", prevTeamId: "x2", jerseyNumber: 5 },
    ];
    expect(validateRollover(bad, teams)).toHaveLength(2);
  });
});
