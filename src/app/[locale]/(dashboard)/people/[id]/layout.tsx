import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { hasPermission } from "@/lib/organization";
import { loadStaffShell } from "@/lib/staff-profile";
import { ProfileTabs } from "@/components/ui/ProfileTabs";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { StaffProfileHeader } from "@/components/staff/StaffProfileHeader";
import { ConfirmDeleteButton } from "@/components/ConfirmDeleteButton";
import { FormSubmitButton } from "@/components/FormSubmitButton";
import { MutationForm } from "@/components/ui/MutationForm";
import { DateField } from "@/components/ui/DateField";
import { StaffFunctionsEditor } from "@/components/ui/StaffFunctionsEditor";
import { staffFunctionLabel } from "@/lib/staff-functions";
import { deleteStaffAction, updateStaffAction } from "../actions";

/**
 * Persistent staff-profile shell: back link, identity header with one
 * "Izmeni profil" affordance, and the profile tabs. Every tab renders inside
 * this shell, so switching tabs never feels like leaving the person.
 */
export default async function StaffProfileLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;

  const [canView, canManage, canViewDocuments] = await Promise.all([
    hasPermission("staff.view"),
    hasPermission("staff.manage"),
    hasPermission("documents.view"),
  ]);
  if (!canView) notFound();

  const { person, account } = await loadStaffShell(id);
  if (!person) notFound();

  const t = await getTranslations("people");
  const tc = await getTranslations("common");
  const tf = await getTranslations("feedback");
  const roleLabel = person.role ? t(`roles.${person.role}`) : null;
  const uiLocale: "sr" | "en" = locale === "en" ? "en" : "sr";
  const functionLabels = person.functions.map((fn) =>
    staffFunctionLabel(fn.function_key, uiLocale, fn.custom_label)
  );
  // Header shows all functions when there are one or two; from three on it
  // shows the first two plus a compact "+N" (the full list stays in the
  // "Funkcije u klubu" section right below).
  const headerFunctions =
    functionLabels.length === 0
      ? person.title
      : functionLabels.length <= 2
        ? functionLabels.join(" · ")
        : `${functionLabels.slice(0, 2).join(" · ")} +${
            functionLabels.length - 2
          }`;

  const base = `/${locale}/people/${person.id}`;
  const tabs = [
    { href: base, label: t("tabs.overview") },
    { href: `${base}/licenses`, label: t("tabs.licenses") },
    ...(canViewDocuments
      ? [{ href: `${base}/documents`, label: t("tabs.documents") }]
      : []),
  ];

  const identity = (
    <div className="flex min-w-0 items-center gap-3.5">
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-base font-bold text-primary">
        {person.first_name.charAt(0)}
        {person.last_name.charAt(0)}
      </span>
      <div className="min-w-0">
        <h1 className="truncate text-2xl font-bold tracking-tight text-foreground">
          {person.last_name} {person.first_name}
        </h1>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          <span className={headerFunctions ? "font-medium text-muted-foreground" : "text-muted-foreground"}>
            {headerFunctions || "—"}
          </span>
          <span aria-hidden="true" className="text-muted-foreground/60">
            ·
          </span>
          {account ? (
            <StatusBadge
              tone={
                account.status === "disabled"
                  ? "red"
                  : account.status === "invited"
                    ? "blue"
                    : "green"
              }
              label={
                roleLabel
                  ? `${t("account.stozerLabel")}: ${roleLabel}`
                  : t(`account.${account.status}`)
              }
            />
          ) : (
            <StatusBadge tone="muted" label={t("account.noAccount")} />
          )}
        </div>
      </div>
    </div>
  );

  const inputClass = "field";
  const editForm = (
    <MutationForm
      action={updateStaffAction}
      successMessage={tf("staffUpdated")}
      errorMessage={tf("saveFailed")}
      className="grid gap-3 sm:grid-cols-2"
    >
      <input type="hidden" name="staff_id" value={person.id} />
      <input type="hidden" name="locale" value={uiLocale} />
      <label className="grid gap-1 text-xs text-muted-foreground">
        {t("firstName")}
        <input name="first_name" defaultValue={person.first_name} required className={inputClass} />
      </label>
      <label className="grid gap-1 text-xs text-muted-foreground">
        {t("lastName")}
        <input name="last_name" defaultValue={person.last_name} required className={inputClass} />
      </label>
      <div className="grid gap-1 text-xs text-muted-foreground sm:col-span-2">
        {t("titleField")}
        <StaffFunctionsEditor
          locale={uiLocale}
          initial={person.functions.map((fn) => ({
            key: fn.function_key,
            custom: fn.custom_label ?? "",
          }))}
          labels={{
            add: t("addFunction"),
            remove: t("removeFunction"),
            other: t("otherFunction"),
            customPlaceholder: t("customFunctionPlaceholder"),
            functionAria: t("titleField"),
            selectPlaceholder: t("functionSelectPlaceholder"),
          }}
        />
      </div>
      <label className="grid gap-1 text-xs text-muted-foreground">
        {t("phone")}
        <input name="phone" type="tel" defaultValue={person.phone ?? ""} className={inputClass} />
      </label>
      <label className="grid gap-1 text-xs text-muted-foreground">
        {t("email")}
        <input name="email" type="email" defaultValue={person.email ?? ""} className={inputClass} />
      </label>
      <label className="grid gap-1 text-xs text-muted-foreground">
        {t("startDate")}
        <DateField
          name="start_date"
          defaultValue={person.start_date ?? ""}
          ariaLabel={t("startDate")}
        />
      </label>
      <label className="grid gap-1 text-xs text-muted-foreground">
        {t("endDate")}
        <DateField
          name="end_date"
          defaultValue={person.end_date ?? ""}
          ariaLabel={t("endDate")}
        />
      </label>
      <label className="grid gap-1 text-xs text-muted-foreground sm:col-span-2">
        {t("notes")}
        <textarea name="notes" defaultValue={person.notes ?? ""} rows={3} className={inputClass} />
      </label>
      <div className="flex flex-wrap items-center justify-between gap-3 sm:col-span-2">
        <ConfirmDeleteButton
          action={deleteStaffAction}
          hiddenFields={{ staff_id: person.id }}
          triggerLabel={t("delete")}
          triggerClassName="rounded-lg border border-destructive px-3 py-1.5 text-xs text-destructive"
          title={t("deleteConfirmTitle")}
          body={t("deleteConfirmBody", {
            name: `${person.last_name} ${person.first_name}`,
          })}
          confirmLabel={t("deleteConfirm")}
          cancelLabel={tc("cancel")}
          pendingLabel={tc("deleting")}
          successMessage={tf("staffDeleted")}
          errorMessage={tf("deleteFailed")}
        />
        <FormSubmitButton
          idleLabel={t("save")}
          pendingLabel={t("submitting")}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        />
      </div>
    </MutationForm>
  );

  return (
    <div className="space-y-4">
      <Link
        href={`/${locale}/people`}
        className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
      >
        ← {t("back")}
      </Link>

      <StaffProfileHeader
        identity={identity}
        editForm={editForm}
        editLabel={t("editProfile")}
        cancelLabel={tc("cancel")}
        editable={canManage}
      />

      <ProfileTabs items={tabs} label={t("tabs.label")} />

      {children}
    </div>
  );
}
