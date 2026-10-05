import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ChevronDown, Plus } from "lucide-react";
import { FormSubmitButton } from "@/components/FormSubmitButton";
import { ConfirmDeleteButton } from "@/components/ConfirmDeleteButton";
import { MutationForm } from "@/components/ui/MutationForm";
import { requireOrganization, hasPermission } from "@/lib/organization";
import { createServerClient } from "@/lib/supabase/server";
import { listMedicalExaminations, getOrganizationSettings } from "@/lib/club-data";
import { medicalStatus, daysUntil, MEDICAL_LABELS } from "@/lib/status";
import { formatDmy } from "@/lib/date-format";
import {
  saveMedicalExamination,
  deleteMedicalExamination,
} from "./actions";
import { StatusBadge, type StatusTone as BadgeTone } from "@/components/ui/StatusBadge";
import { DateField } from "@/components/ui/DateField";
import type { MedicalExamination } from "@/lib/club-data";

const MED_TONE: Record<string, BadgeTone> = {
  not_recorded: "neutral",
  valid: "green",
  expiring_soon: "yellow",
  expired: "red",
};

const PRESET_KEYS = ["periodic", "systematic", "sports", "other"] as const;

export default async function PlayerMedicalPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { id } = await params;
  const org = await requireOrganization();
  const supabase = await createServerClient();
  const t = await getTranslations("players.medical");
  const tc = await getTranslations("common");
  const tf = await getTranslations("feedback");

  // Read honors medical.view OR registrations.view (RLS matches; D-38 coaches
  // hold medical.view). Writes require medical.manage (00034: separated from
  // registrations.manage).
  const [canViewMedical, canViewReg, canManage] = await Promise.all([
    hasPermission("medical.view"),
    hasPermission("registrations.view"),
    hasPermission("medical.manage"),
  ]);
  if (!canViewMedical && !canViewReg) notFound();

  const [examinations, settings] = await Promise.all([
    listMedicalExaminations(supabase, org.organizationId, id),
    getOrganizationSettings(supabase, org.organizationId),
  ]);

  const threshold =
    settings?.warning_threshold_days != null
      ? settings.warning_threshold_days
      : 30;

  // Current status (D-37): derived from the latest examination.
  const latest = examinations[0] ?? null;
  const tone = latest
    ? medicalStatus(new Date(latest.valid_until), threshold)
    : medicalStatus(null, threshold);
  const daysLeft = latest ? daysUntil(new Date(latest.valid_until)) : null;

  // A short valid-until sentence per record; past dates read as "was valid".
  function validLine(e: MedicalExamination): string {
    const date = formatDmy(e.valid_until);
    return e.valid_until < todayIso()
      ? t("wasValidUntil", { date })
      : t("validUntil", { date });
  }
  function todayIso(): string {
    return new Date().toISOString().slice(0, 10);
  }

  // Shared add/edit form — one pattern for both actions (D-42: administrative
  // fields only; no diagnoses, findings or history).
  function renderExamForm(exam: MedicalExamination | null) {
    return (
      <MutationForm
        action={saveMedicalExamination}
        successMessage={tf("medicalSaved")}
        errorMessage={tf("saveFailed")}
        className="grid gap-3 sm:grid-cols-2"
      >
        <input type="hidden" name="athlete_id" value={id} />
        {exam && <input type="hidden" name="id" value={exam.id} />}
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          {t("examinedOn")}
          <DateField
            name="examined_on"
            defaultValue={exam?.examined_on ?? ""}
            required
            ariaLabel={t("examinedOn")}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          {t("validUntilLabel")}
          <DateField
            name="valid_until"
            defaultValue={exam?.valid_until ?? ""}
            required
            ariaLabel={t("validUntilLabel")}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          {t("examType")}
          <input
            name="exam_type"
            list="exam-type-presets"
            defaultValue={exam?.exam_type ?? ""}
            placeholder={t("examTypePlaceholder")}
            autoComplete="off"
            className="mt-1 h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          {t("institution")}
          <input
            name="institution"
            defaultValue={exam?.institution ?? ""}
            placeholder={t("institutionPlaceholder")}
            className="mt-1 h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground sm:col-span-2">
          {t("note")}
          <textarea
            name="note"
            rows={2}
            defaultValue={exam?.note ?? ""}
            placeholder={t("notePlaceholder")}
            className="mt-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
          />
        </label>
        <div className="flex items-center justify-between gap-3 sm:col-span-2">
          <p className="text-xs text-muted-foreground">{t("clearanceOnly")}</p>
          <FormSubmitButton
            idleLabel={t("submit")}
            pendingLabel={t("submitting")}
            className="h-10 shrink-0 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground"
          />
        </div>
      </MutationForm>
    );
  }

  const header = (
    <div className="min-w-0">
      <h2 className="text-lg font-semibold text-foreground">{t("title")}</h2>
      <p className="mt-0.5 text-sm text-muted-foreground">{t("privacyNote")}</p>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Shared preset for every exam-type input on this tab. */}
      <datalist id="exam-type-presets">
        {PRESET_KEYS.map((k) => (
          <option key={k} value={t(`examTypes.${k}`)} />
        ))}
      </datalist>

      {/* Header + primary action on one line; the add form expands beneath. */}
      {canManage ? (
        <details className="group">
          <summary className="flex cursor-pointer list-none flex-wrap items-start justify-between gap-x-4 gap-y-2 [&::-webkit-details-marker]:hidden">
            {header}
            <span className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground">
              <Plus className="h-4 w-4" aria-hidden="true" />
              {t("add")}
              <ChevronDown
                className="h-3.5 w-3.5 opacity-80 transition-transform group-open:rotate-180"
                aria-hidden="true"
              />
            </span>
          </summary>
          <div className="mt-3 rounded-xl border border-border bg-card p-4 sm:p-5">
            {renderExamForm(null)}
          </div>
        </details>
      ) : (
        header
      )}

      {/* Current status — compact, one glance. */}
      <section className="rounded-xl border border-border bg-card px-4 py-3.5 sm:px-5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {t("currentStatus")}
          </p>
          <StatusBadge
            tone={MED_TONE[tone]}
            label={t(`tones.${MEDICAL_LABELS[tone]}`)}
          />
        </div>
        {latest ? (
          <div className="mt-1.5 space-y-0.5">
            <p className="text-sm text-foreground">
              {validLine(latest)}
              {tone === "expiring_soon" && daysLeft !== null && daysLeft >= 0 && (
                <span className="text-muted-foreground">
                  {" "}
                  · {t("expiringIn", { count: daysLeft })}
                </span>
              )}
            </p>
            <p className="text-xs text-muted-foreground">
              {t("examinedOnLine", { date: formatDmy(latest.examined_on) })}
              {(latest.exam_type || latest.institution) &&
                ` · ${[latest.exam_type, latest.institution].filter(Boolean).join(" · ")}`}
            </p>
          </div>
        ) : (
          <p className="mt-1.5 text-sm text-muted-foreground">{t("noExamination")}</p>
        )}
      </section>

      {/* History — compact rows; hidden entirely when there is nothing to show. */}
      {examinations.length > 0 && (
        <section className="overflow-hidden rounded-xl border border-border bg-card">
          <header className="border-b border-border px-4 py-2.5 sm:px-5">
            <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {t("history")}
            </h2>
          </header>
          <ul className="divide-y divide-border">
            {examinations.map((e) => {
              const et = medicalStatus(new Date(e.valid_until), threshold);
              const meta = [e.exam_type, e.institution].filter(Boolean).join(" · ");
              return (
                <li key={e.id} className="px-4 py-3 sm:px-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium tabular-nums text-foreground">
                        {formatDmy(e.examined_on)}.
                      </p>
                      <p className="mt-0.5 text-sm text-muted-foreground">
                        {validLine(e)}
                      </p>
                      {meta && (
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {meta}
                        </p>
                      )}
                      {e.note && (
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {e.note}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-2">
                      <StatusBadge
                        tone={MED_TONE[et]}
                        label={t(`tones.${MEDICAL_LABELS[et]}`)}
                      />
                    </div>
                  </div>

                  {canManage && (
                    <div className="mt-2 flex items-center gap-3">
                      <details className="group/edit">
                        <summary className="cursor-pointer list-none text-xs font-medium text-muted-foreground transition-colors hover:text-foreground [&::-webkit-details-marker]:hidden">
                          {t("edit")}
                        </summary>
                        <div className="mt-3 rounded-lg border border-border bg-muted/30 p-3 sm:p-4">
                          {renderExamForm(e)}
                        </div>
                      </details>
                      <ConfirmDeleteButton
                        action={deleteMedicalExamination}
                        hiddenFields={{ id: e.id, athlete_id: id }}
                        triggerLabel={t("delete")}
                        triggerClassName="rounded text-xs font-medium text-muted-foreground transition-colors hover:text-destructive"
                        title={t("deleteConfirmTitle")}
                        body={t("deleteConfirmBody")}
                        confirmLabel={t("deleteConfirm")}
                        cancelLabel={tc("cancel")}
                        pendingLabel={tc("deleting")}
                        successMessage={tf("itemDeleted")}
                        errorMessage={tf("deleteFailed")}
                      />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
