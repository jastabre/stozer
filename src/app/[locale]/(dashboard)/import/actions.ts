"use server";

import { z } from "zod";
import { createAthlete, countAthletes, getActiveSeason, listTeams } from "@/lib/club-data";
import { checkEntitlement } from "@/lib/entitlements";
import { hasPermission, requireOrganization } from "@/lib/organization";
import { createServerClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database";
import { detectFormat, parseCsv, parseXlsx } from "@/lib/import/parsers";
import {
  findDuplicate,
  identityKey,
  importColumnFields,
  importRowSchema,
  mapHeaders,
  mapRow,
  validateTeam,
  type AthleteRef,
  type ColumnMapping,
  type DuplicateDecision,
  type ImportRow,
} from "@/lib/import/rows";

const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;
const DEFAULT_BATCH_SIZE = 50;
const mappingSchema = z.array(
  z.object({ field: z.string(), header: z.string().min(1) })
).max(1000);
const decisionsSchema = z.record(z.enum(["skip", "update", "create"]));

export interface ImportPreviewAthlete extends AthleteRef {}

export interface ParseUploadResult {
  jobId: string;
  totalRows: number;
  headers: string[];
  rows: Record<string, string>[];
  teams: { id: string; name: string }[];
  existingAthletes: ImportPreviewAthlete[];
}

export interface ImportProgress {
  status: string;
  totalRows: number;
  validRows: number;
  errorRows: number;
  duplicatedRows: number;
  processedRows: number;
  errorMessage: string | null;
}

export interface ImportBatchOptions {
  mapping?: ColumnMapping[];
  decisions?: Record<string, DuplicateDecision>;
}

function jsonValue(value: unknown): Json {
  return value as Json;
}

function isColumnField(value: string): value is (typeof importColumnFields)[number] | "" {
  return value === "" || (importColumnFields as readonly string[]).includes(value);
}

function validateMapping(value: unknown): ColumnMapping[] {
  const result = mappingSchema.safeParse(value);
  if (!result.success) throw new Error("Invalid column mapping");
  return result.data.map((mapping) => {
    if (!isColumnField(mapping.field)) throw new Error("Invalid import field");
    return mapping as ColumnMapping;
  });
}

function validateDecisions(value: unknown): Record<string, DuplicateDecision> {
  const result = decisionsSchema.safeParse(value ?? {});
  if (!result.success) throw new Error("Invalid duplicate decisions");
  return result.data;
}

function normalizeSourceRow(source: Record<string, string>): Record<string, string> {
  const normalized = { ...source };
  const gender = normalized.gender?.trim().toLocaleLowerCase();
  if (gender) {
    const aliases: Record<string, string> = {
      m: "male",
      male: "male",
      muski: "male",
      muški: "male",
      f: "female",
      female: "female",
      zenski: "female",
      ženski: "female",
      other: "other",
      drugo: "other",
    };
    normalized.gender = aliases[gender] ?? gender;
  }

  if (normalized.club_athlete_number) {
    normalized.club_athlete_number = normalized.club_athlete_number
      .trim()
      .replace(/^C/i, "");
  }
  return normalized;
}

function mappedRow(
  source: Record<string, string>,
  mappings: ColumnMapping[]
): Record<string, string> {
  return normalizeSourceRow(mapRow(source, mappings));
}

async function authorizeImport() {
  const org = await requireOrganization();
  if (!(await hasPermission("athletes.create"))) {
    throw new Error("You do not have permission to import players");
  }
  return org;
}

async function listExistingAthletes(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  organizationId: string
): Promise<ImportPreviewAthlete[]> {
  const { data, error } = await supabase
    .from("athletes")
    .select("id, club_athlete_number, first_name, last_name, birth_date")
    .eq("organization_id", organizationId);

  if (error) throw new Error("Could not load existing players: " + error.message);
  return (data ?? []) as ImportPreviewAthlete[];
}

function buildAthleteMaps(athletes: ImportPreviewAthlete[]) {
  const byNumber = new Map<string, AthleteRef>();
  const byIdentity = new Map<string, AthleteRef>();
  for (const athlete of athletes) {
    byNumber.set(String(athlete.club_athlete_number), athlete);
    if (athlete.birth_date) {
      byIdentity.set(
        identityKey(athlete.first_name, athlete.last_name, athlete.birth_date),
        athlete
      );
    }
  }
  return { byNumber, byIdentity };
}

export async function getImportGateAction(): Promise<{
  allowed: boolean;
  locked: boolean;
  count: number;
  limit: number | null;
}> {
  const org = await requireOrganization();
  const allowed = await hasPermission("athletes.create");
  if (!allowed) return { allowed: false, locked: false, count: 0, limit: null };

  const supabase = await createServerClient();
  const [count, limit] = await Promise.all([
    countAthletes(supabase, org.organizationId),
    checkEntitlement(org.organizationId, "max_players"),
  ]);
  return {
    allowed,
    locked: limit !== null && count >= limit,
    count,
    limit,
  };
}

/** Parse only: this action never writes athlete rows. */
export async function parseUploadAction(formData: FormData): Promise<ParseUploadResult> {
  const org = await authorizeImport();
  const file = formData.get("file");
  if (!(file instanceof File)) throw new Error("Choose a CSV or XLSX file");
  if (file.size > MAX_UPLOAD_BYTES) throw new Error("Import files must be 2 MB or smaller");

  const format = detectFormat(file.name);
  const buffer = Buffer.from(await file.arrayBuffer());
  const rows = format === "csv" ? await parseCsv(buffer) : await parseXlsx(buffer);
  if (rows.length === 0) throw new Error("The file has no data rows");

  const supabase = await createServerClient();
  const defaultMapping = mapHeaders(Object.keys(rows[0] ?? {}));
  const [teams, existingAthletes] = await Promise.all([
    listTeams(supabase, org.organizationId),
    listExistingAthletes(supabase, org.organizationId),
  ]);
  const limit = await checkEntitlement(org.organizationId, "max_players");
  const count = await countAthletes(supabase, org.organizationId);
  if (limit !== null && count >= limit) {
    throw new Error("Your player limit has been reached. Upgrade your plan to import more players.");
  }

  const { data: job, error } = await supabase
    .from("import_jobs")
    .insert({
      organization_id: org.organizationId,
      created_by: org.userId,
      filename: file.name,
      status: "validated",
      total_rows: rows.length,
      parsed_rows: jsonValue(rows),
      column_mapping: jsonValue(defaultMapping),
    })
    .select("id")
    .single();
  if (error || !job) throw new Error("Could not create import job: " + (error?.message ?? "unknown error"));

  return {
    jobId: job.id,
    totalRows: rows.length,
    headers: Object.keys(rows[0] ?? {}),
    rows: rows.slice(0, 50),
    teams: teams.map((team) => ({ id: team.id, name: team.name })),
    existingAthletes,
  };
}

async function updateMembership(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  organizationId: string,
  athleteId: string,
  row: ImportRow,
  teamId: string | null,
  seasonId: string | null
): Promise<string | null> {
  if (!teamId || !seasonId) return null;
  const { error } = await supabase.from("seasonal_memberships").upsert(
    {
      organization_id: organizationId,
      athlete_id: athleteId,
      season_id: seasonId,
      team_id: teamId,
      jersey_number: row.jersey_number ?? null,
      status: "active",
    },
    { onConflict: "season_id,athlete_id" }
  );
  return error?.message ?? null;
}

function normalizedName(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLocaleLowerCase();
}

export async function importBatchAction(
  jobId: string,
  offset: number,
  limit = DEFAULT_BATCH_SIZE,
  options: ImportBatchOptions = {}
): Promise<{
  nextOffset: number;
  progress: ImportProgress;
  rowErrors: { row: number; errors: string[] }[];
}> {
  const org = await authorizeImport();
  const parsedArgs = z.object({
    jobId: z.string().uuid(),
    offset: z.number().int().min(0),
    limit: z.number().int().min(1).max(100),
  }).safeParse({ jobId, offset, limit });
  if (!parsedArgs.success) throw new Error("Invalid import batch request");

  const supabase = await createServerClient();
  const { data: job, error: jobError } = await supabase
    .from("import_jobs")
    .select("*")
    .eq("id", jobId)
    .eq("organization_id", org.organizationId)
    .maybeSingle();
  if (jobError || !job) throw new Error("Import job not found");

  const progress = (overrides: Partial<ImportProgress> = {}): ImportProgress => ({
    status: overrides.status ?? job.status,
    totalRows: overrides.totalRows ?? job.total_rows,
    validRows: overrides.validRows ?? job.valid_rows,
    errorRows: overrides.errorRows ?? job.error_rows,
    duplicatedRows: overrides.duplicatedRows ?? job.duplicated_rows,
    processedRows: overrides.processedRows ?? job.processed_rows,
    errorMessage: overrides.errorMessage ?? job.error_message,
  });

  if (job.status === "done" || job.status === "failed") {
    return { nextOffset: job.processed_rows, progress: progress(), rowErrors: [] };
  }
  // A second/out-of-order request must not replay a committed batch.
  if (job.processed_rows !== offset) {
    return { nextOffset: job.processed_rows, progress: progress(), rowErrors: [] };
  }

  const mappings = options.mapping
    ? validateMapping(options.mapping)
    : validateMapping(job.column_mapping);
  const decisions = validateDecisions(options.decisions ?? job.duplicate_decisions);
  const rawRows = Array.isArray(job.parsed_rows)
    ? (job.parsed_rows as unknown as Record<string, string>[])
    : [];
  const end = Math.min(offset + limit, rawRows.length);
  const teams = await listTeams(supabase, org.organizationId);
  const teamByName = new Map(teams.map((team) => [normalizedName(team.name), team]));
  const activeSeason = await getActiveSeason(supabase, org.organizationId);
  const existingAthletes = await listExistingAthletes(supabase, org.organizationId);
  const maps = buildAthleteMaps(existingAthletes);
  const maxPlayers = await checkEntitlement(org.organizationId, "max_players");
  let athleteCount = await countAthletes(supabase, org.organizationId);
  let validRows = 0;
  let errorRows = 0;
  let duplicatedRows = 0;
  const rowErrors: { row: number; errors: string[] }[] = [];

  try {
    for (let index = offset; index < end; index += 1) {
      const mapped = mappedRow(rawRows[index] ?? {}, mappings);
      const parsed = importRowSchema.safeParse(mapped);
      if (!parsed.success) {
        const errors = parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`);
        rowErrors.push({ row: index + 1, errors });
        errorRows += 1;
        continue;
      }

      const row = parsed.data;
      const teamErrors = row.team ? validateTeam(row.team, new Set(teams.map((team) => team.name))) : [];
      if (teamErrors.length > 0 || (row.team && !activeSeason)) {
        const errors = teamErrors.length > 0 ? teamErrors : ["An active season is required for a team membership"];
        rowErrors.push({ row: index + 1, errors });
        errorRows += 1;
        continue;
      }
      const team = row.team ? teamByName.get(normalizedName(row.team)) : null;
      const duplicate = findDuplicate(row, maps.byNumber, maps.byIdentity);
      if (duplicate) duplicatedRows += 1;

      if (duplicate) {
        const decision = decisions[String(index)] ?? "skip";
        if (decision === "skip") {
          validRows += 1;
          continue;
        }
        if (decision === "update") {
          if (!(await hasPermission("athletes.edit"))) {
            rowErrors.push({ row: index + 1, errors: ["You do not have permission to update existing players"] });
            errorRows += 1;
            continue;
          }
          const { error } = await supabase.from("athletes").update({
            first_name: row.first_name,
            last_name: row.last_name,
            birth_date: row.birth_date,
            gender: row.gender ?? null,
            nationality: row.nationality ?? null,
            position: row.position ?? null,
            federation_id: row.federation_id ?? null,
          }).eq("id", duplicate.id).eq("organization_id", org.organizationId);
          if (error) {
            rowErrors.push({ row: index + 1, errors: [error.message] });
            errorRows += 1;
            continue;
          }
          const membershipError = await updateMembership(
            supabase, org.organizationId, duplicate.id, row, team?.id ?? null, activeSeason?.id ?? null
          );
          if (membershipError) {
            rowErrors.push({ row: index + 1, errors: [membershipError] });
            errorRows += 1;
            continue;
          }
          validRows += 1;
          continue;
        }
      }

      if (maxPlayers !== null && athleteCount >= maxPlayers) {
        rowErrors.push({ row: index + 1, errors: ["Player limit reached for this plan"] });
        errorRows += 1;
        continue;
      }
      const created = await createAthlete(supabase, org.organizationId, {
        first_name: row.first_name,
        last_name: row.last_name,
        birth_date: row.birth_date,
        gender: row.gender ?? null,
        nationality: row.nationality ?? null,
        position: row.position ?? null,
        federation_id: row.federation_id ?? null,
        seasonId: activeSeason?.id,
        team_id: team?.id,
        jersey_number: row.jersey_number,
      });
      if ("error" in created) {
        rowErrors.push({ row: index + 1, errors: [created.error] });
        errorRows += 1;
        continue;
      }
      athleteCount += 1;
      const createdRef: AthleteRef = {
        id: created.id,
        club_athlete_number: created.club_athlete_number,
        first_name: row.first_name,
        last_name: row.last_name,
        birth_date: row.birth_date,
      };
      maps.byNumber.set(String(createdRef.club_athlete_number), createdRef);
      maps.byIdentity.set(identityKey(row.first_name, row.last_name, row.birth_date), createdRef);
      validRows += 1;
    }

    const nextOffset = end;
    const isDone = nextOffset >= rawRows.length;
    const updatePayload = {
      status: isDone ? "done" : "importing",
      valid_rows: job.valid_rows + validRows,
      error_rows: job.error_rows + errorRows,
      duplicated_rows: job.duplicated_rows + duplicatedRows,
      processed_rows: nextOffset,
      ...(options.mapping ? { column_mapping: jsonValue(mappings) } : {}),
      ...(Object.keys(decisions).length > 0 ? { duplicate_decisions: jsonValue(decisions) } : {}),
    };
    const { data: updated, error: updateError } = await supabase
      .from("import_jobs")
      .update(updatePayload)
      .eq("id", job.id)
      .eq("organization_id", org.organizationId)
      .eq("processed_rows", offset)
      .select("*")
      .single();
    if (updateError || !updated) throw new Error("Could not update import progress");

    return {
      nextOffset,
      progress: {
        status: updated.status,
        totalRows: updated.total_rows,
        validRows: updated.valid_rows,
        errorRows: updated.error_rows,
        duplicatedRows: updated.duplicated_rows,
        processedRows: updated.processed_rows,
        errorMessage: updated.error_message,
      },
      rowErrors,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Import failed";
    await supabase.from("import_jobs").update({
      status: "failed",
      error_message: message,
    }).eq("id", job.id).eq("organization_id", org.organizationId);
    throw error;
  }
}

export async function getImportProgressAction(jobId: string): Promise<ImportProgress> {
  const org = await authorizeImport();
  const parsed = z.string().uuid().safeParse(jobId);
  if (!parsed.success) throw new Error("Invalid import job");
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("import_jobs")
    .select("status, total_rows, valid_rows, error_rows, duplicated_rows, processed_rows, error_message")
    .eq("id", jobId)
    .eq("organization_id", org.organizationId)
    .maybeSingle();
  if (error || !data) throw new Error("Import job not found");
  return {
    status: data.status,
    totalRows: data.total_rows,
    validRows: data.valid_rows,
    errorRows: data.error_rows,
    duplicatedRows: data.duplicated_rows,
    processedRows: data.processed_rows,
    errorMessage: data.error_message,
  };
}
