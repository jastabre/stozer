import { describe, expect, it } from "vitest";
import {
  deleteEquipmentItem,
  getPlayerEquipmentByTeam,
  issueItemToAthlete,
  itemUsesNumber,
  savePlayerSizes,
  summarizePlayerEquipment,
  transitionItemAssignment,
  type AthleteItemAssignment,
  type EquipmentItem,
} from "@/lib/equipment";

const org = "org-1";
const athlete = "athlete-1";

type MockResult = { data: unknown; error: unknown; count?: number };

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

const catalogItem = (
  id: string,
  name: string,
  top: string | null = "t1",
  bottom: string | null = "t2"
): EquipmentItem => ({
  id,
  organization_id: org,
  name,
  top_piece_type_id: top,
  bottom_piece_type_id: bottom,
  size_mode: top ? (bottom ? "split" : "single") : "none",
  has_number: false,
  sort_order: 1,
  created_at: "",
  updated_at: "",
});

const assignment = (
  athleteId: string,
  itemId: string,
  state: AthleteItemAssignment["state"],
  overrides: Partial<AthleteItemAssignment> = {}
): AthleteItemAssignment => ({
  id: `${athleteId}-${itemId}-${state}`,
  organization_id: org,
  athlete_id: athleteId,
  item_id: itemId,
  state,
  size_top: "XL",
  size_bottom: "L",
  issued_at: state === "issued" ? "2026-01-01T00:00:00Z" : null,
  returned_at: state === "returned" ? "2026-02-01T00:00:00Z" : null,
  note: null,
  number: null,
  created_at: "",
  updated_at: "",
  ...overrides,
});

const athleteRow = (id: string) => ({
  id,
  first_name: `F${id}`,
  last_name: `L${id}`,
  club_athlete_number: 1,
});

describe("summarizePlayerEquipment (article-based)", () => {
  const requiredBoth = new Set(["domaci", "gostujuci"]);

  it("counts every required article as missing when the player has none", () => {
    const summary = summarizePlayerEquipment([], requiredBoth);
    expect(summary.hasRequirements).toBe(true);
    expect(summary.requiredCount).toBe(2);
    expect(summary.missingCount).toBe(2);
    expect(summary.missingItemIds).toEqual(["domaci", "gostujuci"]);
    expect(summary.complete).toBe(false);
  });

  it("marks only the unowned article as missing and stays incomplete", () => {
    const summary = summarizePlayerEquipment(
      [assignment("a1", "domaci", "issued")],
      requiredBoth
    );
    expect(summary.missingCount).toBe(1);
    expect(summary.missingItemIds).toEqual(["gostujuci"]);
    expect(summary.complete).toBe(false);
  });

  it("is complete when every required article is actively assigned", () => {
    const summary = summarizePlayerEquipment(
      [
        assignment("a1", "domaci", "issued"),
        assignment("a1", "gostujuci", "issued"),
      ],
      requiredBoth
    );
    expect(summary.missingCount).toBe(0);
    expect(summary.missingItemIds).toEqual([]);
    expect(summary.complete).toBe(true);
  });

  it("makes a returned required article missing again", () => {
    const summary = summarizePlayerEquipment(
      [
        assignment("a1", "domaci", "issued"),
        assignment("a1", "gostujuci", "returned"),
      ],
      requiredBoth
    );
    expect(summary.missingItemIds).toEqual(["gostujuci"]);
    expect(summary.complete).toBe(false);
  });

  it("does not let an article satisfy another article that shares its parts", () => {
    // Domaći and Gostujući dres both use Match Shirt/Match Shorts (t1/t2).
    // Owning Domaći must NOT satisfy a requirement for Gostujući.
    const items = [
      catalogItem("domaci", "Domaći dres", "t1", "t2"),
      catalogItem("gostujuci", "Gostujući dres", "t1", "t2"),
    ];
    expect(items[0].top_piece_type_id).toBe(items[1].top_piece_type_id);
    expect(items[0].bottom_piece_type_id).toBe(items[1].bottom_piece_type_id);

    const summary = summarizePlayerEquipment(
      [assignment("a1", "domaci", "issued")],
      new Set(["domaci", "gostujuci"])
    );
    expect(summary.missingItemIds).toEqual(["gostujuci"]);
    expect(summary.complete).toBe(false);
  });

  it("supports a required article that has no parts (custom/no-piece item)", () => {
    const summary = summarizePlayerEquipment(
      [assignment("a1", "jakna", "issued")],
      new Set(["jakna"])
    );
    expect(summary.complete).toBe(true);
  });

  it("is neutral when the team has no required articles configured", () => {
    const summary = summarizePlayerEquipment([], new Set());
    expect(summary.hasRequirements).toBe(false);
    expect(summary.complete).toBe(false);
    expect(summary.missingCount).toBe(0);
    expect(summary.issuedCount).toBe(0);
  });

  it("treats lost/damaged articles as not satisfying a requirement", () => {
    const summary = summarizePlayerEquipment(
      [
        assignment("a1", "domaci", "lost"),
        assignment("a1", "gostujuci", "damaged"),
      ],
      requiredBoth
    );
    expect(summary.lostDamagedCount).toBe(2);
    expect(summary.missingCount).toBe(2);
    expect(summary.complete).toBe(false);
  });

  it("counts a required article as covered regardless of its recorded number", () => {
    const withNumber = summarizePlayerEquipment(
      [assignment("a1", "domaci", "issued", { number: "10" })],
      new Set(["domaci"])
    );
    const withoutNumber = summarizePlayerEquipment(
      [assignment("a1", "domaci", "issued", { number: null })],
      new Set(["domaci"])
    );
    expect(withNumber.complete).toBe(true);
    expect(withoutNumber.complete).toBe(true);
  });
});

describe("itemUsesNumber", () => {
  it("returns true when the article supports a number", async () => {
    const supabase = mockSupabase({
      equipment_items: { data: { has_number: true }, error: null },
    });
    expect(await itemUsesNumber(supabase as never, org, "i1")).toBe(true);
  });

  it("returns false when the article does not support a number", async () => {
    const supabase = mockSupabase({
      equipment_items: { data: { has_number: false }, error: null },
    });
    expect(await itemUsesNumber(supabase as never, org, "i1")).toBe(false);
  });
});

describe("savePlayerSizes", () => {
  it("writes every submitted piece including explicit nulls (clearing a size)", async () => {
    const supabase = mockSupabase({
      athlete_equipment: { data: null, error: null },
    });
    const result = await savePlayerSizes(supabase as never, org, athlete, {
      t1: "XL",
      t2: null,
    });
    expect(result).toEqual({ ok: true });
    const upserts = supabase.calls.filter(
      (c) => c.table === "athlete_equipment" && c.chain.some((s) => s.startsWith("upsert:"))
    );
    expect(upserts).toHaveLength(1);
    expect(upserts[0].chain[0]).toContain('"size_value":"XL"');
    expect(upserts[0].chain[0]).toContain('"size_value":null');
  });
});

describe("deleteEquipmentItem guard", () => {
  it("refuses to delete a catalog item that has player assignments", async () => {
    const supabase = mockSupabase({
      athlete_item_assignments: { data: null, error: null, count: 2 },
    });
    const result = await deleteEquipmentItem(supabase as never, org, "i1");
    expect(result).toEqual({
      error: "Artikal ne može biti obrisan jer postoje zaduženja igrača.",
    });
    expect(supabase.calls.some((c) => c.table === "equipment_items")).toBe(false);
  });

  it("deletes when the item has no assignments", async () => {
    const supabase = mockSupabase({
      athlete_item_assignments: { data: null, error: null, count: 0 },
      equipment_items: { data: null, error: null },
    });
    const result = await deleteEquipmentItem(supabase as never, org, "i1");
    expect(result).toEqual({ ok: true });
    expect(supabase.calls.some((c) => c.table === "equipment_items")).toBe(true);
  });
});

describe("catalog issue/transition (00019 model)", () => {
  it("issues a catalog item to a player with sizes and note, then returns it", async () => {
    const supabase = mockSupabase({
      athletes: { data: { id: athlete }, error: null },
      equipment_items: { data: { id: "i1" }, error: null },
      athlete_item_assignments: [
        { data: null, error: null },
        {
          data: {
            id: "a1-i1",
            organization_id: org,
            athlete_id: athlete,
            item_id: "i1",
            state: "issued",
            size_top: "XL",
            size_bottom: "L",
            issued_at: "2026-01-01T00:00:00Z",
            returned_at: null,
            note: "Prva oprema",
            created_at: "",
            updated_at: "",
          },
          error: null,
        },
        { data: null, error: null },
      ],
    });
    const issued = await issueItemToAthlete(
      supabase as never,
      org,
      athlete,
      "i1",
      "XL",
      "L",
      "Prva oprema"
    );
    expect(issued).toEqual({ ok: true });
    const returned = await transitionItemAssignment(
      supabase as never,
      org,
      athlete,
      "i1",
      "returned"
    );
    expect(returned).toEqual({ ok: true });
    const upserts = supabase.calls.filter(
      (c) => c.table === "athlete_item_assignments" && c.chain.some((s) => s.startsWith("upsert:"))
    );
    expect(upserts).toHaveLength(2);
    expect(upserts[0].chain[0]).toContain('"state":"issued"');
    expect(upserts[0].chain[0]).toContain('"note":"Prva oprema"');
    expect(upserts[1].chain[0]).toContain('"state":"returned"');
  });

  it("records the assignment number when issuing an article", async () => {
    const supabase = mockSupabase({
      athletes: { data: { id: athlete }, error: null },
      equipment_items: { data: { id: "i1" }, error: null },
      athlete_item_assignments: { data: null, error: null },
    });
    await issueItemToAthlete(supabase as never, org, athlete, "i1", "XL", "L", null, "10");
    const upserts = supabase.calls.filter(
      (c) =>
        c.table === "athlete_item_assignments" &&
        c.chain.some((s) => s.startsWith("upsert:"))
    );
    expect(upserts).toHaveLength(1);
    expect(upserts[0].chain[0]).toContain('"number":"10"');
  });

  it("lets two players hold the same article with different numbers", async () => {
    const supabase = mockSupabase({
      athletes: [
        { data: { id: "a1" }, error: null },
        { data: { id: "a2" }, error: null },
      ],
      equipment_items: [
        { data: { id: "i1" }, error: null },
        { data: { id: "i1" }, error: null },
      ],
      athlete_item_assignments: [
        { data: null, error: null },
        { data: null, error: null },
      ],
    });
    await issueItemToAthlete(supabase as never, org, "a1", "i1", null, null, null, "10");
    await issueItemToAthlete(supabase as never, org, "a2", "i1", null, null, null, "7");
    const payloads = supabase.calls
      .filter(
        (c) =>
          c.table === "athlete_item_assignments" &&
          c.chain.some((s) => s.startsWith("upsert:"))
      )
      .map((c) => c.chain[0]);
    expect(payloads).toHaveLength(2);
    expect(payloads[0]).toContain('"athlete_id":"a1"');
    expect(payloads[0]).toContain('"number":"10"');
    expect(payloads[1]).toContain('"athlete_id":"a2"');
    expect(payloads[1]).toContain('"number":"7"');
  });

  it("preserves the recorded number across a state transition", async () => {
    const supabase = mockSupabase({
      athlete_item_assignments: [
        {
          data: {
            id: "x",
            organization_id: org,
            athlete_id: athlete,
            item_id: "i1",
            state: "issued",
            size_top: "XL",
            size_bottom: "L",
            number: "10",
            issued_at: null,
            returned_at: null,
            note: null,
            created_at: "",
            updated_at: "",
          },
          error: null,
        },
        { data: null, error: null },
      ],
    });
    await transitionItemAssignment(supabase as never, org, athlete, "i1", "returned");
    const upserts = supabase.calls.filter(
      (c) =>
        c.table === "athlete_item_assignments" &&
        c.chain.some((s) => s.startsWith("upsert:"))
    );
    expect(upserts).toHaveLength(1);
    expect(upserts[0].chain[0]).toContain('"state":"returned"');
    expect(upserts[0].chain[0]).not.toContain("number");
  });

  it("getPlayerEquipmentByTeam filters players by team and counts issued/missing", async () => {
    const supabase = mockSupabase({
      equipment_items: { data: [catalogItem("i1", "Domaci dres"), catalogItem("i2", "Jakna", null, null)], error: null },
      athlete_item_assignments: {
        data: [
          { id: "a1-i1", organization_id: org, athlete_id: "a1", item_id: "i1", state: "issued", size_top: "XL", size_bottom: "L", issued_at: null, returned_at: null, note: null, created_at: "", updated_at: "" },
        ],
        error: null,
      },
      seasonal_memberships: {
        data: [
          { athlete_id: "a1", team_id: "team-1", jersey_number: 7, jersey_name: null },
          { athlete_id: "a2", team_id: "team-2", jersey_number: 9, jersey_name: null },
        ],
        error: null,
      },
      athletes: { data: [athleteRow("a1"), athleteRow("a2")], error: null },
    });
    const rows = await getPlayerEquipmentByTeam(supabase as never, org, "team-1", "season-1");
    expect(rows.map((r) => r.athlete_id)).toEqual(["a1"]);
    expect(rows[0].jersey_number).toBe(7);
    expect(rows[0].issuedCount).toBe(1);
    expect(rows[0].missingCount).toBe(1);
  });
});
