"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Modal } from "@/components/ui/Modal";
import { FormSubmitButton } from "@/components/FormSubmitButton";
import { MutationForm } from "@/components/ui/MutationForm";
import { safeFeedbackMessage } from "@/lib/feedback";

type ActionState = { error?: string; ok?: boolean } | null;

/**
 * Row-level "Upravljaj" control: edit name/category and delete when allowed.
 * Uses a dialog (not an inline table popover) so it is never clipped and works
 * on mobile. Delete is blocked server-side when the team has history; the
 * returned message is shown in place instead of closing the dialog.
 */
export function TeamManageDialog({
  team,
  categories,
  canEdit,
  canDelete,
  updateAction,
  deleteAction,
  labels,
}: {
  team: { id: string; name: string; category: string };
  categories: { value: string; label: string }[];
  canEdit: boolean;
  canDelete: boolean;
  updateAction: (state: ActionState, formData: FormData) => Promise<ActionState>;
  deleteAction: (state: ActionState, formData: FormData) => Promise<ActionState>;
  labels: {
    manage: string;
    name: string;
    category: string;
    save: string;
    saving: string;
    delete: string;
    deleteBody: string;
    deleteConfirm: string;
    deleting: string;
    cancel: string;
  };
}) {
  const tf = useTranslations("feedback");
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"edit" | "delete">(canEdit ? "edit" : "delete");
  const [editState, setEditState] = useState<ActionState>(null);
  const [deleteState, setDeleteState] = useState<ActionState>(null);

  const close = () => setOpen(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md px-2 py-1 text-xs font-medium text-primary transition-colors hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        {labels.manage}
      </button>

      <Modal open={open} onClose={close} title={team.name}>
        {view === "edit" && canEdit ? (
          <MutationForm
            action={async (formData) => updateAction(null, formData)}
            successMessage={tf("teamUpdated")}
            errorMessage={tf("saveFailed")}
            resetOnSuccess={false}
            onResult={(outcome) => {
              if (outcome && !outcome.ok) {
                setEditState({
                  error: safeFeedbackMessage(outcome.error, tf("saveFailed")),
                });
              }
            }}
            className="grid gap-3"
          >
            <input type="hidden" name="id" value={team.id} />
            <label className="grid gap-1 text-xs text-muted-foreground">
              {labels.name}
              <input
                name="name"
                defaultValue={team.name}
                required
                className="field"
              />
            </label>
            <label className="grid gap-1 text-xs text-muted-foreground">
              {labels.category}
              <select
                name="category"
                defaultValue={team.category}
                required
                className="field"
              >
                {categories.map((category) => (
                  <option key={category.value} value={category.value}>
                    {category.label}
                  </option>
                ))}
              </select>
            </label>

            {editState?.error && (
              <p role="alert" className="text-sm text-destructive">
                {editState.error}
              </p>
            )}

            <div className="mt-1 flex items-center justify-between gap-2">
              {canDelete ? (
                <button
                  type="button"
                  onClick={() => setView("delete")}
                  className="rounded-lg px-2 py-1 text-sm font-medium text-destructive transition-colors hover:bg-destructive/5"
                >
                  {labels.delete}
                </button>
              ) : (
                <span />
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={close}
                  className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
                >
                  {labels.cancel}
                </button>
                <FormSubmitButton
                  idleLabel={labels.save}
                  pendingLabel={labels.saving}
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
                />
              </div>
            </div>
          </MutationForm>
        ) : canDelete ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{labels.deleteBody}</p>
            {deleteState?.error && (
              <p role="alert" className="text-sm text-destructive">
                {deleteState.error}
              </p>
            )}
            <MutationForm
              action={async (formData) => deleteAction(null, formData)}
              successMessage={tf("teamDeleted")}
              errorMessage={tf("deleteFailed")}
              resetOnSuccess={false}
              onResult={(outcome) => {
                if (outcome?.ok) {
                  setOpen(false);
                } else if (outcome) {
                  setDeleteState({
                    error: safeFeedbackMessage(outcome.error, tf("deleteFailed")),
                  });
                }
              }}
              className="flex justify-end gap-2"
            >
              <input type="hidden" name="id" value={team.id} />
              <button
                type="button"
                onClick={() => (canEdit ? setView("edit") : close())}
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
              >
                {labels.cancel}
              </button>
              <FormSubmitButton
                idleLabel={labels.deleteConfirm}
                pendingLabel={labels.deleting}
                className="rounded-lg bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90"
              />
            </MutationForm>
          </div>
        ) : null}
      </Modal>
    </>
  );
}
