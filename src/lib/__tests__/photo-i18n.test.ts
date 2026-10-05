import { describe, expect, it } from "vitest";
import sr from "../../../messages/sr.json";
import en from "../../../messages/en.json";

/**
 * The document file picker and the player-photo actions are localized in both
 * locales. This gate fails if any of those keys goes missing (a MISSING_MESSAGE
 * crash in one language) or is left empty.
 */
const MESSAGES = { sr, en } as const;

const REQUIRED: string[][] = [
  ["documents", "chooseFile"],
  ["documents", "change"],
  ["documents", "fileHint"],
  ["players", "profile", "photoAdd"],
  ["players", "profile", "photoChange"],
  ["players", "profile", "photoRemove"],
  ["players", "profile", "photoUploading"],
  ["players", "profile", "photoRemoving"],
  ["players", "profile", "photoRemoveTitle"],
  ["players", "profile", "photoRemoveBody"],
  ["players", "profile", "photoRemoveConfirm"],
  ["players", "profile", "photoLabel"],
  ["feedback", "photoUpdated"],
  ["feedback", "photoRemoved"],
];

function valueAt(messages: unknown, path: string[]): unknown {
  return path.reduce<unknown>(
    (acc, key) =>
      acc && typeof acc === "object"
        ? (acc as Record<string, unknown>)[key]
        : undefined,
    messages
  );
}

describe("document/photo i18n keys", () => {
  for (const lang of ["sr", "en"] as const) {
    it(`${lang}: every required key exists and is non-empty`, () => {
      for (const path of REQUIRED) {
        const value = valueAt(MESSAGES[lang], path);
        expect(typeof value, `${lang} ${path.join(".")}`).toBe("string");
        expect((value as string).length, `${lang} ${path.join(".")}`).toBeGreaterThan(0);
      }
    });
  }
});
