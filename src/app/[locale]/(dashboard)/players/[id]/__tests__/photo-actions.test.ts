import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/organization", () => ({
  requireOrganization: vi.fn(),
  hasPermission: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({
  createServerClient: vi.fn(),
}));

import { hasPermission, requireOrganization } from "@/lib/organization";
import { createServerClient } from "@/lib/supabase/server";
import { uploadAthletePhoto } from "../photo-actions";

const ORG = "org-1";
const ATHLETE = "11111111-1111-1111-1111-111111111111";

/** Minimal chain fake: athlete lookup + update + storage upload. */
function fakeClient(athlete: unknown) {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: athlete, error: null }),
          }),
        }),
      }),
      update: () => ({
        eq: () => ({ eq: async () => ({ error: null }) }),
      }),
    }),
    storage: {
      from: () => ({
        upload: vi.fn(async () => ({ error: null })),
        remove: vi.fn(async () => ({ error: null })),
      }),
    },
  };
}

function form(over: { athleteId?: string; file?: File | null } = {}) {
  const fd = new FormData();
  fd.set("athlete_id", over.athleteId ?? ATHLETE);
  if (over.file) fd.set("photo", over.file);
  return fd;
}

const jpeg = () => new File([new Uint8Array(1024)], "photo.jpg", { type: "image/jpeg" });

beforeEach(() => {
  vi.mocked(requireOrganization).mockResolvedValue({
    organizationId: ORG,
    userId: "user-1",
  } as never);
  vi.mocked(hasPermission).mockResolvedValue(true as never);
});

describe("uploadAthletePhoto — action boundary", () => {
  it("requires athletes.edit", async () => {
    vi.mocked(hasPermission).mockResolvedValue(false as never);
    const state = await uploadAthletePhoto(form({ file: jpeg() }));
    expect(state.error).toMatch(/dozvolu/i);
  });

  it("rejects an unsupported MIME type (server-side)", async () => {
    const state = await uploadAthletePhoto(
      form({ file: new File([new Uint8Array(10)], "x.gif", { type: "image/gif" }) })
    );
    expect(state.error).toMatch(/JPG, PNG i WebP/);
  });

  it("rejects a file above the size limit (server-side)", async () => {
    const big = new File([new Uint8Array(6 * 1024 * 1024)], "big.jpg", {
      type: "image/jpeg",
    });
    const state = await uploadAthletePhoto(form({ file: big }));
    expect(state.error).toMatch(/5 MB/);
  });

  it("rejects an athlete that is not in the caller's organization", async () => {
    vi.mocked(createServerClient).mockResolvedValue(fakeClient(null) as never);
    const state = await uploadAthletePhoto(form({ file: jpeg() }));
    expect(state.error).toMatch(/nije pronađen u organizaciji/);
  });

  it("uploads when the file is valid and the athlete belongs to the org", async () => {
    vi.mocked(createServerClient).mockResolvedValue(
      fakeClient({ id: ATHLETE, photo_url: null }) as never
    );
    const state = await uploadAthletePhoto(form({ file: jpeg() }));
    expect(state).toEqual({ ok: true });
  });
});
