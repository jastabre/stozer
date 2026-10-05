import { describe, expect, it } from "vitest";
import sr from "../../../messages/sr.json";
import en from "../../../messages/en.json";

/**
 * i18n parity: sr and en must expose exactly the same key tree. A UI string
 * added to one locale but not the other is a guaranteed missing-translation
 * crash in the other language, so this gate keeps the two files in lockstep.
 */
function keyPaths(value: unknown, prefix: string): string[] {
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
      keyPaths(child, prefix ? `${prefix}.${key}` : key)
    );
  }
  return [prefix];
}

describe("messages sr/en parity", () => {
  it("every sr key exists in en", () => {
    const missing = keyPaths(sr, "").filter((key) => !keyPaths(en, "").includes(key));
    expect(missing).toEqual([]);
  });

  it("every en key exists in sr", () => {
    const missing = keyPaths(en, "").filter((key) => !keyPaths(sr, "").includes(key));
    expect(missing).toEqual([]);
  });
});
