import { z } from "zod";

/** Canonical import vocabulary. Blank `team` means no current membership. */
export const importColumnFields = [
  "club_athlete_number",
  "first_name",
  "last_name",
  "birth_date",
  "gender",
  "nationality",
  "position",
  "federation_id",
  "team",
  "jersey_number",
  "phone",
  "guardian_name",
  "guardian_phone",
  "guardian_relationship",
] as const;

export type ImportColumnField = (typeof importColumnFields)[number];

const optionalString = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().optional()
);
const optionalEnum = <T extends [string, ...string[]]>(values: T) =>
  z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.enum(values).optional()
  );
const optionalNumber = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.coerce.number().int().positive().optional()
);

export const importRowSchema = z.object({
  club_athlete_number: optionalNumber,
  first_name: z.string().trim().min(1, "First name is required"),
  last_name: z.string().trim().min(1, "Last name is required"),
  birth_date: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Birth date must use YYYY-MM-DD"),
  gender: optionalEnum(["male", "female", "other"]),
  nationality: optionalString,
  position: optionalString,
  federation_id: optionalString,
  team: optionalString,
  jersey_number: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.coerce.number().int().min(1).max(99).optional()
  ),
  phone: optionalString,
  guardian_name: optionalString,
  guardian_phone: optionalString,
  guardian_relationship: optionalString,
});

export type ImportRow = z.infer<typeof importRowSchema>;
export type ImportRowWithId = ImportRow & { id?: string };

export interface ColumnMapping {
  field: ImportColumnField | "";
  header: string;
}

export interface AthleteRef {
  id: string;
  club_athlete_number: number;
  first_name: string;
  last_name: string;
  birth_date: string | null;
}

const headerAliases: Record<string, ImportColumnField> = {
  clubathletenumber: "club_athlete_number",
  clubathleteid: "club_athlete_number",
  clubid: "club_athlete_number",
  athleteid: "club_athlete_number",
  brojigraca: "club_athlete_number",
  first: "first_name",
  firstname: "first_name",
  ime: "first_name",
  imeigraca: "first_name",
  lastname: "last_name",
  last: "last_name",
  surname: "last_name",
  prezime: "last_name",
  birthdate: "birth_date",
  dateofbirth: "birth_date",
  dob: "birth_date",
  datumrodenja: "birth_date",
  datumrodjenja: "birth_date",
  gender: "gender",
  sex: "gender",
  pol: "gender",
  nationality: "nationality",
  drzavljanstvo: "nationality",
  nacionalnost: "nationality",
  position: "position",
  pozicija: "position",
  federationid: "federation_id",
  registrationid: "federation_id",
  registracioniid: "federation_id",
  federativniid: "federation_id",
  team: "team",
  teamname: "team",
  tim: "team",
  jersey: "jersey_number",
  jerseynumber: "jersey_number",
  brojdresa: "jersey_number",
  phone: "phone",
  telefon: "phone",
  guardian: "guardian_name",
  guardianname: "guardian_name",
  staratelj: "guardian_name",
  guardianphone: "guardian_phone",
  telefonstaratelja: "guardian_phone",
  guardianrelationship: "guardian_relationship",
  relationship: "guardian_relationship",
  odnos: "guardian_relationship",
};

function normalizedHeader(value: string): string {
  return value
    .replace(/[Đđ]/g, "d")
    .replace(/^\uFEFF/, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

/** Map every source header. Unknown headers are retained as `{ field: "" }`. */
export function mapHeaders(headerRow: string[]): ColumnMapping[] {
  return headerRow.map((header) => ({
    header,
    field: headerAliases[normalizedHeader(header)] ?? "",
  }));
}

function normalizedTeam(value: string): string {
  return value
    .replace(/[Đđ]/g, "d")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase();
}

/** Return a human-readable error for an unknown team; never creates one. */
export function validateTeam(name: string, teams: Set<string>): string[] {
  if (!name.trim()) return [];
  const known = new Set([...teams].map(normalizedTeam));
  return known.has(normalizedTeam(name))
    ? []
    : [`Unknown team: ${name.trim()}`];
}

function numberKey(value: unknown): string | null {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) {
    return String(value);
  }
  if (typeof value !== "string" || !value.trim()) return null;
  const digits = value.trim().match(/^[CS]?(\d+)$/i)?.[1];
  return digits && Number(digits) > 0 ? String(Number(digits)) : null;
}

function identityPart(value: string): string {
  return value.trim().toLocaleLowerCase();
}

export function identityKey(firstName: string, lastName: string, birthDate: string): string {
  return `${identityPart(firstName)}|${identityPart(lastName)}|${birthDate.trim()}`;
}

/**
 * Find a duplicate using the strongest available key. Identity matching is
 * deliberately disabled when DOB is absent: two athletes with the same name
 * and no DOB must remain distinct.
 */
export function findDuplicate(
  row: Partial<ImportRow>,
  existingByNumber: Map<string, AthleteRef>,
  existingByIdentity: Map<string, AthleteRef>
): AthleteRef | null {
  const clubNumber = numberKey(row.club_athlete_number);
  if (clubNumber) return existingByNumber.get(clubNumber) ?? null;

  const birthDate = typeof row.birth_date === "string" ? row.birth_date.trim() : "";
  if (!birthDate || !row.first_name?.trim() || !row.last_name?.trim()) return null;

  return existingByIdentity.get(
    identityKey(row.first_name, row.last_name, birthDate)
  ) ?? null;
}

export type DuplicateDecision = "skip" | "update" | "create";

export type ResolvedDuplicate =
  | { mode: "skip"; row: null }
  | { mode: "create"; row: ImportRowWithId }
  | { mode: "update"; row: ImportRowWithId };

export function resolveDuplicate(
  row: ImportRow,
  existing: AthleteRef,
  decision: DuplicateDecision
): ResolvedDuplicate {
  if (decision === "skip") return { mode: "skip", row: null };
  if (decision === "update") {
    return { mode: "update", row: { ...row, id: existing.id } };
  }
  return { mode: "create", row };
}

/** Escape values for safe CSV re-export, including formula-injection guards. */
export function csvEscaped(value: unknown): string {
  let text = value == null ? "" : String(value);
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  if (/[",\r\n]/.test(text)) text = `"${text.replace(/"/g, '""')}"`;
  return text;
}

/** Apply the user-selected header mapping without evaluating cell content. */
export function mapRow(
  source: Record<string, string>,
  mappings: ColumnMapping[]
): Record<string, string> {
  const mapped: Record<string, string> = {};
  for (const mapping of mappings) {
    if (!mapping.field) continue;
    mapped[mapping.field] = source[mapping.header] ?? "";
  }
  return mapped;
}
