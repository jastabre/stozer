import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/organization", () => ({
  requireOrganization: vi.fn(),
  hasPermission: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({
  createServerClient: vi.fn(async () => ({}) as never),
}));
vi.mock("@/lib/club-data", () => ({
  getActiveSeason: vi.fn(async () => ({ id: "season-1" })),
}));

import { revalidatePath } from "next/cache";
import { hasPermission, requireOrganization } from "@/lib/organization";
import { createServerClient } from "@/lib/supabase/server";
import { addPlayerToTeam } from "../actions";

const ORG_ID = "org-1";
const USER_ID = "user-1";

type Result = { data: unknown; error: unknown };

function fakeClient(queue: Record<string, Result[]>) {
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
  return { from: (table: string) => make(table) } as never;
}

function addForm() {
  const fd = new FormData();
  fd.set("team_id", "team-1");
  fd.set("athlete_id", "athlete-a");
  fd.set("jersey_number", "10");
  return fd;
}

beforeEach(() => {
  vi.mocked(requireOrganization).mockResolvedValue({
    organizationId: ORG_ID,
    userRole: "club_president",
    userId: USER_ID,
  } as never);
  vi.mocked(hasPermission).mockResolvedValue(true as never);
  vi.mocked(revalidatePath).mockReset();
});

describe("addPlayerToTeam jersey uniqueness", () => {
  it("rejects a jersey number already used by another active player in the team", async () => {
    vi.mocked(createServerClient).mockResolvedValue(
      fakeClient({
        teams: [{ data: { id: "team-1" }, error: null }],
        athletes: [{ data: { id: "athlete-a" }, error: null }],
        seasonal_memberships: [
          { data: null, error: null }, // existing membership check
          { data: [{ id: "m1" }], error: null }, // jersey conflict
        ],
      })
    );

    const state = await addPlayerToTeam(null, addForm());
    expect(state).toEqual({
      error: "Broj 10 je već dodeljen drugom igraču u ovom timu.",
    });
  });

  it("allows players with no jersey number (NULL)", async () => {
    vi.mocked(createServerClient).mockResolvedValue(
      fakeClient({
        teams: [{ data: { id: "team-1" }, error: null }],
        athletes: [{ data: { id: "athlete-a" }, error: null }],
        seasonal_memberships: [
          { data: null, error: null }, // existing membership check
          { data: null, error: null }, // insert succeeds
        ],
      })
    );

    const fd = new FormData();
    fd.set("team_id", "team-1");
    fd.set("athlete_id", "athlete-a");

    const state = await addPlayerToTeam(null, fd);
    expect(state).toEqual({ ok: true });
  });

  it("maps a race-time 23505 to the friendly message, never the raw code", async () => {
    vi.mocked(createServerClient).mockResolvedValue(
      fakeClient({
        teams: [{ data: { id: "team-1" }, error: null }],
        athletes: [{ data: { id: "athlete-a" }, error: null }],
        seasonal_memberships: [
          { data: null, error: null }, // existing membership check
          { data: [], error: null }, // no pre-check conflict
          {
            data: null,
            error: {
              code: "23505",
              message:
                'duplicate key value violates unique constraint "seasonal_memberships_active_team_jersey_unique"',
            },
          }, // insert hits the unique index under race
        ],
      })
    );

    const state = await addPlayerToTeam(null, addForm());
    expect(state).toEqual({
      error: "Broj 10 je već dodeljen drugom igraču u ovom timu.",
    });
  });
});
