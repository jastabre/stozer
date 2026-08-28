import { describe, expect, it } from "vitest";
import {
  getPlayerEquipmentOverview,
  transitionAthleteItem,
  type AthleteEquipmentItem,
  type EquipmentType,
  type EquipmentFilter,
} from "@/lib/equipment";
import type { EquipmentItemState } from "@/types/database";

const org = "org-1";
const athlete = "athlete-1";
const typeId = "type-1";

type MockResult = { data: unknown; error: unknown };

class MockQuery {
  chain: string[] = [];
  constructor(
    private table: string,
    private result: MockResult,
    private calls: { table: string; chain: string[] }[]
  ) {}
  select(..._args: unknown[]) {
    return this;
  }
  eq(...args: unknown[]) {
    this.chain.push(`eq:${args.join("=")}`);
    return this;
  }
  in(...args: unknown[]) {
    this.chain.push(`in:${args.join("=")}`);
    return this;
  }
  order(..._args: unknown[]) {
    return this;
  }
  maybeSingle() {
    return this;
  }
  single() {
    return this;
  }
  upsert(payload: unknown, _opts?: unknown) {
    this.chain.push(`upsert:${JSON.stringify(payload)}`);
    return this;
  }
  insert(..._args: unknown[]) {
    return this;
  }
  update(..._args: unknown[]) {
    return this;
  }
  delete(..._args: unknown[]) {
    return this;
  }
  then<T>(onFulfilled?: (v: MockResult) => T, onRejected?: (e: unknown) => T): Promise<T> {
    this.calls.push({ table: this.table, chain: [...this.chain] });
    return Promise.resolve(this.result).then(onFulfilled, onRejected);
  }
}

function mockSupabase(config: Record<string, MockResult | MockResult[]>) {
  const calls: { table: string; chain: string[] }[] = [];
  const from = (table: string) => {
    const cfg = config[table];
    const result = Array.isArray(cfg) ? cfg.shift() as MockResult : cfg as MockResult;
    return new MockQuery(table, result, calls);
  };
  return { from, calls };
}

const equipmentType = (id: string, name: string): EquipmentType => ({
  id,
  organization_id: org,
  name,
  size_model: "single",
  enabled: true,
  is_club_property: true,
  sort_order: 1,
  created_at: "",
  updated_at: "",
});

const item = (
  athleteId: string,
  equipmentTypeId: string,
  state: EquipmentItemState
): AthleteEquipmentItem => ({
  id: `${athleteId}-${equipmentTypeId}-${state}`,
  organization_id: org,
  athlete_id: athleteId,
  equipment_type_id: equipmentTypeId,
  size_value: "M",
  size_value_upper: null,
  state,
  issued_at: state === "issued" ? "2026-01-01T00:00:00Z" : null,
  returned_at: state === "returned" ? "2026-02-01T00:00:00Z" : null,
  note: null,
  created_at: "",
  updated_at: "",
});

const membership = (athleteId: string, jersey: number | null) => ({
  athlete_id: athleteId,
  team_id: "team-1",
  jersey_number: jersey,
  athletes: {
    first_name: `F${athleteId}`,
    last_name: `L${athleteId}`,
    club_athlete_number: 1,
  },
});

const TYPES = [equipmentType("t1", "Match Kit"), equipmentType("t2", "Tracksuit")];

function transitionMock(existing: AthleteEquipmentItem | null) {
  return mockSupabase({
    athletes: { data: { id: athlete }, error: null },
    equipment_types: { data: { id: typeId }, error: null },
    athlete_equipment: [
      existing ? { data: existing, error: null } : { data: null, error: null },
      { data: null, error: null },
    ],
  });
}

function upsertCalls(supabase: ReturnType<typeof mockSupabase>) {
  return supabase.calls.filter(
    (c) => c.table === "athlete_equipment" && c.chain.some((s) => s.startsWith("upsert:"))
  );
}

describe("transitionAthleteItem (STRC-04)", () => {
  it.each([
    ["issued", "missing"],
    ["returned", "lost"],
    ["returned", "damaged"],
    ["returned", "missing"],
    ["lost", "returned"],
    ["lost", "damaged"],
    ["lost", "missing"],
    ["damaged", "lost"],
    ["damaged", "returned"],
    ["damaged", "missing"],
    ["missing", "returned"],
    ["missing", "lost"],
    ["missing", "damaged"],
  ] as const)(
    "rejects %s -> %s with an error and never calls upsert",
    async (current, next) => {
      const supabase = transitionMock(item(athlete, typeId, current));
      const result = await transitionAthleteItem(supabase as never, org, athlete, typeId, next);
      expect(result).toEqual({
        error: `Invalid equipment transition: ${current} -> ${next}`,
      });
      expect(upsertCalls(supabase)).toHaveLength(0);
    }
  );

  it("treats an absent row as missing and rejects missing -> returned without upsert", async () => {
    const supabase = transitionMock(null);
    const result = await transitionAthleteItem(supabase as never, org, athlete, typeId, "returned");
    expect(result).toEqual({ error: "Invalid equipment transition: missing -> returned" });
    expect(upsertCalls(supabase)).toHaveLength(0);
  });

  it.each([
    [null, "issued"],
    ["missing", "issued"],
    ["issued", "returned"],
    ["issued", "lost"],
    ["issued", "damaged"],
    ["returned", "issued"],
    ["lost", "issued"],
    ["damaged", "issued"],
  ] as const)("accepts %s -> %s and upserts the new state", async (current, next) => {
    const supabase = transitionMock(current ? item(athlete, typeId, current) : null);
    const result = await transitionAthleteItem(supabase as never, org, athlete, typeId, next);
    expect(result).toEqual({ ok: true });
    const upserts = upsertCalls(supabase);
    expect(upserts).toHaveLength(1);
    expect(upserts[0].chain[0]).toContain(`"state":"${next}"`);
  });
});

describe("getPlayerEquipmentOverview (STRC-04)", () => {
  async function overview(
    supabase: ReturnType<typeof mockSupabase>,
    filter?: EquipmentFilter
  ) {
    return getPlayerEquipmentOverview(supabase as never, org, undefined, "season-1", filter);
  }

  it("marks an athlete complete when every enabled type is issued", async () => {
    const supabase = mockSupabase({
      equipment_types: { data: TYPES, error: null },
      seasonal_memberships: { data: [membership("a1", 10)], error: null },
      athlete_equipment: {
        data: [item("a1", "t1", "issued"), item("a1", "t2", "issued")],
        error: null,
      },
    });
    const o = await overview(supabase);
    expect(o.rows).toHaveLength(1);
    expect(o.rows[0].summary).toEqual({
      complete: true,
      missing: false,
      not_issued: false,
      lost_or_damaged: false,
    });
    expect(o.counts).toEqual({ complete: 1, missing: 0, not_issued: 0, lost_damaged: 0 });
  });

  it("materializes an absent row for an enabled type as missing", async () => {
    const supabase = mockSupabase({
      equipment_types: { data: TYPES, error: null },
      seasonal_memberships: { data: [membership("a1", 10)], error: null },
      athlete_equipment: { data: [], error: null },
    });
    const o = await overview(supabase);
    expect(o.rows[0].items).toHaveLength(2);
    expect(o.rows[0].items.every((it) => it.state === "missing")).toBe(true);
    expect(o.rows[0].items.every((it) => it.id.startsWith("missing:"))).toBe(true);
    expect(o.rows[0].summary.missing).toBe(true);
    expect(o.counts.missing).toBe(1);
  });

  it("sets lost_or_damaged from a lost row and never reads it as complete", async () => {
    const supabase = mockSupabase({
      equipment_types: { data: TYPES, error: null },
      seasonal_memberships: { data: [membership("a1", 10)], error: null },
      athlete_equipment: {
        data: [item("a1", "t1", "lost"), item("a1", "t2", "issued")],
        error: null,
      },
    });
    const o = await overview(supabase);
    expect(o.rows[0].summary.lost_or_damaged).toBe(true);
    expect(o.rows[0].summary.complete).toBe(false);
    expect(o.counts.lost_damaged).toBe(1);
    expect(o.counts.complete).toBe(0);
  });

  it("counts a returned row as not issued (and not as missing)", async () => {
    const supabase = mockSupabase({
      equipment_types: { data: TYPES, error: null },
      seasonal_memberships: { data: [membership("a1", 10)], error: null },
      athlete_equipment: {
        data: [item("a1", "t1", "returned"), item("a1", "t2", "issued")],
        error: null,
      },
    });
    const o = await overview(supabase);
    expect(o.rows[0].summary.not_issued).toBe(true);
    expect(o.rows[0].summary.missing).toBe(false);
    expect(o.counts.not_issued).toBe(1);
    expect(o.counts.complete).toBe(0);
  });

  it("derives counts that agree with per-athlete summary flags", async () => {
    const supabase = mockSupabase({
      equipment_types: { data: TYPES, error: null },
      seasonal_memberships: {
        data: [membership("a1", 10), membership("a2", 9), membership("a3", 8)],
        error: null,
      },
      athlete_equipment: {
        data: [
          item("a1", "t1", "issued"),
          item("a1", "t2", "issued"),
          item("a3", "t1", "lost"),
          item("a3", "t2", "issued"),
        ],
        error: null,
      },
    });
    const o = await overview(supabase);
    expect(o.rows).toHaveLength(3);
    expect(o.counts).toEqual({ complete: 1, missing: 1, not_issued: 1, lost_damaged: 1 });
  });

  it("filters rows down to the matching summary flag", async () => {
    const supabase = mockSupabase({
      equipment_types: { data: TYPES, error: null },
      seasonal_memberships: {
        data: [membership("a1", 10), membership("a2", 9), membership("a3", 8)],
        error: null,
      },
      athlete_equipment: {
        data: [
          item("a1", "t1", "issued"),
          item("a1", "t2", "issued"),
          item("a3", "t1", "lost"),
          item("a3", "t2", "issued"),
        ],
        error: null,
      },
    });
    expect((await overview(supabase, "complete")).rows.map((r) => r.athlete_id)).toEqual(["a1"]);
    expect((await overview(supabase, "missing")).rows.map((r) => r.athlete_id)).toEqual(["a2"]);
    expect((await overview(supabase, "lost_damaged")).rows.map((r) => r.athlete_id)).toEqual([
      "a3",
    ]);
  });
});