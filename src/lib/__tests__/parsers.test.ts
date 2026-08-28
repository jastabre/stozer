import { describe, expect, it } from "vitest";
import { cleanHeader, detectFormat, parseCsv } from "@/lib/import/parsers";

describe("parseCsv (REG-08)", () => {
  it("handles a UTF-8 BOM on the first header", async () => {
    const rows = await parseCsv(Buffer.from("\uFEFFfirst_name,last_name\nAna,Marić"));
    expect(rows).toEqual([{ first_name: "Ana", last_name: "Marić" }]);
  });

  it("parses quoted commas inside a field", async () => {
    const rows = await parseCsv(
      Buffer.from('name,note\n"Marko, Petrović","so, slow"')
    );
    expect(rows).toEqual([{ name: "Marko, Petrović", note: "so, slow" }]);
  });

  it("parses embedded newlines inside quoted fields", async () => {
    const rows = await parseCsv(Buffer.from('name,note\n"Ana\nMarić","line1\nline2"'));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({ name: "Ana\nMarić", note: "line1\nline2" });
  });

  it("trims surrounding whitespace from cells", async () => {
    const rows = await parseCsv(Buffer.from("first,last\n  Ana  ,  Marić  "));
    expect(rows).toEqual([{ first: "Ana", last: "Marić" }]);
  });

  it("skips empty lines", async () => {
    const rows = await parseCsv(Buffer.from("a,b\n\n1,2\n\n\n3,4\n"));
    expect(rows).toEqual([
      { a: "1", b: "2" },
      { a: "3", b: "4" },
    ]);
  });

  it("rejects uneven rows (strict RFC4180, relax_column_count false)", async () => {
    await expect(parseCsv(Buffer.from("a,b\n1\n2,3,4"))).rejects.toThrow();
  });

  it("rejects rows with extra columns", async () => {
    await expect(parseCsv(Buffer.from("a,b\n1,2,3"))).rejects.toThrow();
  });

  it("keeps formula-looking cells as literal data, never evaluated", async () => {
    const rows = await parseCsv(Buffer.from("value\n=SUM(A1)\n+cmd()"));
    expect(rows).toEqual([{ value: "=SUM(A1)" }, { value: "+cmd()" }]);
  });
});

describe("cleanHeader (REG-08)", () => {
  it("strips a BOM and surrounding whitespace without changing the name", () => {
    expect(cleanHeader("\uFEFF First Name ")).toBe("First Name");
    expect(cleanHeader("last_name")).toBe("last_name");
  });
});

describe("detectFormat (REG-08)", () => {
  it("maps .csv and .xlsx extensions case-insensitively", () => {
    expect(detectFormat("roster.CSV")).toBe("csv");
    expect(detectFormat("Players.csv")).toBe("csv");
    expect(detectFormat("team.xlsx")).toBe("xlsx");
    expect(detectFormat("DATA.XLSX")).toBe("xlsx");
  });

  it("throws for unsupported extensions", () => {
    expect(() => detectFormat("roster.txt")).toThrow();
    expect(() => detectFormat("roster.csv.bak")).toThrow();
    expect(() => detectFormat("roster")).toThrow();
  });
});