import { describe, expect, it } from "vitest";
import {
  isJerseyNumberUniqueViolation,
  jerseyNumberTaken,
  jerseyNumberTakenMessage,
} from "@/lib/jersey-number";
import { createAthlete, type Supabase } from "@/lib/club-data";

interface MembershipRow {
  id: string;
  organization_id: string;
  season_id: string;
  team_id: string;
  athlete_id: string;
  jersey_number: number | null;
  status: string;
}

const activeMembership = (over: Partial<MembershipRow> = {}): MembershipRow => ({
  id: "m1",
  organization_id: "org-1",
  season_id: "s1",
  team_id: "t1",
  athlete_id: "a1",
  jersey_number: 10,
  status: "active",
  ...over,
});

/**
 * Applies the eq/neq filters the helper issues against an in-memory row set,
 * so the scoping semantics (same season + same team + same number + active)
 * are actually exercised rather than just recording calls.
 */
function membershipStore(rows: MembershipRow[]) {
  const filters: Array<{ column: string; value: unknown }> = [];
  let exclude: { column: string; value: unknown } | null = null;
  const builder: Record<string, unknown> = {
    select: () => builder,
    eq: (column: string, value: unknown) => {
      filters.push({ column, value });
      return builder;
    },
    neq: (column: string, value: unknown) => {
      exclude = { column, value };
      return builder;
    },
    limit: () => builder,
    then: (resolve: (value: unknown) => void) => {
      const data = rows.filter(
        (row) =>
          filters.every((f) => row[f.column as keyof MembershipRow] === f.value) &&
          (!exclude || row[exclude.column as keyof MembershipRow] !== exclude.value)
      );
      resolve({ data, error: null });
    },
  };
  return { from: () => builder } as unknown as Supabase;
}

describe("jerseyNumberTakenMessage", () => {
  it("produces the Serbian message", () => {
    expect(jerseyNumberTakenMessage(10, "sr")).toBe(
      "Broj 10 je već dodeljen drugom igraču u ovom timu."
    );
  });

  it("produces the English message", () => {
    expect(jerseyNumberTakenMessage(10, "en")).toBe(
      "Number 10 is already assigned to another player in this team."
    );
  });
});

describe("isJerseyNumberUniqueViolation", () => {
  it("detects the jersey unique violation by code and index name", () => {
    expect(
      isJerseyNumberUniqueViolation({
        code: "23505",
        message:
          'duplicate key value violates unique constraint "seasonal_memberships_active_team_jersey_unique"',
      })
    ).toBe(true);
  });

  it("does not mask a different 23505 (e.g. the season+athlete unique)", () => {
    expect(
      isJerseyNumberUniqueViolation({
        code: "23505",
        message:
          'duplicate key value violates unique constraint "seasonal_memberships_season_id_athlete_id_key"',
      })
    ).toBe(false);
  });

  it("ignores non-23505 errors and null", () => {
    expect(isJerseyNumberUniqueViolation({ code: "23502", message: "not null" })).toBe(false);
    expect(isJerseyNumberUniqueViolation(null)).toBe(false);
    expect(isJerseyNumberUniqueViolation(undefined)).toBe(false);
  });
});

describe("jerseyNumberTaken", () => {
  it("same season + same team + same number (other athlete) is a conflict", async () => {
    const supabase = membershipStore([activeMembership({ athlete_id: "a2" })]);
    await expect(
      jerseyNumberTaken(supabase, {
        organizationId: "org-1",
        seasonId: "s1",
        teamId: "t1",
        jerseyNumber: 10,
      })
    ).resolves.toBe(true);
  });

  it("same season + different team is allowed", async () => {
    const supabase = membershipStore([activeMembership({ team_id: "t2" })]);
    await expect(
      jerseyNumberTaken(supabase, {
        organizationId: "org-1",
        seasonId: "s1",
        teamId: "t1",
        jerseyNumber: 10,
      })
    ).resolves.toBe(false);
  });

  it("different season + same team is allowed", async () => {
    const supabase = membershipStore([activeMembership({ season_id: "s2" })]);
    await expect(
      jerseyNumberTaken(supabase, {
        organizationId: "org-1",
        seasonId: "s1",
        teamId: "t1",
        jerseyNumber: 10,
      })
    ).resolves.toBe(false);
  });

  it("a non-active (moved) membership does not block reuse", async () => {
    const supabase = membershipStore([activeMembership({ status: "moved" })]);
    await expect(
      jerseyNumberTaken(supabase, {
        organizationId: "org-1",
        seasonId: "s1",
        teamId: "t1",
        jerseyNumber: 10,
      })
    ).resolves.toBe(false);
  });

  it("excludes the athlete being edited so an edit never conflicts with itself", async () => {
    const supabase = membershipStore([activeMembership({ athlete_id: "a1" })]);
    await expect(
      jerseyNumberTaken(supabase, {
        organizationId: "org-1",
        seasonId: "s1",
        teamId: "t1",
        jerseyNumber: 10,
        excludeAthleteId: "a1",
      })
    ).resolves.toBe(false);
  });
});

describe("createAthlete jersey uniqueness", () => {
  type Result = { data: unknown; error: unknown };

  function fakeSupabase(queue: Record<string, Result[]>): Supabase {
    const make = (table: string): unknown =>
      new Proxy(function () {}, {
        get(_target, prop: string) {
          if (prop === "then") {
            return (resolve: (v: unknown) => void) => {
              const list = queue[table];
              resolve(list && list.length > 0 ? list.shift() : { data: null, error: null });
            };
          }
          return () => make(table);
        },
      });
    return { from: (table: string) => make(table) } as unknown as Supabase;
  }

  it("rejects a duplicate jersey number before claiming a counter value", async () => {
    const supabase = fakeSupabase({
      teams: [{ data: { id: "team-1" }, error: null }],
      seasonal_memberships: [{ data: [{ id: "m1" }], error: null }],
    });

    const result = await createAthlete(supabase, "org-1", {
      first_name: "Petar",
      last_name: "Petrović",
      birth_date: "2010-01-01",
      team_id: "team-1",
      seasonId: "season-1",
      jersey_number: 10,
    });

    expect(result).toEqual({
      error: "Broj 10 je već dodeljen drugom igraču u ovom timu.",
    });
  });
});
