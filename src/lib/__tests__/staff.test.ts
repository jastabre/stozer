import { describe, expect, it } from "vitest";
import { addDays, subDays, differenceInCalendarDays } from "date-fns";
import { listStaff, upsertStaffLicenses } from "@/lib/staff";

const org = "org-1";

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
  upsert(..._args: unknown[]) {
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

const staffRow = {
  id: "staff-1",
  organization_id: org,
  user_id: "user-1",
  role: "coach",
  first_name: "Ana",
  last_name: "Trener",
  photo_url: null,
  phone: null,
  email: null,
  title: null,
  start_date: null,
  end_date: null,
  notes: null,
};

const activeSeason = {
  id: "s1",
  organization_id: org,
  name: "2026/27",
  starts_on: "2026-08-01",
  ends_on: null,
  is_active: true,
};

const baseConfig: Record<string, MockResult> = {
  seasons: { data: activeSeason, error: null },
  staff: { data: [staffRow], error: null },
  staff_teams: { data: [], error: null },
  staff_licenses: { data: [], error: null },
};

function staffQueryChain(supabase: ReturnType<typeof mockSupabase>) {
  const record = supabase.calls.find((c) => c.table === "staff");
  return record?.chain ?? [];
}

describe("listStaff coach self-scope (STRC-06)", () => {
  it("scopes the staff query to user_id when the viewer role is coach", async () => {
    const supabase = mockSupabase(baseConfig);
    await listStaff(supabase as never, org, { role: "coach", userId: "user-1" });
    expect(staffQueryChain(supabase)).toContain("eq:user_id=user-1");
  });

  it("scopes via the userRole shape too (OrganizationContext surface)", async () => {
    const supabase = mockSupabase(baseConfig);
    await listStaff(supabase as never, org, { userRole: "coach", userId: "user-2" });
    expect(staffQueryChain(supabase)).toContain("eq:user_id=user-2");
  });

  it("does not scope a coach viewer without a userId", async () => {
    const supabase = mockSupabase(baseConfig);
    await listStaff(supabase as never, org, { role: "coach" });
    expect(staffQueryChain(supabase).some((s) => s.startsWith("eq:user_id"))).toBe(false);
  });

  it("does not scope a non-coach viewer even with a userId", async () => {
    const supabase = mockSupabase(baseConfig);
    await listStaff(supabase as never, org, { role: "club_president", userId: "user-3" });
    expect(staffQueryChain(supabase).some((s) => s.startsWith("eq:user_id"))).toBe(false);
  });

  it("does not scope when no viewer is provided", async () => {
    const supabase = mockSupabase(baseConfig);
    await listStaff(supabase as never, org);
    expect(staffQueryChain(supabase).some((s) => s.startsWith("eq:user_id"))).toBe(false);
  });

  it("does not scope a viewer that has only a userId and no coach role", async () => {
    const supabase = mockSupabase(baseConfig);
    await listStaff(supabase as never, org, { userId: "user-4" });
    expect(staffQueryChain(supabase).some((s) => s.startsWith("eq:user_id"))).toBe(false);
  });
});

describe("listStaff license tones and days_left (STRC-06)", () => {
  const localDate = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  it("derives status tones and days_left from valid_until with the shared threshold", async () => {
    const now = new Date();
    const licenses = [
      { id: "l1", organization_id: org, staff_id: "staff-1", license_type: "expired", license_number: null, valid_until: localDate(subDays(now, 10)), created_at: "", updated_at: "" },
      { id: "l2", organization_id: org, staff_id: "staff-1", license_type: "expiring", license_number: null, valid_until: localDate(addDays(now, 15)), created_at: "", updated_at: "" },
      { id: "l3", organization_id: org, staff_id: "staff-1", license_type: "future", license_number: null, valid_until: localDate(addDays(now, 90)), created_at: "", updated_at: "" },
      { id: "l4", organization_id: org, staff_id: "staff-1", license_type: "boundary", license_number: null, valid_until: localDate(addDays(now, 30)), created_at: "", updated_at: "" },
    ];
    const supabase = mockSupabase({ ...baseConfig, staff_licenses: { data: licenses, error: null } });
    const people = await listStaff(supabase as never, org, undefined, 30);
    expect(people).toHaveLength(1);
    const byType = new Map(people[0].licenses.map((l) => [l.license_type, l]));

    expect(byType.get("expired")?.status).toBe("red");
    expect(byType.get("expiring")?.status).toBe("yellow");
    expect(byType.get("future")?.status).toBe("green");
    expect(byType.get("boundary")?.status).toBe("yellow");

    for (const l of people[0].licenses) {
      const expiry = new Date(`${l.valid_until}T00:00:00`);
      expect(l.days_left).toBe(differenceInCalendarDays(expiry, now));
    }
  });
});

describe("upsertStaffLicenses org-boundary check (STRC-06)", () => {
  it("returns an error object instead of throwing when the profile is not in the org", async () => {
    const supabase = mockSupabase({ staff: { data: null, error: null } });
    let result: { ok: true } | { error: string } | undefined;
    let threw = false;
    try {
      result = await upsertStaffLicenses(supabase as never, org, "staff-999", [
        { license_type: "UEFA A", license_number: "X-1", valid_until: "2027-01-01" },
      ]);
    } catch (e) {
      threw = true;
    }
    expect(threw).toBe(false);
    expect(result).toEqual({ error: "Profil osoblja nije pronađen u organizaciji" });
    expect(supabase.calls.filter((c) => c.table === "staff_licenses")).toHaveLength(0);
  });
});