import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { format } from "date-fns";
import { requireOrganization, hasPermission } from "@/lib/organization";
import { createServerClient } from "@/lib/supabase/server";
import {
  listMedicalExaminations,
  getOrganizationSettings,
} from "@/lib/club-data";
import {
  medicalStatus,
  daysUntil,
  MEDICAL_LABELS,
  type MedicalTone,
} from "@/lib/status";
import {
  saveMedicalExamination,
  deleteMedicalExamination,
} from "./actions";

const PILL_CLASSES: Record<MedicalTone, string> = {
  not_recorded: "bg-slate-100 text-slate-700",
  valid: "bg-emerald-100 text-emerald-800",
  expiring_soon: "bg-amber-100 text-amber-800",
  expired: "bg-rose-100 text-rose-800",
};

export default async function PlayerMedicalPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { id } = await params;
  const org = await requireOrganization();
  const supabase = await createServerClient();
  const t = await getTranslations("players.medical");

  // Read honors medical.view OR registrations.view (RLS matches; D-38 coaches
  // hold medical.view). Writes require registrations.manage.
  const [canViewMedical, canViewReg, canManage] = await Promise.all([
    hasPermission("medical.view"),
    hasPermission("registrations.view"),
    hasPermission("registrations.manage"),
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

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/players/${id}`}
          className="text-sm text-primary hover:underline"
        >
          ← {t("back")}
        </Link>
        <h1 className="mt-1 text-2xl font-bold">{t("title")}</h1>
        <p className="mt-1 text-xs text-muted-foreground">{t("privacyNote")}</p>
      </div>

      {/* Current medical status banner (D-37) */}
      <section className="rounded-xl border border-border p-5">
        <h2 className="text-lg font-semibold">{t("currentStatus")}</h2>
        {latest ? (
          <div className="mt-3 flex items-center gap-3">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium ${PILL_CLASSES[tone]}`}
            >
              {t(`tones.${MEDICAL_LABELS[tone]}`)}
            </span>
            <span className="text-sm text-muted-foreground">
              {t("validUntil", {
                date: format(new Date(latest.valid_until), "dd MMM yyyy"),
              })}
              {daysLeft !== null && daysLeft >= 0 && (
                <span className="ml-1">
                  · {t("expiringIn", { count: daysLeft })}
                </span>
              )}
            </span>
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">
            {t("noExamination")}
          </p>
        )}
        <p className="mt-3 text-xs text-muted-foreground">
          {t("clearanceOnly")}
        </p>
      </section>

      {/* Add/edit examination (D-33; D-42: administrative fields only) */}
      {canManage && (
        <details className="rounded-xl border border-border p-4">
          <summary className="cursor-pointer text-sm font-medium">
            {t("add")}
          </summary>
          <form
            action={saveMedicalExamination}
            className="mt-4 grid gap-3 sm:grid-cols-2"
          >
            <input type="hidden" name="athlete_id" value={id} />
            <label className="flex flex-col text-xs text-muted-foreground">
              {t("examinedOn")}
              <input
                type="date"
                name="examined_on"
                required
                className="mt-1 rounded-lg border px-3 py-2 text-sm text-foreground"
              />
            </label>
            <label className="flex flex-col text-xs text-muted-foreground">
              {t("validUntilLabel")}
              <input
                type="date"
                name="valid_until"
                required
                className="mt-1 rounded-lg border px-3 py-2 text-sm text-foreground"
              />
            </label>
            <label className="flex flex-col text-xs text-muted-foreground sm:col-span-2">
              {t("note")}
              <textarea
                name="note"
                rows={2}
                placeholder={t("notePlaceholder")}
                className="mt-1 rounded-lg border px-3 py-2 text-sm"
              />
            </label>
            <div className="flex items-end sm:col-span-2">
              <button
                type="submit"
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
              >
                {t("submit")}
              </button>
            </div>
          </form>
        </details>
      )}

      {/* Examination records (D-37: latest first, history secondary) */}
      <section className="rounded-xl border border-border p-5">
        <h2 className="text-lg font-semibold">{t("history")}</h2>
        {examinations.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">{t("empty")}</p>
        ) : (
          <div className="mt-3 space-y-3">
            {examinations.map((e) => {
              const et = medicalStatus(new Date(e.valid_until), threshold);
              const rem = daysUntil(new Date(e.valid_until));
              return (
                <div
                  key={e.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${PILL_CLASSES[et]}`}
                    >
                      {t(`tones.${MEDICAL_LABELS[et]}`)}
                    </span>
                    <div className="text-sm">
                      <p className="font-medium">
                        {t("range", {
                          from: format(new Date(e.examined_on), "dd MMM yyyy"),
                          to: format(new Date(e.valid_until), "dd MMM yyyy"),
                        })}
                        {rem >= 0 ? ` · ${t("expiringIn", { count: rem })}` : ""}
                      </p>
                      {e.note ? (
                        <p className="text-xs text-muted-foreground">{e.note}</p>
                      ) : null}
                    </div>
                  </div>
                  {canManage && (
                    <div className="flex gap-2">
                      <details className="relative">
                        <summary className="cursor-pointer text-xs font-medium text-primary">
                          {t("edit")}
                        </summary>
                        <form
                          action={saveMedicalExamination}
                          className="absolute right-0 z-10 mt-2 w-72 space-y-2 rounded-lg border border-border bg-card p-3 text-left"
                        >
                          <input type="hidden" name="id" value={e.id} />
                          <input type="hidden" name="athlete_id" value={id} />
                          <label className="flex flex-col text-xs text-muted-foreground">
                            {t("examinedOn")}
                            <input
                              type="date"
                              name="examined_on"
                              defaultValue={e.examined_on}
                              required
                              className="mt-1 w-full rounded-lg border px-2 py-1 text-sm"
                            />
                          </label>
                          <label className="flex flex-col text-xs text-muted-foreground">
                            {t("validUntilLabel")}
                            <input
                              type="date"
                              name="valid_until"
                              defaultValue={e.valid_until}
                              required
                              className="mt-1 w-full rounded-lg border px-2 py-1 text-sm"
                            />
                          </label>
                          <textarea
                            name="note"
                            defaultValue={e.note ?? ""}
                            rows={2}
                            placeholder={t("notePlaceholder")}
                            className="w-full rounded-lg border px-2 py-1 text-sm"
                          />
                          <button
                            type="submit"
                            className="w-full rounded-lg bg-primary px-3 py-1.5 text-xs text-primary-foreground"
                          >
                            {t("submit")}
                          </button>
                        </form>
                      </details>
                      <form action={deleteMedicalExamination}>
                        <input type="hidden" name="id" value={e.id} />
                        <input
                          type="hidden"
                          name="athlete_id"
                          value={id}
                        />
                        <button
                          type="submit"
                          className="rounded-lg border border-destructive px-2.5 py-1 text-xs text-destructive"
                        >
                          {t("delete")}
                        </button>
                      </form>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
