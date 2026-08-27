import { parse } from "csv-parse";
import { Workbook } from "exceljs";

/**
 * Import parsers — CSV via csv-parse (strict RFC4180), XLSX via exceljs.
 *
 * SECURITY (T-02-06-01 / T-02-06-02):
 * - npm `xlsx` is FORBIDDEN here (CVE-2023-30533 prototype pollution +
 *   CVE-2024-22363 ReDoS, frozen/unpatched on npm). We use exceljs for XLSX
 *   and csv-parse for CSV with strict options.
 * - No imported value is EVER evaluated: every cell is read as plain data and
 *   only escaped at re-export time (the formula-injection escape lives in
 *   rows.ts `csvEscaped`). Nothing here runs an expression.
 *
 * Both formats return an array of header-keyed row objects
 * (Record<string, string>), ready for the column-mapping + zod-validation in
 * rows.ts. Header keys are produced verbatim from the file (BOM/whitespace
 * stripped); the wizard maps them to the canonical importColumnFields.
 */

const CSV_OPTIONS = {
  columns: true,
  bom: true,
  skip_empty_lines: true,
  relax_column_count: false,
  trim: true,
} as const;

/** Strip a UTF-8 BOM and surrounding whitespace from a header/column name. */
export function cleanHeader(name: string): string {
  return name.replace(/^\uFEFF/, "").trim();
}

/**
 * Parse a CSV buffer into header-keyed string rows.
 * Rejects on malformed input (uneven columns, parse errors) rather than
 * silently producing skewed rows — strict per RFC4180.
 */
export async function parseCsv(
  buffer: Buffer
): Promise<Record<string, string>[]> {
  const records = await new Promise<Record<string, string>[]>((resolve, reject) => {
    parse(
      // csv-parse accepts Uint8Array; buffer is a Node Buffer (extends it).
      buffer as unknown as Uint8Array,
      CSV_OPTIONS,
      (err: Error | undefined, output: Record<string, unknown>[]) => {
        if (err) {
          reject(err);
          return;
        }
        // Normalize cell values to strings and clean header keys.
        const rows = (output ?? []).map((row) => {
          const cleaned: Record<string, string> = {};
          for (const [key, value] of Object.entries(row)) {
            const header = cleanHeader(key);
            if (header === "") continue;
            cleaned[header] = value == null ? "" : String(value);
          }
          return cleaned;
        });
        resolve(rows);
      }
    );
  });
  return records;
}

/**
 * Parse an XLSX buffer via exceljs. Reads the first worksheet; header row is
 * the first row; each subsequent row becomes a header-keyed object with its
 * cell.text values coerced to strings. BOM/whitespace stripped from headers.
 */
export async function parseXlsx(
  buffer: Buffer
): Promise<Record<string, string>[]> {
  const workbook = new Workbook();
  // exceljs's d.ts types load() against the pre-generics @types/node Buffer,
  // while this project resolves Buffer<ArrayBufferLike> — `as never` spans the
  // boundary; the value is a real in-memory Buffer at runtime.
  await workbook.xlsx.load(buffer as unknown as never);

  const sheet = workbook.worksheets[0];
  if (!sheet) return [];

  const rows: Record<string, string>[] = [];
  const rowCount = sheet.rowCount;

  if (rowCount < 1) return [];
  const headerRow = sheet.getRow(1);
  // Read header cells by column index (avoids exceljs's union-typed
  // row.values array which trips TS on its callable CellValue member).
  const headers: string[] = [];
  headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    const raw = cell?.value;
    const text = raw == null ? "" : String(raw);
    headers[colNumber - 1] = cleanHeader(text);
  });

  for (let r = 2; r <= rowCount; r++) {
    const row = sheet.getRow(r);
    const obj: Record<string, string> = {};
    for (let idx = 0; idx < headers.length; idx++) {
      const header = headers[idx];
      if (!header) continue;
      const cell = row.getCell(idx + 1);
      const value = cell?.value;
      obj[header] = value == null ? "" : String(value);
    }
    // Skip fully empty rows (no mapped header has a value).
    if (Object.values(obj).every((v) => v === "")) continue;
    rows.push(obj);
  }

  return rows;
}

/**
 * Detect the file format by extension.
 * @throws {Error} when the extension is not .csv or .xlsx.
 */
export function detectFormat(filename: string): "csv" | "xlsx" {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".csv")) return "csv";
  if (lower.endsWith(".xlsx")) return "xlsx";
  throw new Error(
    "Nepodržan format datoteke. Koristite .csv ili .xlsx."
  );
}
