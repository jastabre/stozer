import { parse } from "csv-parse";
import { Workbook } from "exceljs";

const CSV_OPTIONS = {
  columns: true,
  bom: true,
  skip_empty_lines: true,
  relax_column_count: false,
  trim: true,
} as const;

/** Remove BOM and surrounding whitespace without changing cell values. */
export function cleanHeader(name: string): string {
  return name.replace(/^\uFEFF/, "").trim();
}

/**
 * Parse strict RFC4180 CSV. Uneven columns and malformed quoting reject the
 * promise instead of silently shifting values into the wrong fields.
 */
export async function parseCsv(
  buffer: Buffer
): Promise<Record<string, string>[]> {
  return new Promise((resolve, reject) => {
    parse(
      buffer,
      CSV_OPTIONS,
      (error: Error | undefined, records: Record<string, unknown>[]) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(
          (records ?? []).map((record) => {
            const row: Record<string, string> = {};
            for (const [key, value] of Object.entries(record)) {
              const header = cleanHeader(key);
              if (!header) continue;
              row[header] = value == null ? "" : String(value);
            }
            return row;
          })
        );
      }
    );
  });
}

/**
 * Read the first worksheet as header-keyed data. Formula cells are represented
 * by their formula text, never evaluated; ordinary cells use ExcelJS's text
 * representation so dates and formatted values remain readable strings.
 */
export async function parseXlsx(
  buffer: Buffer
): Promise<Record<string, string>[]> {
  const workbook = new Workbook();
  await workbook.xlsx.load(buffer as unknown as never);

  const worksheet = workbook.worksheets[0];
  if (!worksheet || worksheet.rowCount < 1) return [];

  const headers: string[] = [];
  worksheet.getRow(1).eachCell({ includeEmpty: true }, (cell, column) => {
    headers[column - 1] = cleanHeader(cell.text);
  });

  const rows: Record<string, string>[] = [];
  for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber += 1) {
    const source = worksheet.getRow(rowNumber);
    const row: Record<string, string> = {};

    for (let index = 0; index < headers.length; index += 1) {
      const header = headers[index];
      if (!header) continue;

      const cell = source.getCell(index + 1);
      const value = cell.value;
      if (value && typeof value === "object" && "formula" in value) {
        row[header] = String(value.formula);
      } else {
        row[header] = cell.text;
      }
    }

    if (Object.values(row).some((value) => value !== "")) rows.push(row);
  }

  return rows;
}

export function detectFormat(filename: string): "csv" | "xlsx" {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".csv")) return "csv";
  if (lower.endsWith(".xlsx")) return "xlsx";
  throw new Error("Unsupported file format. Use CSV or XLSX.");
}
