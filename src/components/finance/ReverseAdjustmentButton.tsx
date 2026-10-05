"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { MutationForm, useMutationPending } from "@/components/ui/MutationForm";

/**
 * Discreet "Poništi korekciju" action for one adjustment. Opens a confirmation
 * dialog (portaled to <body>, so it stays valid inside the bulk-payment
 * form/table) and only then runs the reversal server action. The confirm
 * button shows a real pending state (spinner, double-submit blocked), the
 * dialog closes only after the server confirms, and the result is announced
 * with the global feedback toast.
 */
export function ReverseAdjustmentButton({
  action,
  adjustmentId,
  athleteId,
  amountLabel,
  labels,
  triggerClassName,
}: {
  action: (formData: FormData) => Promise<void>;
  adjustmentId: string;
  athleteId: string;
  /** Signed amount already formatted, e.g. "+20.000 RSD". */
  amountLabel: string;
  labels: {
    reverse: string;
    reverseTitle: string;
    reverseBody: string;
    cancel: string;
    pending: string;
  };
  triggerClassName?: string;
}) {
  const tf = useTranslations("feedback");
  const [open, setOpen] = useState(false);
  const title = labels.reverseTitle.replace("{amount}", amountLabel);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={triggerClassName}>
        {labels.reverse}
      </button>

      {open &&
        createPortal(
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
              <p className="mt-2 text-sm text-muted-foreground">{labels.reverseBody}</p>
              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
                >
                  {labels.cancel}
                </button>
                <MutationForm
                  action={action}
                  successMessage={tf("adjustmentReversed")}
                  errorMessage={tf("reverseFailed")}
                  resetOnSuccess={false}
                  onResult={(outcome) => {
                    if (outcome?.ok) setOpen(false);
                  }}
                >
                  <input type="hidden" name="adjustment_id" value={adjustmentId} />
                  <input type="hidden" name="athlete_id" value={athleteId} />
                  <ReverseConfirmButton
                    confirmLabel={labels.reverse}
                    pendingLabel={labels.pending}
                  />
                </MutationForm>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}

function ReverseConfirmButton({
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
