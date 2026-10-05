"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslations } from "next-intl";
import { LockedFeature } from "@/components/subscription/LockedFeature";
import { useToast } from "@/components/ui/Toast";
import { safeFeedbackMessage } from "@/lib/feedback";
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
import {
  getImportGateAction,
  getImportProgressAction,
  importBatchAction,
  parseUploadAction,
  type ImportPreviewAthlete,
  type ImportProgress,
  type ParseUploadResult,
} from "./actions";

const uploadSchema = z.object({
  file: z.custom<File>(
    (value) => value instanceof File && [".csv", ".xlsx"].some((extension) => value.name.toLowerCase().endsWith(extension)),
    "Choose a CSV or XLSX file"
  ),
});

type UploadValues = z.infer<typeof uploadSchema>;
type Step = 1 | 2 | 3 | 4;

const requiredFields = ["first_name", "last_name", "birth_date"] as const;

interface PreviewRow {
  index: number;
  source: Record<string, string>;
  data: ImportRow | null;
  errors: string[];
  duplicate: AthleteRef | null;
}

function mapsFor(athletes: ImportPreviewAthlete[]) {
  const byNumber = new Map<string, AthleteRef>();
  const byIdentity = new Map<string, AthleteRef>();
  for (const athlete of athletes) {
    byNumber.set(String(athlete.club_athlete_number), athlete);
    if (athlete.birth_date) {
      byIdentity.set(identityKey(athlete.first_name, athlete.last_name, athlete.birth_date), athlete);
    }
  }
  return { byNumber, byIdentity };
}

export default function ImportPage() {
  const pathname = usePathname();
  const locale = pathname.startsWith("/en") ? "en" : "sr";
  const t = useTranslations("import");
  const tf = useTranslations("feedback");
  const { success, error: toastError } = useToast();
  const [step, setStep] = useState<Step>(1);
  const [gate, setGate] = useState<Awaited<ReturnType<typeof getImportGateAction>> | null>(null);
  const [job, setJob] = useState<ParseUploadResult | null>(null);
  const [mappings, setMappings] = useState<ColumnMapping[]>([]);
  const [decisions, setDecisions] = useState<Record<string, DuplicateDecision>>({});
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [serverErrors, setServerErrors] = useState<{ row: number; errors: string[] }[]>([]);

  const uploadForm = useForm<UploadValues>({
    resolver: zodResolver(uploadSchema),
  });

  useEffect(() => {
    let active = true;
    getImportGateAction()
      .then((result) => { if (active) setGate(result); })
      .catch((error: unknown) => {
        if (active) {
          setMessage(
            safeFeedbackMessage(
              error instanceof Error ? error.message : null,
              t("errors.generic")
            )
          );
        }
      });
    return () => { active = false; };
  }, [t]);

  const previewRows = useMemo<PreviewRow[]>(() => {
    if (!job) return [];
    const maps = mapsFor(job.existingAthletes);
    const teamNames = new Set(job.teams.map((team) => team.name));
    return job.rows.map((source, index) => {
      const mapped = mapRow(source, mappings);
      const parsed = importRowSchema.safeParse(mapped);
      if (!parsed.success) {
        return {
          index,
          source,
          data: null,
          errors: parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`),
          duplicate: null,
        };
      }
      const data = parsed.data;
      const errors = data.team ? validateTeam(data.team, teamNames) : [];
      return {
        index,
        source,
        data,
        errors,
        duplicate: findDuplicate(data, maps.byNumber, maps.byIdentity),
      };
    });
  }, [job, mappings]);

  const mappingMissing = requiredFields.filter((field) => !mappings.some((mapping) => mapping.field === field));
  const previewErrors = previewRows.filter((row) => row.errors.length > 0);
  const duplicateRows = previewRows.filter((row) => row.duplicate);

  async function upload(values: UploadValues) {
    setMessage(null);
    const formData = new FormData();
    formData.append("file", values.file);
    try {
      const result = await parseUploadAction(formData);
      setJob(result);
      setMappings(mapHeaders(result.headers));
      setDecisions({});
      setStep(2);
    } catch (error: unknown) {
      setMessage(
        safeFeedbackMessage(
          error instanceof Error ? error.message : null,
          t("errors.generic")
        )
      );
      toastError(tf("importFailed"));
    }
  }

  function chooseDecision(rowIndex: number, decision: DuplicateDecision) {
    setDecisions((current) => ({ ...current, [String(rowIndex)]: decision }));
  }

  async function beginImport() {
    if (!job || mappingMissing.length > 0 || previewErrors.length > 0) return;
    setMessage(null);
    setServerErrors([]);
    setProgress({
      status: "importing",
      totalRows: job.totalRows,
      validRows: 0,
      errorRows: 0,
      duplicatedRows: 0,
      processedRows: 0,
      errorMessage: null,
    });
    setStep(4);

    let offset = 0;
    try {
      while (offset < job.totalRows) {
        // WR-06: decisions are keyed by the RAW row index, but the preview only
        // covers the first 50 rows (parseUploadAction returns rows.slice(0, 50)).
        // Sending the full decisions record to every batch made rows 50+ fall
        // to the default "skip" no matter what the user chose. Send only the
        // slice this batch processes so decisions land on the rows they saw.
        const batchDecisions = Object.fromEntries(
          Object.entries(decisions)
            .map(([key, value]) => [Number(key), value] as const)
            .filter(([index]) => index >= offset && index < offset + 50)
            .map(([index, value]) => [String(index), value])
        );
        const result = await importBatchAction(job.jobId, offset, 50, {
          mapping: mappings,
          decisions: batchDecisions,
        });
        setProgress(result.progress);
        if (result.rowErrors.length > 0) setServerErrors((current) => [...current, ...result.rowErrors]);
        if (result.nextOffset <= offset) throw new Error(t("progress.noProgress"));
        offset = result.nextOffset;
      }
      success(tf("importCompleted"));
    } catch (error: unknown) {
      const safeMessage = safeFeedbackMessage(
        error instanceof Error ? error.message : null,
        t("errors.generic")
      );
      setMessage(safeMessage);
      setProgress((current) => current ? { ...current, status: "failed", errorMessage: safeMessage } : current);
      toastError(tf("importFailed"));
    }
  }

  useEffect(() => {
    if (!job || progress?.status !== "importing") return;
    let active = true;
    const started = Date.now();
    const timer = window.setInterval(async () => {
      if (Date.now() - started >= 120_000) {
        window.clearInterval(timer);
        if (active) setProgress((current) => current ? { ...current, status: "failed", errorMessage: t("progress.pollTimeout") } : current);
        return;
      }
      try {
        const latest = await getImportProgressAction(job.jobId);
        if (!active) return;
        setProgress(latest);
        if (latest.status === "done" || latest.status === "failed") window.clearInterval(timer);
      } catch (error: unknown) {
        if (active) {
          setMessage(
            safeFeedbackMessage(
              error instanceof Error ? error.message : null,
              t("errors.generic")
            )
          );
          toastError(tf("importFailed"));
        }
      }
    }, 1500);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [job, progress?.status, t, tf, toastError]);

  if (!gate) {
    return <p className="text-sm text-muted-foreground">{t("loading")}</p>;
  }
  if (!gate.allowed) {
    return <p className="rounded-xl border border-border p-5 text-sm text-muted-foreground">{t("gate.noPermission")}</p>;
  }
  if (gate.locked) {
    return (
      <LockedFeature
        featureName={t("gate.limitTitle")}
        description={t("gate.limitDescription", { count: gate.count, limit: gate.limit ?? 0 })}
      />
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">{t("eyebrow")}</p>
        <h1 className="mt-2 text-2xl font-bold">{t("title")}</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{t("description")}</p>
      </header>

      <nav aria-label={t("steps.label")} className="grid grid-cols-4 gap-2">
        {([1, 2, 3, 4] as const).map((number) => (
          <div key={number} className={`border-t-2 pt-2 text-xs font-medium ${step >= number ? "border-primary text-foreground" : "border-border text-muted-foreground"}`}>
            <span className="mr-1 font-mono">0{number}</span>{t(`steps.${["upload", "mapping", "preview", "progress"][number - 1]}`)}
          </div>
        ))}
      </nav>

      {message && <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{message}</div>}

      {step === 1 && (
        <section className="rounded-xl border border-border p-5">
          <h2 className="text-lg font-semibold">{t("upload.title")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t("upload.description")}</p>
          <form onSubmit={uploadForm.handleSubmit(upload)} className="mt-5 space-y-4">
            <label className="block text-sm font-medium" htmlFor="import-file">{t("upload.file")}</label>
            <input
              id="import-file"
              type="file"
              accept=".csv,.xlsx"
              {...uploadForm.register("file", {
                onChange: (event) => uploadForm.setValue("file", event.target.files?.[0] as File, { shouldValidate: true }),
              })}
              className="block w-full rounded-lg border border-border px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-sm"
            />
            <p className="text-xs text-muted-foreground">{t("upload.size")}</p>
            {uploadForm.formState.errors.file && <p className="text-sm text-destructive">{uploadForm.formState.errors.file.message}</p>}
            <button type="submit" disabled={uploadForm.formState.isSubmitting} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">
              {uploadForm.formState.isSubmitting ? t("upload.working") : t("upload.submit")}
            </button>
          </form>
        </section>
      )}

      {step === 2 && job && (
        <section className="rounded-xl border border-border p-5">
          <h2 className="text-lg font-semibold">{t("mapping.title")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t("mapping.description")}</p>
          <div className="mt-5 space-y-2">
            {mappings.map((mapping, index) => (
              <div key={`${mapping.header}-${index}`} className="grid gap-2 rounded-lg border border-border p-3 sm:grid-cols-[1fr_1fr] sm:items-center">
                <span className="truncate text-sm" title={mapping.header}>{mapping.header}</span>
                <select
                  value={mapping.field}
                  onChange={(event) => setMappings((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, field: event.target.value as ColumnMapping["field"] } : item))}
                  className="rounded-lg border border-border px-3 py-2 text-sm"
                  aria-label={`${t("mapping.target")} ${mapping.header}`}
                >
                  <option value="">{t("fields.unmapped")}</option>
                  {importColumnFields.map((field) => <option key={field} value={field}>{t(`fields.${field}`)}</option>)}
                </select>
              </div>
            ))}
          </div>
          {mappingMissing.length > 0 && <p className="mt-4 text-sm text-destructive">{t("mapping.missingRequired", { fields: mappingMissing.map((field) => t(`fields.${field}`)).join(", ") })}</p>}
          <div className="mt-5 flex gap-2">
            <button type="button" onClick={() => setStep(1)} className="rounded-lg border border-border px-4 py-2 text-sm">{t("back")}</button>
            <button type="button" disabled={mappingMissing.length > 0} onClick={() => setStep(3)} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">{t("next")}</button>
          </div>
        </section>
      )}

      {step === 3 && job && (
        <section className="rounded-xl border border-border p-5">
          <h2 className="text-lg font-semibold">{t("preview.title")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t("preview.description", { count: job.totalRows })}</p>
          <div className="mt-4 flex flex-wrap gap-2 text-xs">
            <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-emerald-700">{t("preview.valid", { count: previewRows.length - previewErrors.length })}</span>
            <span className="rounded-full bg-red-500/10 px-2.5 py-1 text-red-700">{t("preview.errors", { count: previewErrors.length })}</span>
            <span className="rounded-full bg-amber-500/10 px-2.5 py-1 text-amber-700">{t("preview.duplicates", { count: duplicateRows.length })}</span>
          </div>
          <div className="mt-4 overflow-x-auto rounded-lg border border-border">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr><th className="px-3 py-2">{t("preview.row")}</th><th className="px-3 py-2">{t("fields.first_name")}</th><th className="px-3 py-2">{t("fields.last_name")}</th><th className="px-3 py-2">{t("fields.team")}</th><th className="px-3 py-2">{t("preview.status")}</th><th className="px-3 py-2">{t("preview.action")}</th></tr>
              </thead>
              <tbody>
                {previewRows.map((row) => {
                  const decision = decisions[String(row.index)] ?? "skip";
                  return (
                    <tr key={row.index} className="border-t border-border align-top">
                      <td className="px-3 py-2 font-mono text-xs">{row.index + 1}</td>
                      <td className="px-3 py-2">{row.data?.first_name ?? row.source[mappings.find((item) => item.field === "first_name")?.header ?? ""] ?? "—"}</td>
                      <td className="px-3 py-2">{row.data?.last_name ?? row.source[mappings.find((item) => item.field === "last_name")?.header ?? ""] ?? "—"}</td>
                      <td className="px-3 py-2">{row.data?.team ?? "—"}</td>
                      <td className="px-3 py-2">
                        {row.errors.length > 0 ? <span className="text-destructive">{t("preview.error")}: {row.errors.join("; ")}</span> : row.duplicate ? <span className="text-amber-700">{t("preview.duplicate")}</span> : <span className="text-emerald-700">{t("preview.validRow")}</span>}
                      </td>
                      <td className="px-3 py-2">
                        {row.duplicate && row.errors.length === 0 && <select value={decision} onChange={(event) => chooseDecision(row.index, event.target.value as DuplicateDecision)} className="rounded border border-border px-2 py-1 text-xs" aria-label={`${t("preview.action")} ${row.index + 1}`}><option value="skip">{t("preview.skip")}</option><option value="update">{t("preview.update")}</option><option value="create">{t("preview.create")}</option></select>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {previewErrors.length > 0 && <p className="mt-4 text-sm text-destructive">{t("preview.fixErrors")}</p>}
          <div className="mt-5 flex gap-2">
            <button type="button" onClick={() => setStep(2)} className="rounded-lg border border-border px-4 py-2 text-sm">{t("back")}</button>
            <button type="button" disabled={previewErrors.length > 0} onClick={beginImport} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">{t("preview.import")}</button>
          </div>
        </section>
      )}

      {step === 4 && progress && (
        <section className="rounded-xl border border-border p-5">
          <h2 className="text-lg font-semibold">{t("progress.title")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{progress.status === "importing" ? t("progress.importing") : progress.status === "done" ? t("progress.done") : t("progress.failed")}</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-4">
            <Stat label={t("progress.total")} value={progress.totalRows} />
            <Stat label={t("progress.validCount")} value={progress.validRows} />
            <Stat label={t("progress.errorCount")} value={progress.errorRows} />
            <Stat label={t("progress.duplicateCount")} value={progress.duplicatedRows} />
          </div>
          <div className="mt-5 h-2 overflow-hidden rounded-full bg-muted" aria-label={t("progress.processed", { count: progress.processedRows, total: progress.totalRows })}><div className="h-full bg-primary transition-all" style={{ width: `${progress.totalRows ? Math.min(100, progress.processedRows / progress.totalRows * 100) : 100}%` }} /></div>
          {serverErrors.length > 0 && <p className="mt-4 text-sm text-destructive">{t("progress.batchErrors", { count: serverErrors.length })}</p>}
          {progress.errorMessage && <p role="alert" className="mt-4 text-sm text-destructive">{progress.errorMessage}</p>}
          {progress.status === "done" && <Link href={`/${locale}/players`} className="mt-5 inline-flex rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">{t("progress.playersLink")}</Link>}
          {progress.status === "failed" && <button type="button" onClick={() => { setProgress(null); setStep(3); }} className="mt-5 rounded-lg border border-border px-4 py-2 text-sm">{t("progress.tryAgain")}</button>}
        </section>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return <div className="rounded-lg border border-border bg-muted/20 p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-xl font-semibold">{value}</p></div>;
}
