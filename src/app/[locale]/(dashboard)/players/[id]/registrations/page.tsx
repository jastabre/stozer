import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { format } from "date-fns";
import { requireOrganization, hasPermission } from "@/lib/organization";
import { createServerClient } from "@/lib/supabase/server";
import {
  listRegistrations,
  listSeasons,
  getOrganizationSettings,
} from "@/lib/club-data";
import {
  deriveStatus,
  daysUntil,
  STATUS_LABELS,
  type StatusTone,
} from "@/lib/status";
import { saveRegistration, deleteRegistration } from "./actions";

const PILL_CLASSES: Record<StatusTone, string> = {
  green: "bg-emerald-100 text-emerald-800",
  yellow: "bg-amber-100 text-amber-800",
  red: "bg-rose-100 text-rose-800",
};

export default async function PlayerRegistrationsPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { id } = await params;
  const org = await requireOrganization();
  const supabase = await createServerClient();
  const t = await getTranslations("players.registrations");

  const [canManage, canView] = await Promise.all([
    hasPermission("registrations.manage"),
    hasPermission("registrations.view"),
  ]);
  if (!canView) notFound();

  const [registrations, settings, seasons] = await Promise.all([
    listRegistrations(supabase, org.organizationId, id),
    getOrganizationSettings(supabase, org.organizationId),
    listSeasons(supabase, org.organizationId),
  ]);

  // A backfill/trigger guarantees a settings row, but tolerate absence with the
  // research default (D-12 / A5 default 30).
  const threshold =
    settings?.warning_threshold_days != null
      ? settings.warning_threshold_days
      : 30;

  // Current status (D-10): derived from the current/latest registration record.
  const current = registrations[0] ?? null;
  const currentTone = current
    ? deriveStatus(new Date(current.valid_until), threshold)
    : deriveStatus(null, threshold);
  const daysLeft = current ? daysUntil(new Date(current.valid_until)) : null;

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
      </div>

      {/* Current registration status (REG-03, D-10) */}
      <section className="rounded-xl border border-border p-5">
        <h2 className="text-lg font-semibold">{t("currentStatus")}</h2>
        {current ? (
          <div className="mt-3 flex items-center gap-3">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium ${PILL_CLASSES[currentTone]}`}
            >
              {t(`tones.${STATUS_LABELS[currentTone]}`)}
            </span>
            <span className="text-sm text-muted-foreground">
              {t("until")} {format(new Date(current.valid_until), "dd MMM yyyy")}
              {daysLeft !== null && daysLeft >= 0 && (
                <span className="ml-1">
                  · {t("daysLeft", { count: daysLeft })}
                </span>
              )}
              {current.season_name && (
                <span className="ml-1">· {current.season_name}</span>
              )}
            </span>
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">
            {t("noRegistration")}
          </p>
        )}
      </section>

      {/* Add new registration (REG-01/02) */}
      {canManage && (
        <details className="rounded-xl border border-border p-4">
          <summary className="cursor-pointer text-sm font-medium">
            {t("add")}
          </summary>
          <form
            action={saveRegistration}
            className="mt-4 grid gap-3 sm:grid-cols-2"
          >
            <input type="hidden" name="athlete_id" value={id} />
            <input
              name="federation"
              placeholder={t("federation")}
              className="rounded-lg border px-3 py-2 text-sm"
            />
            <input
              name="identifier"
              placeholder={t("identifier")}
              className="rounded-lg border px-3 py-2 text-sm"
            />
            <label className="flex flex-col text-xs text-muted-foreground">
              {t("validFrom")}
              <input
                type="date"
                name="valid_from"
                required
                className="mt-1 rounded-lg border px-3 py-2 text-sm text-foreground"
              />
            </label>
            <label className="flex flex-col text-xs text-muted-foreground">
              {t("validUntil")}
              <input
                type="date"
                name="valid_until"
                required
                className="mt-1 rounded-lg border px-3 py-2 text-sm text-foreground"
              />
            </label>
            <label className="flex flex-col text-xs text-muted-foreground">
              {t("season")}
              <select
                name="season_id"
                className="mt-1 rounded-lg border px-3 py-2 text-sm text-foreground"
              >
                <option value="">{t("noSeason")}</option>
                {seasons.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex items-end">
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

      {/* Registration records (D-10: current first, past secondary) */}
      <section className="rounded-xl border border-border p-5">
        <h2 className="text-lg font-semibold">{t("history")}</h2>
        {registrations.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">{t("empty")}</p>
        ) : (
          <div className="mt-3 space-y-3">
            {registrations.map((r) => {
              const tone = deriveStatus(new Date(r.valid_until), threshold);
              const rem = daysUntil(new Date(r.valid_until));
              return (
                <div
                  key={r.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${PILL_CLASSES[tone]}`}
                    >
                      {t(`tones.${STATUS_LABELS[tone]}`)}
                    </span>
                    <div className="text-sm">
                      <p className="font-medium">
                        {r.federation || t("noFederation")}
                        {r.identifier ? ` · ${r.identifier}` : ""}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t("range", {
                          from: format(new Date(r.valid_from), "dd MMM yyyy"),
                          to: format(new Date(r.valid_until), "dd MMM yyyy"),
                        })}
                        {r.season_name ? ` · ${r.season_name}` : ""}
                        {rem >= 0 ? ` · ${t("daysLeft", { count: rem })}` : ""}
                      </p>
                    </div>
                  </div>
                  {canManage && (
                    <div className="flex gap-2">
                      <details className="relative">
                        <summary className="cursor-pointer text-xs font-medium text-primary">
                          {t("edit")}
                        </summary>
                        <form
                          action={saveRegistration}
                          className="absolute right-0 z-10 mt-2 w-72 space-y-2 rounded-lg border border-border bg-card p-3 text-left"
                        >
                          <input type="hidden" name="id" value={r.id} />
                          <input type="hidden" name="athlete_id" value={id} />
                          <input
                            name="federation"
                            defaultValue={r.federation ?? ""}
                            placeholder={t("federation")}
                            className="w-full rounded-lg border px-3 py-2 text-sm"
                          />
                          <input
                            name="identifier"
                            defaultValue={r.identifier ?? ""}
                            placeholder={t("identifier")}
                            className="w-full rounded-lg border px-3 py-2 text-sm"
                          />
                          <div className="flex gap-2">
                            <label className="flex-1 text-xs text-muted-foreground">
                              {t("validFrom")}
                              <input
                                type="date"
                                name="valid_from"
                                defaultValue={r.valid_from}
                                required
                                className="mt-1 w-full rounded-lg border px-2 py-1 text-sm"
                              />
                            </label>
                            <label className="flex-1 text-xs text-muted-foreground">
                              {t("validUntil")}
                              <input
                                type="date"
                                name="valid_until"
                                defaultValue={r.valid_until}
                                required
                                className="mt-1 w-full rounded-lg border px-2 py-1 text-sm"
                              />
                            </label>
                          </div>
                          <select
                            name="season_id"
                            defaultValue={r.season_id ?? ""}
                            className="w-full rounded-lg border px-2 py-1 text-sm"
                          >
                            <option value="">{t("noSeason")}</option>
                            {seasons.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.name}
                              </option>
                            ))}
                          </select>
                          <button
                            type="submit"
                            className="w-full rounded-lg bg-primary px-3 py-1.5 text-xs text-primary-foreground"
                          >
                            {t("submit")}
                          </button>
                        </form>
                      </details>
                      <form action={deleteRegistration}>
                        <input type="hidden" name="id" value={r.id} />
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
