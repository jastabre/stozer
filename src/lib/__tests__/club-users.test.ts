import { describe, expect, it, vi } from "vitest";
import {
  addOrgAccount,
  setAccountDisabled,
  updateUserAccess,
} from "@/lib/club-users";

/**
 * Backend guards for the user-administration flows: RLS is bypassed by the
 * service-role client used in club-users.ts, so these functions ARE the
 * backend enforcement. They must refuse self-edits, the last president and
 * cross-club conflicts before any write is issued.
 */
const holder = vi.hoisted(() => ({ client: null as unknown }));

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => holder.client,
}));

type Result = { data: unknown; error: unknown; count?: number };

class FakeQuery {
  constructor(private queue: Result[]) {}
  private next(): Result {
    return this.queue.length > 1 ? (this.queue.shift() as Result) : this.queue[0];
  }
  select() {
    return this;
  }
  update() {
    return this;
  }
  insert() {
    return this;
  }
  upsert() {
    return this;
  }
  delete() {
    return this;
  }
  eq() {
    return this;
  }
  neq() {
    return this;
  }
  is() {
    return this;
  }
  order() {
    return this;
  }
  limit() {
    return this;
  }
  maybeSingle() {
    return Promise.resolve(this.next());
  }
  single() {
    return Promise.resolve(this.next());
  }
  then(res?: (value: Result) => unknown, rej?: (reason: unknown) => unknown) {
    return Promise.resolve(this.next()).then(res, rej);
  }
}

interface AuthMocks {
  listUsers?: ReturnType<typeof vi.fn>;
  getUserById?: ReturnType<typeof vi.fn>;
  updateUserById?: ReturnType<typeof vi.fn>;
  inviteUserByEmail?: ReturnType<typeof vi.fn>;
}

const defaultAuth = (): Required<AuthMocks> => ({
  listUsers: vi.fn(async () => ({ data: { users: [] }, error: null })),
  getUserById: vi.fn(async () => ({
    data: { user: { id: "user-1", app_metadata: {} } },
    error: null,
  })),
  updateUserById: vi.fn(async () => ({
    data: { user: { app_metadata: {} } },
    error: null,
  })),
  inviteUserByEmail: vi.fn(async () => ({
    data: {
      user: {
        id: "invited-1",
        email: "novi@klub.rs",
        invited_at: "2026-09-01T00:00:00.000Z",
        email_confirmed_at: null,
      },
    },
    error: null,
  })),
});

function setUp(
  config: Record<string, Result | Result[]>,
  auth: Required<AuthMocks> = defaultAuth()
) {
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key";
  process.env.NEXT_PUBLIC_SUPABASE_URL = "http://localhost";
  // Queues are per TABLE and shared across `.from(table)` calls, so repeated
  // queries against the same table consume their configured results in order.
  const queues: Record<string, Result[]> = {};
  for (const [table, value] of Object.entries(config)) {
    queues[table] = Array.isArray(value) ? [...value] : [value];
  }
  holder.client = {
    from: (table: string) =>
      new FakeQuery(queues[table] ?? [{ data: null, error: null }]),
    auth: { admin: auth },
  };
  return auth;
}

const ORG = "org-1";
const ACTOR = "actor-1";
const TARGET = "target-1";

describe("setAccountDisabled", () => {
  it("refuses to deactivate the caller's own account", async () => {
    setUp({});
    const result = await setAccountDisabled(ORG, TARGET, TARGET, true);
    expect(result).toEqual({ error: "Ne možete deaktivirati sopstveni nalog." });
  });

  it("refuses to deactivate the last remaining president", async () => {
    const auth = setUp({
      organization_memberships: [
        { data: { id: "m1", role: "club_president" }, error: null },
        { data: null, error: null, count: 1 },
      ],
    });
    const result = await setAccountDisabled(ORG, ACTOR, TARGET, true);
    expect(result).toEqual({
      error: "Poslednji administrator kluba ne može biti deaktiviran.",
    });
    expect(auth.updateUserById).not.toHaveBeenCalled();
  });

  it("bans the account on deactivate and unbans on reactivate", async () => {
    const auth = setUp({
      organization_memberships: [
        { data: { id: "m1", role: "admin_finance" }, error: null },
      ],
    });
    await setAccountDisabled(ORG, ACTOR, TARGET, true);
    expect(auth.updateUserById).toHaveBeenCalledWith(TARGET, {
      ban_duration: "876000h",
    });

    const auth2 = setUp({
      organization_memberships: [
        { data: { id: "m1", role: "admin_finance" }, error: null },
      ],
    });
    await setAccountDisabled(ORG, ACTOR, TARGET, false);
    expect(auth2.updateUserById).toHaveBeenCalledWith(TARGET, {
      ban_duration: "none",
    });
  });
});

describe("updateUserAccess", () => {
  it("rejects roles outside the assignable set", async () => {
    setUp({});
    const result = await updateUserAccess(ORG, ACTOR, {
      userId: TARGET,
      role: "super_admin" as never,
      teamIds: [],
      seasonId: null,
    });
    expect(result).toEqual({ error: "Izabrana uloga nije dostupna" });
  });

  it("refuses to change the caller's own access", async () => {
    setUp({});
    const result = await updateUserAccess(ORG, ACTOR, {
      userId: ACTOR,
      role: "coach",
      teamIds: [],
      seasonId: null,
    });
    expect(result).toEqual({ error: "Ne možete menjati sopstveni pristup" });
  });

  it("refuses to demote the last president", async () => {
    setUp({
      organization_memberships: [
        { data: { id: "m1", role: "club_president" }, error: null },
        { data: null, error: null, count: 1 },
      ],
    });
    const result = await updateUserAccess(ORG, ACTOR, {
      userId: TARGET,
      role: "coach",
      teamIds: [],
      seasonId: null,
    });
    expect(result).toEqual({
      error: "Poslednji administrator kluba ne može promeniti ulogu.",
    });
  });

  it("writes membership, linked staff and JWT claims together", async () => {
    const auth = setUp({
      organization_memberships: [{ data: { id: "m1", role: "coach" }, error: null }],
      staff: [{ data: { id: "s1" }, error: null }],
    });
    const result = await updateUserAccess(ORG, ACTOR, {
      userId: TARGET,
      role: "equipment_manager",
      teamIds: [],
      seasonId: null,
    });
    expect(result).toEqual({ ok: true });
    expect(auth.updateUserById).toHaveBeenCalledWith(
      TARGET,
      expect.objectContaining({
        app_metadata: expect.objectContaining({
          organization_id: ORG,
          user_role: "equipment_manager",
        }),
      })
    );
  });
});

describe("addOrgAccount", () => {
  const staffRow = { id: "s1", user_id: null };

  it("rejects a person that does not exist in the club", async () => {
    setUp({ staff: { data: null, error: null } });
    const result = await addOrgAccount(ORG, {
      staffId: "s1",
      email: "a@b.rs",
      role: "coach",
      teamIds: [],
      seasonId: null,
    });
    expect(result).toEqual({ error: "Osoba nije pronađena u klubu" });
  });

  it("rejects a staff profile that already has an account", async () => {
    setUp({ staff: { data: { id: "s1", user_id: "u1" }, error: null } });
    const result = await addOrgAccount(ORG, {
      staffId: "s1",
      email: "a@b.rs",
      role: "coach",
      teamIds: [],
      seasonId: null,
    });
    expect(result).toEqual({ error: "Ova osoba već ima Stožer nalog." });
  });

  it("rejects an email that belongs to another club", async () => {
    const auth = setUp({
      staff: [{ data: staffRow, error: null }],
      organization_memberships: [
        { data: [{ organization_id: "other-org" }], error: null },
      ],
    });
    auth.listUsers.mockResolvedValue({
      data: { users: [{ id: "u2", email: "a@b.rs", email_confirmed_at: "x" }] },
      error: null,
    });
    const result = await addOrgAccount(ORG, {
      staffId: "s1",
      email: "a@b.rs",
      role: "coach",
      teamIds: [],
      seasonId: null,
    });
    expect(result).toEqual({
      error: "Ovaj email je već povezan sa drugim klubom.",
    });
  });

  it("rejects an account linked to a staff profile in another club", async () => {
    const auth = setUp({
      staff: [
        { data: staffRow, error: null },
        { data: [{ id: "foreign-staff" }], error: null },
      ],
      organization_memberships: [{ data: [], error: null }],
    });
    auth.listUsers.mockResolvedValue({
      data: { users: [{ id: "u2", email: "a@b.rs", email_confirmed_at: "x" }] },
      error: null,
    });
    const result = await addOrgAccount(ORG, {
      staffId: "s1",
      email: "a@b.rs",
      role: "coach",
      teamIds: [],
      seasonId: null,
    });
    expect(result).toEqual({
      error: "Ovaj email je već povezan sa drugim klubom.",
    });
  });

  it("rejects an account already linked to another staff profile in this club", async () => {
    const auth = setUp({
      staff: [
        { data: staffRow, error: null },
        { data: [], error: null },
        { data: [{ id: "other-staff" }], error: null },
      ],
      organization_memberships: [{ data: [], error: null }],
    });
    auth.listUsers.mockResolvedValue({
      data: { users: [{ id: "u2", email: "a@b.rs", email_confirmed_at: "x" }] },
      error: null,
    });
    const result = await addOrgAccount(ORG, {
      staffId: "s1",
      email: "a@b.rs",
      role: "coach",
      teamIds: [],
      seasonId: null,
    });
    expect(result).toEqual({
      error: "Ovaj korisnik već ima Stožer nalog u ovom klubu.",
    });
  });

  it("invites an unknown email and links it as invited", async () => {
    const auth = setUp({
      staff: [
        { data: staffRow, error: null },
        { data: null, error: null },
        { data: null, error: null },
        { data: null, error: null },
      ],
      organization_memberships: [
        { data: null, error: null },
        { data: null, error: null },
      ],
    });
    const result = await addOrgAccount(ORG, {
      staffId: "s1",
      email: "novi@klub.rs",
      role: "equipment_manager",
      teamIds: [],
      seasonId: null,
    });
    expect(result).toEqual({ ok: true, status: "invited" });
    expect(auth.inviteUserByEmail).toHaveBeenCalledTimes(1);
    expect(auth.updateUserById).toHaveBeenCalledWith(
      "invited-1",
      expect.objectContaining({
        app_metadata: expect.objectContaining({
          organization_id: ORG,
          user_role: "equipment_manager",
        }),
      })
    );
  });

  it("links an existing confirmed account without sending an invite", async () => {
    const auth = setUp({
      staff: [
        { data: staffRow, error: null },
        { data: null, error: null },
        { data: null, error: null },
        { data: null, error: null },
      ],
      organization_memberships: [
        { data: [], error: null },
        { data: null, error: null },
      ],
    });
    auth.listUsers.mockResolvedValue({
      data: {
        users: [{ id: "u9", email: "postoji@klub.rs", email_confirmed_at: "2026-01-01" }],
      },
      error: null,
    });
    const result = await addOrgAccount(ORG, {
      staffId: "s1",
      email: "postoji@klub.rs",
      role: "medical_staff",
      teamIds: [],
      seasonId: null,
    });
    expect(result).toEqual({ ok: true, status: "active" });
    expect(auth.inviteUserByEmail).not.toHaveBeenCalled();
  });

  it("resends exactly one invitation for an existing unconfirmed account", async () => {
    const auth = setUp({
      staff: [
        { data: staffRow, error: null },
        { data: null, error: null },
        { data: null, error: null },
        { data: null, error: null },
      ],
      organization_memberships: [
        { data: [], error: null },
        { data: null, error: null },
      ],
    });
    auth.listUsers.mockResolvedValue({
      data: {
        users: [{ id: "u3", email: "ceka@klub.rs", invited_at: "2026-09-01" }],
      },
      error: null,
    });
    const result = await addOrgAccount(ORG, {
      staffId: "s1",
      email: "ceka@klub.rs",
      role: "coach",
      teamIds: [],
      seasonId: null,
    });
    expect(result).toEqual({ ok: true, status: "invited" });
    expect(auth.inviteUserByEmail).toHaveBeenCalledTimes(1);
    expect(auth.updateUserById).toHaveBeenCalledWith(
      "u3",
      expect.objectContaining({
        app_metadata: expect.objectContaining({ user_role: "coach" }),
      })
    );
  });
});
