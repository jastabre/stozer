import { describe, expect, it } from "vitest";

import {
  findDuplicate,
  importRowSchema,
  mapHeaders,
  resolveDuplicate,
  validateTeam,
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

  describe("team validation", () => {
    it("accepts a known team and rejects an unknown team by name", () => {
      expect(validateTeam("Senior", teams)).toEqual([]);

      const errors = validateTeam("Seniors FC", teams);
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain("Seniors FC");
    });
  });

  describe("strong-key duplicate detection", () => {
    const existing: AthleteRef = {
      id: "athlete-1",
      club_athlete_number: 42,
      first_name: "Marko",
      last_name: "Petrović",
      birth_date: "2010-05-01",
    };

    it("matches by club athlete number when present", () => {
      expect(
        findDuplicate(
          { ...knownRow, club_athlete_number: 42 },
          new Map([["42", existing]]),
          new Map()
        )?.id
      ).toBe("athlete-1");
    });

    it("falls back to first|last|DOB when the club number is absent", () => {
      expect(
        findDuplicate(
          knownRow,
          new Map(),
          new Map([["marko|petrović|2010-05-01", existing]])
        )?.id
      ).toBe("athlete-1");
    });

    it("does not collapse distinct athletes when DOB is null or empty", () => {
      expect(
        findDuplicate(
          { first_name: "Marko", last_name: "Petrović", birth_date: "" },
          new Map(),
          new Map([["marko|petrović|2010-05-01", existing]])
        )
      ).toBeNull();
    });
  });

  describe("duplicate decisions", () => {
    const existing: AthleteRef = {
      id: "athlete-9",
      club_athlete_number: 3,
      first_name: "Marko",
      last_name: "Petrović",
      birth_date: "2010-05-01",
    };

    it.each([
      ["skip", { mode: "skip", row: null }],
      ["create", { mode: "create", row: knownRow }],
    ] as const)("returns the stable %s decision", (decision, expected) => {
      expect(resolveDuplicate(knownRow, existing, decision)).toEqual(expected);
    });

    it("attaches the existing athlete id for update", () => {
      expect(resolveDuplicate(knownRow, existing, "update")).toEqual({
        mode: "update",
        row: { ...knownRow, id: "athlete-9" },
      });
    });
  });

  describe("required fields and header mapping", () => {
    it("reports missing required fields without throwing", () => {
      const result = importRowSchema.safeParse({
        first_name: "",
        last_name: "",
        birth_date: "not-a-date",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.map((issue) => issue.path.join("."))).toEqual(
          expect.arrayContaining(["first_name", "last_name", "birth_date"])
        );
      }
    });

    it("maps case and accent-insensitive headers while retaining unknown warnings", () => {
      expect(mapHeaders(["FIRST NAME", "Prezime", "Datum rođenja", "Shirt"])).toEqual(
        expect.arrayContaining([
          { field: "first_name", header: "FIRST NAME" },
          { field: "last_name", header: "Prezime" },
          { field: "birth_date", header: "Datum rođenja" },
          { field: "", header: "Shirt" },
        ])
      );
    });
  });
});
