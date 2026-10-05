import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { format } from "date-fns";
import { hasPermission } from "@/lib/organization";
import { loadPlayerShell } from "@/lib/player-profile";
import { listRegistrations, getOrganizationSettings } from "@/lib/club-data";
import { deriveStatus, daysUntil, type StatusTone } from "@/lib/status";
import { saveRegistration, deleteRegistration } from "./actions";
import { FormSubmitButton } from "@/components/FormSubmitButton";
import { MutationForm } from "@/components/ui/MutationForm";
import { StatusBadge, type StatusTone as BadgeTone } from "@/components/ui/StatusBadge";
import { DateField } from "@/components/ui/DateField";

export default async function PlayerRegistrationsPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const t = await getTranslations("players.registrations");
  const tc = await getTranslations("common");
  const tf = await getTranslations("feedback");

  const [canView, canManage, { supabase, org, activeSeason }] = await Promise.all([
    hasPermission("registrations.view"),
    hasPermission("registrations.manage"),
    loadPlayerShell(id),
  ]);
  if (!canView) notFound();

  const [registrations, settings] = await Promise.all([
    listRegistrations(supabase, org.organizationId, id),
    getOrganizationSettings(supabase, org.organizationId),
  ]);

  // A backfill/trigger guarantees a settings row, but tolerate absence with the
  // research default (D-12 / A5 default 30).
  const threshold =
    settings?.warning_threshold_days != null
      ? settings.warning_threshold_days
      : 30;

  // Current status (D-10): derived from the latest registration record.
  const current = registrations[0] ?? null;
  const currentTone: StatusTone | null = current
    ? deriveStatus(new Date(current.valid_until), threshold)
    : null;
  const daysLeft = current ? daysUntil(new Date(current.valid_until)) : null;

  // The profile's "active" registration (valid or expiring) is edited inline at
  // the top; expired/absent means the primary action creates a new one.
  const isCurrentActive =
    !!current && (currentTone === "green" || currentTone === "yellow");
  const editing = isCurrentActive ? current : null;
  const canCreate = canManage && !!activeSeason;
  const showForm = canManage && (isCurrentActive || canCreate);

  function statusFor(tone: StatusTone | null): {
    badge: BadgeTone;
    label: string;
  } {
    switch (tone) {
      case "green":
        return { badge: "green", label: t("statusValid") };
      case "yellow":
        return { badge: "yellow", label: t("statusExpiring") };
      case "red":
        return { badge: "red", label: t("statusExpired") };
      default:
        return { badge: "neutral", label: t("statusNone") };
    }
  }

  // History excludes the record currently being edited at the top.
  const history = registrations.filter((r) => r.id !== editing?.id);
  const inputClass = "mt-1 rounded-lg border px-3 py-2 text-sm text-foreground";

  return (
    <div className="space-y-4">
      {/* Current status — clear at a glance (REG-03, D-10). */}
      <section className="rounded-xl border border-border bg-card">
        <header className="border-b border-border px-4 py-2.5 sm:px-5">
          <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {t("title")}
          </h2>
        </header>
        <div className="px-4 py-4 sm:px-5">
          <div className="flex flex-wrap items-center gap-3">
            {(() => {
              const s = statusFor(currentTone);
              return <StatusBadge tone={s.badge} label={s.label} />;
            })()}
            {current && (
              <span className="text-sm text-foreground">
                {t("validUntilDate", {
                  date: format(new Date(current.valid_until), "dd.MM.yyyy."),
                })}
                {daysLeft !== null && daysLeft >= 0 && (
                  <span className="ml-1 text-muted-foreground">
                    · {t("daysLeft", { count: daysLeft })}
                  </span>
                )}
              </span>
            )}
          </div>
          {current?.identifier && (
            <p className="mt-2 text-sm text-muted-foreground">
              {t("federativeIdLine", { id: current.identifier })}
            </p>
          )}
          {!current && !canManage && (
            <p className="mt-2 text-sm text-muted-foreground">{t("noRegistration")}</p>
          )}
        </div>
      </section>

      {/* Primary action — add new, or edit the active registration inline. */}
      {canManage &&
        (showForm ? (
          <details className="group rounded-xl border border-border bg-card">
            <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-medium text-primary [&::-webkit-details-marker]:hidden sm:px-5">
              {editing ? t("editRegistration") : t("add")}
            </summary>
            <div className="border-t border-border px-4 py-4 sm:px-5">
              <MutationForm
                action={saveRegistration}
                successMessage={tf("registrationSaved")}
                errorMessage={tf("saveFailed")}
                className="grid gap-3 sm:grid-cols-2"
              >
                <input type="hidden" name="athlete_id" value={id} />
                {editing && <input type="hidden" name="id" value={editing.id} />}
                <label className="flex flex-col text-xs text-muted-foreground sm:col-span-2">
                  {t("identifier")}
                  <input
                    name="identifier"
                    defaultValue={editing?.identifier ?? ""}
                    placeholder={t("identifierPlaceholder")}
                    className={inputClass}
                  />
                </label>
                <label className="flex flex-col text-xs text-muted-foreground">
                  {t("registrationDate")}
                  <DateField
                    name="valid_from"
                    defaultValue={editing?.valid_from ?? ""}
                    ariaLabel={t("registrationDate")}
                    required
                    className="mt-1"
                  />
                </label>
                <label className="flex flex-col text-xs text-muted-foreground">
                  {t("validUntil")}
                  <DateField
                    name="valid_until"
                    defaultValue={editing?.valid_until ?? ""}
                    ariaLabel={t("validUntil")}
                    required
                    className="mt-1"
                  />
                </label>
                <label className="flex flex-col text-xs text-muted-foreground sm:col-span-2">
                  {t("note")}
                  <textarea
                    name="note"
                    rows={2}
                    defaultValue={editing?.note ?? ""}
                    placeholder={t("notePlaceholder")}
                    className={inputClass}
                  />
                </label>
                <div className="flex items-end sm:col-span-2">
                  <FormSubmitButton
                    idleLabel={t("submit")}
                    pendingLabel={t("saving")}
                    className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
                  />
                </div>
              </MutationForm>
            </div>
          </details>
        ) : (
          !current && (
            <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-4 sm:px-5">
              <p className="text-sm text-muted-foreground">{t("noActiveSeasonHint")}</p>
              <Link
                href={`/${locale}/seasons`}
                className="inline-flex h-9 shrink-0 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                {t("startSeason")}
              </Link>
            </section>
          )
        ))}

      {/* History — compact, hidden when there is nothing to show (no duplicate
        * "no registrations" message under the "Bez registracije" status). */}
      {history.length > 0 && (
        <section className="rounded-xl border border-border bg-card">
          <header className="border-b border-border px-4 py-2.5 sm:px-5">
            <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {t("history")}
            </h2>
          </header>
          <ul className="divide-y divide-border">
            {history.map((r) => {
              const s = statusFor(deriveStatus(new Date(r.valid_until), threshold));
              const detail = [
                r.identifier ? t("federativeIdLine", { id: r.identifier }) : "",
                r.note?.trim() ?? "",
              ]
                .filter(Boolean)
                .join(" · ");
              return (
                <li
                  key={r.id}
                  className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 sm:px-5"
                >
                  <div className="flex min-w-0 flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge tone={s.badge} label={s.label} />
                      <span className="text-sm text-foreground">
                        {t("range", {
                          from: format(new Date(r.valid_from), "dd.MM.yyyy."),
                          to: format(new Date(r.valid_until), "dd.MM.yyyy."),
                        })}
                      </span>
                    </div>
                    {detail && (
                      <span className="truncate text-xs text-muted-foreground">
                        {detail}
                      </span>
                    )}
                  </div>
                  {canManage && (
                    <MutationForm
                      action={deleteRegistration}
                      successMessage={tf("itemDeleted")}
                      errorMessage={tf("deleteFailed")}
                      resetOnSuccess={false}
                      className="shrink-0"
                    >
                      <input type="hidden" name="id" value={r.id} />
                      <input type="hidden" name="athlete_id" value={id} />
                      <FormSubmitButton
                        idleLabel={t("delete")}
                        pendingLabel={tc("deleting")}
                        className="rounded-lg border border-destructive px-2.5 py-1 text-xs text-destructive"
                      />
                    </MutationForm>
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
