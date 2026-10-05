"use client";

import { useState } from "react";
import { Drawer } from "@/components/ui/Drawer";
import { FormSubmitButton } from "@/components/FormSubmitButton";
import { MutationForm } from "@/components/ui/MutationForm";
import { FilePicker } from "@/components/ui/FilePicker";
import {
  CLUB_DOCUMENT_CATEGORIES,
  CLUB_DOCUMENT_MIME_ACCEPT,
  type ClubDocumentCategory,
  type ClubDocumentEntry,
} from "@/lib/club-documents";

export interface ClubDocumentDrawerLabels {
  addTitle: string;
  editTitle: string;
  name: string;
  namePlaceholder: string;
  category: string;
  notes: string;
  notesPlaceholder: string;
  file: string;
  choose: string;
  hint: string;
  change: string;
  currentFile: string;
  submitCreate: string;
  submittingCreate: string;
  submitEdit: string;
  submittingEdit: string;
  close: string;
  cancel: string;
  categoryLabels: Record<ClubDocumentCategory, string>;
}

interface ClubDocumentDrawerProps {
  mode: "create" | "edit";
  action: (formData: FormData) => Promise<unknown>;
  document?: ClubDocumentEntry;
  triggerLabel: string;
  triggerClassName: string;
  successMessage: string;
  errorMessage: string;
  defaultOpen?: boolean;
  labels: ClubDocumentDrawerLabels;
}

/**
 * Add / edit a club library item. Create mode requires a file; edit mode only
 * changes the metadata (the uploaded file is never replaced). Uses the shared
 * mutation form so pending state, toasts and no-double-submit come for free.
 */
export function ClubDocumentDrawer({
  mode,
  action,
  document,
  triggerLabel,
  triggerClassName,
  successMessage,
  errorMessage,
  defaultOpen,
  labels,
}: ClubDocumentDrawerProps) {
  const isEdit = mode === "edit";
  const formId = isEdit
    ? `club-document-edit-${document?.id ?? "item"}`
    : "club-document-create";
  const [open, setOpen] = useState(defaultOpen ?? false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={triggerClassName}
      >
        {triggerLabel}
      </button>

      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title={isEdit ? labels.editTitle : labels.addTitle}
        closeLabel={labels.close}
        size="form"
        footer={
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
            >
              {labels.cancel}
            </button>
            <FormSubmitButton
              form={formId}
              idleLabel={isEdit ? labels.submitEdit : labels.submitCreate}
              pendingLabel={
                isEdit ? labels.submittingEdit : labels.submittingCreate
              }
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            />
          </div>
        }
      >
        <MutationForm
          id={formId}
          action={action}
          successMessage={successMessage}
          errorMessage={errorMessage}
          onResult={(outcome) => {
            if (outcome?.ok) setOpen(false);
          }}
          className="grid gap-4"
        >
          {isEdit && document && (
            <input type="hidden" name="document_id" value={document.id} />
          )}

          <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">
            {labels.name}
            <input
              name="name"
              required
              maxLength={200}
              defaultValue={document?.name ?? ""}
              placeholder={labels.namePlaceholder}
              className="field"
            />
          </label>

          <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">
            {labels.category}
            <select
              name="category"
              defaultValue={document?.category ?? "other"}
              className="field"
            >
              {CLUB_DOCUMENT_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {labels.categoryLabels[category]}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">
            {labels.notes}
            <textarea
              name="notes"
              rows={3}
              maxLength={2000}
              defaultValue={document?.notes ?? ""}
              placeholder={labels.notesPlaceholder}
              className="field"
            />
          </label>

          {isEdit && document ? (
            <div className="grid gap-1 text-xs text-muted-foreground">
              {labels.currentFile}
              <p className="truncate rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-foreground">
                {document.filename}
              </p>
            </div>
          ) : (
            <div className="grid gap-1 text-xs text-muted-foreground">
              {labels.file}
              <FilePicker
                name="file"
                accept={CLUB_DOCUMENT_MIME_ACCEPT}
                required
                labels={{
                  choose: labels.choose,
                  hint: labels.hint,
                  change: labels.change,
                }}
              />
            </div>
          )}
        </MutationForm>
      </Drawer>
    </>
  );
}
