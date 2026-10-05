import { describe, expect, it } from "vitest";
import {
  SUPPORTED_CURRENCIES,
  defaultCurrencyForCountry,
  normalizeCurrency,
} from "../currency";

describe("defaultCurrencyForCountry", () => {
  it("Serbia (country code RS) defaults to RSD", () => {
    expect(defaultCurrencyForCountry("RS")).toBe("RSD");
    expect(defaultCurrencyForCountry(" rs ")).toBe("RSD");
  });

  it("every other country defaults to EUR", () => {
    expect(defaultCurrencyForCountry("DE")).toBe("EUR");
    expect(defaultCurrencyForCountry("BA")).toBe("EUR");
    expect(defaultCurrencyForCountry(null)).toBe("EUR");
    expect(defaultCurrencyForCountry(undefined)).toBe("EUR");
  });

  it("is never derived from the UI language", () => {
    // "sr" is the Serbian language code, not the country code "RS".
    expect(defaultCurrencyForCountry("sr")).toBe("EUR");
  });
});

describe("normalizeCurrency", () => {
  it("keeps the two supported codes", () => {
    expect(normalizeCurrency("RSD")).toBe("RSD");
    expect(normalizeCurrency("EUR")).toBe("EUR");
    expect(normalizeCurrency(" eur ")).toBe("EUR");
  });

  it("falls back to the safe Serbia-first RSD default", () => {
    expect(normalizeCurrency(null)).toBe("RSD");
    expect(normalizeCurrency("")).toBe("RSD");
    expect(normalizeCurrency("USD")).toBe("RSD");
  });

  it("V1 supports exactly RSD and EUR", () => {
    expect(SUPPORTED_CURRENCIES).toEqual(["RSD", "EUR"]);
  });
});
