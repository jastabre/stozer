import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({
  headers: vi.fn(async () => ({
    get: (key: string) =>
      key === "host" ? "localhost:3000" : key === "x-forwarded-proto" ? "http" : null,
  })),
}));
vi.mock("@/lib/organization", () => ({
  requireOrganization: vi.fn(),
  requirePermission: vi.fn(),
  hasPermission: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({
  createServerClient: vi.fn(async () => ({ from: vi.fn() })),
}));
vi.mock("@/lib/club-users", () => ({
  updateUserAccess: vi.fn(),
  addOrgAccount: vi.fn(),
  resendAccountInvite: vi.fn(),
  setAccountDisabled: vi.fn(),
  isClubPresident: vi.fn(),
}));

import { requireOrganization, requirePermission } from "@/lib/organization";
import {
  addOrgAccount,
  isClubPresident,
  resendAccountInvite,
  setAccountDisabled,
  updateUserAccess,
} from "@/lib/club-users";
import {
  addUserAction,
  resendInviteAction,
  setAccountDisabledAction,
  updateUserAccessAction,
} from "../actions";

const ORG_ID = "org-1";
const ACTOR = "actor-1";
const TARGET = "11111111-1111-1111-1111-111111111111";

function accessForm(role = "coach") {
  const fd = new FormData();
  fd.set("user_id", TARGET);
  fd.set("role", role);
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireOrganization).mockResolvedValue({
    organizationId: ORG_ID,
    userRole: "club_president",
    userId: ACTOR,
  } as never);
  vi.mocked(requirePermission).mockResolvedValue(undefined);
  vi.mocked(isClubPresident).mockResolvedValue(true);
  vi.mocked(updateUserAccess).mockResolvedValue({ ok: true });
  vi.mocked(addOrgAccount).mockResolvedValue({ ok: true, status: "invited" });
  vi.mocked(resendAccountInvite).mockResolvedValue({ ok: true });
  vi.mocked(setAccountDisabled).mockResolvedValue({ ok: true });
});

describe("user-management server actions require users.manage", () => {
  it("updateUserAccessAction never writes without users.manage", async () => {
    vi.mocked(requirePermission).mockRejectedValue(new Error("denied"));
    await expect(updateUserAccessAction(null, accessForm())).rejects.toThrow();
    expect(updateUserAccess).not.toHaveBeenCalled();
    expect(requirePermission).toHaveBeenCalledWith("users.manage");
  });

  it("addUserAction never invites without users.manage", async () => {
    vi.mocked(requirePermission).mockRejectedValue(new Error("denied"));
    const fd = new FormData();
    fd.set("staff_id", "staff-1");
    fd.set("role", "equipment_manager");
    fd.set("email", "novi@klub.rs");
    await expect(addUserAction(null, fd)).rejects.toThrow();
    expect(addOrgAccount).not.toHaveBeenCalled();
    expect(requirePermission).toHaveBeenCalledWith("users.manage");
  });

  it("addUserAction requires the club president even with users.manage", async () => {
    vi.mocked(isClubPresident).mockResolvedValue(false);
    const fd = new FormData();
    fd.set("staff_id", "staff-1");
    fd.set("role", "equipment_manager");
    fd.set("email", "novi@klub.rs");
    const state = await addUserAction(null, fd);
    expect(state?.error).toMatch(/predsednik/i);
    expect(addOrgAccount).not.toHaveBeenCalled();
  });

  it("resendInviteAction and setAccountDisabledAction are gated too", async () => {
    vi.mocked(requirePermission).mockRejectedValue(new Error("denied"));
    const fd = new FormData();
    fd.set("user_id", TARGET);
    await expect(resendInviteAction(null, fd)).rejects.toThrow();
    await expect(setAccountDisabledAction(null, fd)).rejects.toThrow();
    expect(resendAccountInvite).not.toHaveBeenCalled();
    expect(setAccountDisabled).not.toHaveBeenCalled();
  });

  it("passes the target role through when authorized", async () => {
    const state = await updateUserAccessAction(null, accessForm("medical_staff"));
    expect(state?.ok).toBe(true);
    expect(updateUserAccess).toHaveBeenCalledWith(
      ORG_ID,
      ACTOR,
      expect.objectContaining({ userId: TARGET, role: "medical_staff" })
    );
  });
});
