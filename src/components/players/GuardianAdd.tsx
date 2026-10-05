"use client";

import { useState } from "react";
import { GuardianForm, type GuardianFormLabels } from "./GuardianForm";

/**
 * Player-tab "add guardian" region. Owns the expandable form so the compact
 * empty state and the open add form never appear at once: the empty state shows
 * only while there are no guardians and the form is closed. After a successful
 * add the route re-renders (server redirect), the form resets closed and the
 * list takes over.
 */
export function GuardianAdd({
  canEdit,
  hasGuardians,
  action,
  athleteId,
  labels,
  emptyLabel,
  header,
}: {
  canEdit: boolean;
  hasGuardians: boolean;
  action: (formData: FormData) => Promise<void>;
  athleteId: string;
  labels: GuardianFormLabels;
  emptyLabel: string;
  header: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-4">
      {canEdit ? (
        <details
          className="group"
          onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}
        >
          <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-x-4 gap-y-2 [&::-webkit-details-marker]:hidden">
            {header}
            <span className="inline-flex h-9 shrink-0 items-center rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground">
              {labels.save}
            </span>
          </summary>
          <div className="mt-3 rounded-xl border border-border bg-card p-4 sm:p-5">
            <GuardianForm
              action={action}
              athleteId={athleteId}
              labels={labels}
            />
          </div>
        </details>
      ) : (
        header
      )}

      {!hasGuardians && !open && (
        <p className="rounded-xl border border-border bg-card px-4 py-4 text-sm text-muted-foreground sm:px-5">
          {emptyLabel}
        </p>
      )}
    </div>
  );
}
