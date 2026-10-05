"use client";

import { useState, type ReactNode } from "react";
import { MutationForm, useMutationPending } from "@/components/ui/MutationForm";

interface ConfirmDeleteButtonProps {
  action: (formData: FormData) => Promise<unknown>;
  hiddenFields: Record<string, string>;
  /** Trigger content — a string label, or an icon with `triggerAriaLabel`. */
  triggerLabel: ReactNode;
  /** Accessible name when the trigger is an icon rather than text. */
  triggerAriaLabel?: string;
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel: string;
  /** Concrete success message, e.g. "Zapis je obrisan". */
  successMessage: string;
  /** User-friendly fallback when the action fails. */
  errorMessage: string;
  triggerClassName?: string;
  pendingLabel?: string;
}

/**
 * Destructive-action guard: the trigger opens a confirmation dialog and the
 * server action only runs after the user confirms. The confirm button shows a
 * real pending state, the dialog closes only after the server confirms, and
 * the result is announced with the global feedback toast.
 */
export function ConfirmDeleteButton({
  action,
  hiddenFields,
  triggerLabel,
  triggerAriaLabel,
  title,
  body,
  confirmLabel,
  cancelLabel,
  successMessage,
  errorMessage,
  triggerClassName,
  pendingLabel,
}: ConfirmDeleteButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={triggerAriaLabel}
        className={triggerClassName}
      >
        {triggerLabel}
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={title}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold">{title}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{body}</p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
              >
                {cancelLabel}
              </button>
              <MutationForm
                action={action}
                successMessage={successMessage}
                errorMessage={errorMessage}
                resetOnSuccess={false}
                onResult={(outcome) => {
                  if (outcome?.ok) setOpen(false);
                }}
              >
                {Object.entries(hiddenFields).map(([name, value]) => (
                  <input key={name} type="hidden" name={name} value={value} />
                ))}
                <DeleteConfirmButton
                  confirmLabel={confirmLabel}
                  pendingLabel={pendingLabel ?? confirmLabel}
                />
              </MutationForm>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function DeleteConfirmButton({
  confirmLabel,
  pendingLabel,
}: {
  confirmLabel: string;
  pendingLabel: string;
}) {
  const pending = useMutationPending();

  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center gap-2 rounded-lg bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 disabled:cursor-wait disabled:opacity-60"
    >
      {pending && (
        <span
          aria-hidden="true"
          className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      )}
      {pending ? pendingLabel : confirmLabel}
    </button>
  );
}
