import { describe, expect, it } from "vitest";
import {
  importRowSchema,
  validateTeam,
  findDuplicate,
  resolveDuplicate,
  mapHeaders,
  type AthleteRef,
  type ImportRow,
} from "@/lib/import/rows";

describe("import row model (REG-08, D-14/D-15)", () => {
  const teams = new Set(["Senior", "U19", "U17"]);

  const knownRow: ImportRow = {
    first_name: "Marko",
    last_name: "Petrović",
    birth_date: "2010-05-01",
    gender: "male",
    team: "Senior",
  };

  describe("Test 1 — team validation (D-14, never auto-create)", () => {
    it("accepts a row whose team name exists in the org", () => {
      expect(importRowSchema.safeParse(knownRow).success).toBe(true);
      expect(validateTeam("Senior", teams)).toEqual([]);
    });

    it("rejects a row whose team name is unknown with an error naming the team", () => {
      const errors = validateTeam("Seniors FC", teams);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain("Seniors FC");
    });
  });

  describe("Test 2 — duplicate detection strong keys (D-15)", () => {
    const a1: AthleteRef = {
      id: "a1",
      club_athlete_number: 42,
      first_name: "Marko",
      last_name: "Petrović",
      birth_date: "2010-05-01",
    };
    const a2: AthleteRef = {
      id: "a2",
      club_athlete_number: 7,
      first_name: "Marko",
      last_name: "Petrović",
      birth_date: "2010-05-01",
    };

    it("matches by club athlete number when present", () => {
      const row = { ...knownRow, club_athlete_number: 42 };
      const dup = findDuplicate(
        row,
        new Map([["42", a1]]),
        new Map()
      );
      expect(dup?.id).toBe("a1");
    });

    it("falls back to first|last|dob when club number absent", () => {
      const row = { ...knownRow };
      const dup = findDuplicate(
        row,
        new Map(),
        new Map([["Marko|Petrović|2010-05-01", a2]])
      );
      expect(dup?.id).toBe("a2");
    });

    it("never collapses two distinct athletes on a null/empty DOB", () => {
      const row = { first_name: "Marko", last_name: "Petrović", birth_date: "" };
      const dup = findDuplicate(
        row,
        new Map(),
        new Map([["Marko|Petrović|2010-05-01", a2]])
      );
      expect(dup).toBeNull();
    });

    it("returns null when no key matches", () => {
      const row = { first_name: "Jovan", last_name: "Jović", birth_date: "2009-01-01" };
      const dup = findDuplicate(
        row,
        new Map([["42", a1]]),
        new Map([["Marko|Petrović|2010-05-01", a2]])
      );
      expect(dup).toBeNull();
    });
  });

  describe("Test 3 — duplicate resolution (skip|update|create)", () => {
    const row: ImportRow = { ...knownRow };
    const existing: AthleteRef = {
      id: "a9",
      club_athlete_number: 3,
      first_name: "Marko",
      last_name: "Petrović",
      birth_date: "2010-05-01",
    };

    it("create keeps the row for insertion", () => {
      expect(resolveDuplicate(row, existing, "create")).toEqual({
        mode: "create",
        row,
      });
    });

    it("skip drops the row", () => {
      expect(resolveDuplicate(row, existing, "skip")).toEqual({
        mode: "skip",
        row: null,
      });
    });

    it("update returns the athlete id + upserted row", () => {
      const resolved = resolveDuplicate(row, existing, "update");
      expect(resolved.mode).toBe("update");
      if (resolved.mode === "update") {
        expect(resolved.row.id).toBe("a9");
        expect(resolved.row).toMatchObject({ first_name: "Marko" });
      }
    });
  });

  describe("Test 4 — required-field errors without throwing", () => {
    it("reports per-row errors for missing required fields", () => {
      const bad = {
        first_name: "",
        last_name: "",
        birth_date: "not-a-date",
      };
      // safeParse never throws — it returns issues per field.
      const result = importRowSchema.safeParse(bad);
      expect(result.success).toBe(false);
      if (!result.success) {
        const issues = result.error.issues.map((i) => i.path.join("."));
        expect(issues).toContain("first_name");
        expect(issues).toContain("last_name");
        expect(issues).toContain("birth_date");
      }
    });

    it("normalizes header names case/accent-insensitively via mapHeaders", () => {
      const mapped = mapHeaders(["FIRST NAME", "Prezime", "Datum rođenja"]);
      const fields = mapped.map((m) => m.field);
      expect(fields).toContain("first_name");
      expect(fields).toContain("last_name");
      expect(fields).toContain("birth_date");
    });
  });
});
