"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Modal } from "@/components/ui/Modal";
import { FormSubmitButton } from "@/components/FormSubmitButton";
import { MutationForm } from "@/components/ui/MutationForm";
import { DateField } from "@/components/ui/DateField";

interface StaffLicenseDraft {
  id: string;
  license_type: string;
  license_number: string | null;
  valid_until: string;
}

interface StaffLicenseDialogProps {
  action: (formData: FormData) => Promise<void>;
  staffId: string;
  /** When present the dialog edits that row instead of creating a new one. */
  license?: StaffLicenseDraft;
  labels: {
    addTitle: string;
    editTitle: string;
    type: string;
    number: string;
    validUntil: string;
    submit: string;
    submitting: string;
    cancel: string;
  };
  triggerLabel: string;
  triggerClassName: string;
}

/**
 * Single license form dialog, used both for "Dodaj licencu" and per-row edit.
 * The form posts to the unchanged staff license server action; ids stay hidden
 * because they are not user-facing.
 */
export function StaffLicenseDialog({
  action,
  staffId,
  license,
  labels,
  triggerLabel,
  triggerClassName,
}: StaffLicenseDialogProps) {
  const tf = useTranslations("feedback");
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={triggerClassName}>
        {triggerLabel}
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={license ? labels.editTitle : labels.addTitle}
      >
        <MutationForm
          action={action}
          successMessage={tf("licenseSaved")}
          errorMessage={tf("saveFailed")}
          className="grid gap-3 sm:grid-cols-2"
        >
          <input type="hidden" name="staff_id" value={staffId} />
          {license && <input type="hidden" name="id" value={license.id} />}

          <label className="grid gap-1 text-xs text-muted-foreground sm:col-span-2">
            {labels.type}
            <input
              name="license_type"
              defaultValue={license?.license_type ?? ""}
              required
              className="field"
            />
          </label>

          <label className="grid gap-1 text-xs text-muted-foreground">
            {labels.number}
            <input
              name="license_number"
              defaultValue={license?.license_number ?? ""}
              className="field"
            />
          </label>

          <label className="grid gap-1 text-xs text-muted-foreground">
            {labels.validUntil}
            <DateField
              name="valid_until"
              defaultValue={license?.valid_until ?? ""}
              required
              ariaLabel={labels.validUntil}
            />
          </label>

          <div className="flex items-center justify-end gap-2 sm:col-span-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
            >
              {labels.cancel}
            </button>
            <FormSubmitButton
              idleLabel={labels.submit}
              pendingLabel={labels.submitting}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            />
          </div>
        </MutationForm>
      </Modal>
    </>
  );
}
