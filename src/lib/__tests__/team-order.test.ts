import { describe, expect, it } from "vitest";
import { sortTeamsByCategory } from "@/lib/team-order";

const team = (name: string, category: string) => ({ name, category });

describe("sortTeamsByCategory", () => {
  it("orders by business category priority, first team above all", () => {
    const input = [
      team("Ostalo A", "other"),
      team("B tim", "academy"),
      team("Omladinci", "youth"),
      team("Zvezda Prvi Tim", "first_team"),
    ];
    expect(sortTeamsByCategory(input).map((t) => t.category)).toEqual([
      "first_team",
      "youth",
      "academy",
      "other",
    ]);
  });

  it("orders alphabetically within the same category", () => {
    const input = [
      team("Vojvodina", "youth"),
      team("Partizan", "youth"),
      team("Crvena zvezda", "youth"),
    ];
    expect(sortTeamsByCategory(input).map((t) => t.name)).toEqual([
      "Crvena zvezda",
      "Partizan",
      "Vojvodina",
    ]);
  });

  it("keeps the first team on top even when its name sorts last", () => {
    const input = [
      team("AAA Omladinci", "youth"),
      team("ZZZ Prvi Tim", "first_team"),
    ];
    expect(sortTeamsByCategory(input).map((t) => t.category)).toEqual([
      "first_team",
      "youth",
    ]);
  });

  it("puts an unknown category last", () => {
    const input = [team("Nepoznato", "legacy"), team("Prvi", "first_team")];
    expect(sortTeamsByCategory(input).map((t) => t.category)).toEqual([
      "first_team",
      "legacy",
    ]);
  });

  it("does not mutate the input array", () => {
    const input = [team("B", "youth"), team("A", "first_team")];
    const snapshot = [...input];
    sortTeamsByCategory(input);
    expect(input).toEqual(snapshot);
  });
});
