import { describe, expect, it } from "vitest";
import {
  normalizeGuardianPrimary,
  normalizeGuardians,
  type GuardianInput,
} from "@/lib/guardian";

const athleteId = "11111111-1111-1111-1111-111111111111";
const guardian = (id: string, isPrimary: boolean): GuardianInput => ({
  id,
  athlete_id: athleteId,
  full_name: id === "g1" ? "Ana Parent" : "Boris Parent",
  relationship: "parent",
  phone: null,
  email: `${id}@example.com`,
  preferred_contact: "email",
  is_primary: isPrimary,
});

describe("guardian", () => {
  it("clears the previous primary when a new primary is selected", () => {
    const result = normalizeGuardianPrimary(
      athleteId,
      [guardian("g1", true)],
      [guardian("g1", false), guardian("g2", true)]
    );
    expect(result.filter((row) => row.is_primary).map((row) => row.id)).toEqual(["g2"]);
  });

  it("marks the first guardian as primary for an athlete with no guardians", () => {
    const result = normalizeGuardianPrimary(athleteId, [], [guardian("g1", false)]);
    expect(result).toHaveLength(1);
    expect(result[0].is_primary).toBe(true);
  });

  it("keeps the existing primary when a second guardian is non-primary", () => {
    const result = normalizeGuardianPrimary(
      athleteId,
      [guardian("g1", true)],
      [guardian("g1", true), guardian("g2", false)]
    );
    expect(result.find((row) => row.id === "g1")?.is_primary).toBe(true);
    expect(result.find((row) => row.id === "g2")?.is_primary).toBe(false);
  });

  it("defensively produces at most one primary in an insert payload", () => {
    const result = normalizeGuardians(
      [guardian("g1", true), guardian("g2", true)],
      athleteId
    );
    expect(result.filter((row) => row.is_primary)).toHaveLength(1);
  });
});
