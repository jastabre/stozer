import { describe, expect, it } from "vitest";
import sr from "../../../messages/sr.json";
import en from "../../../messages/en.json";

/**
 * Terminology gate for the document types. The same enum is rendered from two
 * namespaces (`documents.types` for the shared panel/global list and
 * `players.documents.types` for the player tab), so both must expose the exact
 * agreed user-facing label in both locales — no raw enum, no drift.
 */
const EXPECTED: Record<"sr" | "en", Record<string, string>> = {
  sr: {
    registration: "Registracija",
    contract: "Ugovor",
    medical: "Lekarski",
    insurance: "Osiguranje",
    identity: "Identifikacija",
    federation: "Federacija",
    custom: "Ostalo",
  },
  en: {
    registration: "Registration",
    contract: "Contract",
    medical: "Medical",
    insurance: "Insurance",
    identity: "Identification",
    federation: "Federation",
    custom: "Other",
  },
};

const MESSAGES = { sr, en } as const;
const NAMESPACES: string[][] = [
  ["documents", "types"],
  ["players", "documents", "types"],
];

function at(messages: unknown, path: string[]): Record<string, string> {
  let node: unknown = messages;
  for (const key of path) node = (node as Record<string, unknown>)[key];
  return node as Record<string, string>;
}

describe("document type labels", () => {
  for (const lang of ["sr", "en"] as const) {
    for (const path of NAMESPACES) {
      it(`${lang} ${path.join(".")} has every agreed label`, () => {
        expect(at(MESSAGES[lang], path)).toEqual(EXPECTED[lang]);
      });
    }
  }
});
