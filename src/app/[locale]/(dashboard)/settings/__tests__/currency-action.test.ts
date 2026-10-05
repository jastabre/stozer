import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/organization", () => ({
  requireOrganization: vi.fn(),
  hasPermission: vi.fn(),
}));

const eq = vi.fn(async () => ({ error: null }));
const update = vi.fn(() => ({ eq }));
vi.mock("@/lib/supabase/server", () => ({
  createServerClient: vi.fn(async () => ({ from: () => ({ update }) })),
}));

import { revalidatePath } from "next/cache";
import { hasPermission, requireOrganization } from "@/lib/organization";
import { updateClubCurrencyAction } from "../actions";

const ORG_ID = "org-1";

function currencyForm(value: string) {
  const fd = new FormData();
  fd.set("currency", value);
  return fd;
}

beforeEach(() => {
  vi.mocked(requireOrganization).mockResolvedValue({
    organizationId: ORG_ID,
    userRole: "club_president",
    userId: "user-1",
  } as never);
  vi.mocked(hasPermission).mockReset();
  vi.mocked(revalidatePath).mockReset();
  update.mockClear();
  eq.mockClear();
});

describe("updateClubCurrencyAction", () => {
  it("requires club_settings.manage and never writes without it", async () => {
    vi.mocked(hasPermission).mockResolvedValue(false as never);
    const state = await updateClubCurrencyAction(null, currencyForm("EUR"));
    expect(state?.error).toMatch(/dozvolu/i);
    expect(update).not.toHaveBeenCalled();
  });

  it("rejects anything outside the two supported codes", async () => {
    vi.mocked(hasPermission).mockResolvedValue(true as never);
    const state = await updateClubCurrencyAction(null, currencyForm("USD"));
    expect(state?.error).toBeTruthy();
    expect(update).not.toHaveBeenCalled();
  });

  it("saves the club currency and revalidates the finance routes", async () => {
    vi.mocked(hasPermission).mockResolvedValue(true as never);
    const state = await updateClubCurrencyAction(null, currencyForm("EUR"));
    expect(state?.ok).toBe(true);
    expect(update).toHaveBeenCalledWith({ currency: "EUR" });
    expect(eq).toHaveBeenCalledWith("id", ORG_ID);
    expect(revalidatePath).toHaveBeenCalledWith("/settings");
    expect(revalidatePath).toHaveBeenCalledWith("/teams", "layout");
    expect(revalidatePath).toHaveBeenCalledWith("/players");
  });
});
