import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/organization", () => ({
  requireOrganization: vi.fn(),
  hasPermission: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({
  createServerClient: vi.fn(async () => ({ from: vi.fn() })),
}));
vi.mock("@/lib/equipment", () => ({
  createEquipmentItem: vi.fn(),
  createEquipmentRequest: vi.fn(),
  createEquipmentType: vi.fn(),
  createTeamEquipment: vi.fn(),
  decideEquipmentRequest: vi.fn(),
  deleteEquipmentItem: vi.fn(),
  deleteItemAssignment: vi.fn(),
  deleteTeamEquipment: vi.fn(),
  issueItemToAthlete: vi.fn(),
  itemUsesNumber: vi.fn(),
  savePlayerSizes: vi.fn(),
  setTeamEquipmentRequirements: vi.fn(),
  toggleEquipmentType: vi.fn(),
  transitionItemAssignment: vi.fn(),
  updateEquipmentItem: vi.fn(),
  updateTeamEquipment: vi.fn(),
}));

import { hasPermission, requireOrganization } from "@/lib/organization";
import {
  createEquipmentItem,
  deleteEquipmentItem,
  issueItemToAthlete,
  itemUsesNumber,
  savePlayerSizes,
  updateEquipmentItem,
} from "@/lib/equipment";
import {
  createEquipmentItemAction,
  deleteEquipmentItemAction,
  issueItemAction,
  savePlayerSizesAction,
  updateEquipmentItemAction,
} from "../actions";

const ORG = "org-1";
const ATHLETE = "11111111-1111-1111-1111-111111111111";
const TYPE_A = "22222222-2222-2222-2222-222222222222";
const TYPE_B = "33333333-3333-3333-3333-333333333333";
const ITEM = "44444444-4444-4444-4444-444444444444";

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireOrganization).mockResolvedValue({
    organizationId: ORG,
    userId: "user-1",
  } as never);
  vi.mocked(hasPermission).mockResolvedValue(true);
  vi.mocked(savePlayerSizes).mockResolvedValue({ ok: true });
  vi.mocked(issueItemToAthlete).mockResolvedValue({ ok: true });
  vi.mocked(itemUsesNumber).mockResolvedValue(true);
  vi.mocked(deleteEquipmentItem).mockResolvedValue({ ok: true });
  vi.mocked(createEquipmentItem).mockResolvedValue({ ok: true });
  vi.mocked(updateEquipmentItem).mockResolvedValue({ ok: true });
});

describe("savePlayerSizesAction", () => {
  it("passes null for a cleared size and the value for the others", async () => {
    const formData = new FormData();
    formData.set("athlete_id", ATHLETE);
    formData.set(`size_${TYPE_A}_preset`, "XL");
    formData.set(`size_${TYPE_B}_preset`, "");

    await savePlayerSizesAction(formData);

    expect(savePlayerSizes).toHaveBeenCalledWith(
      expect.anything(),
      ORG,
      ATHLETE,
      { [TYPE_A]: "XL", [TYPE_B]: null }
    );
  });

  it("uses the custom value when 'Drugo' is selected", async () => {
    const formData = new FormData();
    formData.set("athlete_id", ATHLETE);
    formData.set(`size_${TYPE_A}_preset`, "__custom__");
    formData.set(`size_${TYPE_A}_custom`, "128");

    await savePlayerSizesAction(formData);

    expect(savePlayerSizes).toHaveBeenCalledWith(
      expect.anything(),
      ORG,
      ATHLETE,
      { [TYPE_A]: "128" }
    );
  });
});

describe("issueItemAction", () => {
  it("stores the submitted number when the article supports a number", async () => {
    vi.mocked(itemUsesNumber).mockResolvedValue(true);
    const formData = new FormData();
    formData.set("athlete_id", ATHLETE);
    formData.set("item_id", ITEM);
    formData.set("size_top_preset", "L");
    formData.set("number", "99");
    formData.set("note", "Broj");

    await issueItemAction(formData);

    expect(itemUsesNumber).toHaveBeenCalledWith(expect.anything(), ORG, ITEM);
    expect(issueItemToAthlete).toHaveBeenCalledWith(
      expect.anything(),
      ORG,
      ATHLETE,
      ITEM,
      "L",
      null,
      "Broj",
      "99"
    );
  });

  it("stores no number when the article does not support a number", async () => {
    vi.mocked(itemUsesNumber).mockResolvedValue(false);
    const formData = new FormData();
    formData.set("athlete_id", ATHLETE);
    formData.set("item_id", ITEM);
    formData.set("number", "99");

    await issueItemAction(formData);

    expect(issueItemToAthlete).toHaveBeenCalledWith(
      expect.anything(),
      ORG,
      ATHLETE,
      ITEM,
      null,
      null,
      null,
      null
    );
  });

  it("stores no number when the field is left empty", async () => {
    vi.mocked(itemUsesNumber).mockResolvedValue(true);
    const formData = new FormData();
    formData.set("athlete_id", ATHLETE);
    formData.set("item_id", ITEM);

    await issueItemAction(formData);

    expect(issueItemToAthlete).toHaveBeenCalledWith(
      expect.anything(),
      ORG,
      ATHLETE,
      ITEM,
      null,
      null,
      null,
      null
    );
  });
});

describe("createEquipmentItemAction", () => {
  it("passes the size mode and the number capability", async () => {
    const formData = new FormData();
    formData.set("name", "Domaći dres");
    formData.set("size_mode", "split");
    formData.set("has_number", "true");

    await createEquipmentItemAction(formData);

    expect(createEquipmentItem).toHaveBeenCalledWith(
      expect.anything(),
      ORG,
      "Domaći dres",
      "split",
      true
    );
  });

  it("creates a no-size, no-number article", async () => {
    const formData = new FormData();
    formData.set("name", "Jakna");
    formData.set("size_mode", "none");

    await createEquipmentItemAction(formData);

    expect(createEquipmentItem).toHaveBeenCalledWith(
      expect.anything(),
      ORG,
      "Jakna",
      "none",
      false
    );
  });
});

describe("updateEquipmentItemAction", () => {
  it("updates the article with its size mode and number capability", async () => {
    const formData = new FormData();
    formData.set("item_id", ITEM);
    formData.set("name", "Gostujući dres");
    formData.set("size_mode", "split");
    formData.set("has_number", "true");

    await updateEquipmentItemAction(formData);

    expect(updateEquipmentItem).toHaveBeenCalledWith(expect.anything(), ORG, ITEM, {
      name: "Gostujući dres",
      sizeMode: "split",
      hasNumber: true,
    });
  });
});

describe("deleteEquipmentItemAction", () => {
  it("returns the guarded error instead of throwing so the user sees it", async () => {
    vi.mocked(deleteEquipmentItem).mockResolvedValue({
      error: "Artikal ne može biti obrisan jer postoje zaduženja igrača.",
    });
    const formData = new FormData();
    formData.set("item_id", ITEM);

    const result = await deleteEquipmentItemAction(formData);

    expect(result).toEqual({
      error: "Artikal ne može biti obrisan jer postoje zaduženja igrača.",
    });
  });
});
