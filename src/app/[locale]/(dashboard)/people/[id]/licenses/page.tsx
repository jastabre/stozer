import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { hasPermission } from "@/lib/organization";
import { loadStaffShell } from "@/lib/staff-profile";
import { formatDmy } from "@/lib/date-format";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ConfirmDeleteButton } from "@/components/ConfirmDeleteButton";
import { StaffLicenseDialog } from "@/components/staff/StaffLicenseDialog";
import { deleteStaffLicenseAction, saveStaffLicenseAction } from "../../actions";

export default async function StaffLicensesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [canView, canManage] = await Promise.all([
    hasPermission("staff.view"),
    hasPermission("staff.manage"),
  ]);
  if (!canView) notFound();

  const { person } = await loadStaffShell(id);
  if (!person) notFound();

  const t = await getTranslations("people");
  const tc = await getTranslations("common");
  const tf = await getTranslations("feedback");

  const addDialog = (
    <StaffLicenseDialog
      action={saveStaffLicenseAction}
      staffId={person.id}
      labels={{
        addTitle: t("addLicense"),
        editTitle: t("editLicense"),
        type: t("licenseType"),
        number: t("licenseNumber"),
        validUntil: t("validUntil"),
        submit: t("save"),
        submitting: t("submitting"),
        cancel: tc("cancel"),
      }}
      triggerLabel={t("addLicense")}
      triggerClassName="inline-flex h-9 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
    />
  );

  return (
    <div className="max-w-3xl space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">{t("licenses")}</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">{t("licenseHint")}</p>
        </div>
        {canManage && addDialog}
      </div>

      {person.licenses.length === 0 ? (
        <p className="py-1 text-sm text-muted-foreground">{t("noLicenses")}</p>
      ) : (
        <ul className="divide-y divide-border">
          {person.licenses.map((license) => (
            <li
              key={license.id}
              className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-2.5 first:pt-0 last:pb-0"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">
                  {license.license_type}
                </p>
                <p className="text-xs text-muted-foreground">
                  {license.license_number
                    ? `${t("licenseNumber")}: ${license.license_number} · `
                    : ""}
                  {t("validUntil")}: {formatDmy(license.valid_until)}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <StatusBadge
                  tone={license.status ?? "red"}
                  label={t(`status.${license.status ?? "red"}`)}
                />
                {canManage && (
                  <>
                    <StaffLicenseDialog
                      action={saveStaffLicenseAction}
                      staffId={person.id}
                      license={{
                        id: license.id,
                        license_type: license.license_type,
                        license_number: license.license_number,
                        valid_until: license.valid_until,
                      }}
                      labels={{
                        addTitle: t("addLicense"),
                        editTitle: t("editLicense"),
                        type: t("licenseType"),
                        number: t("licenseNumber"),
                        validUntil: t("validUntil"),
                        submit: t("save"),
                        submitting: t("submitting"),
                        cancel: tc("cancel"),
                      }}
                      triggerLabel={tc("edit")}
                      triggerClassName="rounded text-xs font-medium text-primary hover:underline"
                    />
                    <ConfirmDeleteButton
                      action={deleteStaffLicenseAction}
                      hiddenFields={{ staff_id: person.id, license_id: license.id }}
                      triggerLabel={tc("delete")}
                      triggerClassName="rounded text-xs font-medium text-destructive hover:underline"
                      title={t("licenseDeleteTitle")}
                      body={t("licenseDeleteBody", { name: license.license_type })}
                      confirmLabel={t("licenseDelete")}
                      cancelLabel={tc("cancel")}
                      pendingLabel={tc("deleting")}
                      successMessage={tf("itemDeleted")}
                      errorMessage={tf("deleteFailed")}
                    />
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
