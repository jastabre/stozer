"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { DateField } from "@/components/ui/DateField";
import { FormSubmitButton } from "@/components/FormSubmitButton";
import { MutationForm } from "@/components/ui/MutationForm";
import { safeFeedbackMessage } from "@/lib/feedback";
import { isValidSeasonRange } from "@/lib/season";

type SeasonActionState = { error?: string } | null;

export interface SeasonFormLabels {
  name: string;
  startsOn: string;
  endsOn: string;
  submit: string;
  submitting: string;
  dateRangeError: string;
}

/**
 * Compact season form used for both editing the active season and starting a
 * new one. Name + start + end (DD.MM.GGGG via the shared DateField). The range
 * is validated on the client (instant message) and again on the server.
 */
export function SeasonForm({
  action,
  defaults,
  labels,
  successMessage,
  children,
}: {
  action: (state: SeasonActionState, formData: FormData) => Promise<SeasonActionState>;
  defaults?: { name?: string; starts_on?: string; ends_on?: string };
  labels: SeasonFormLabels;
  successMessage: string;
  children?: React.ReactNode;
}) {
  const tf = useTranslations("feedback");
  const [state, setState] = useState<SeasonActionState>(null);
  const [clientError, setClientError] = useState<string | null>(null);
  const error = clientError ?? state?.error ?? null;

  return (
    <MutationForm
      action={async (formData) => action(null, formData)}
      successMessage={successMessage}
      errorMessage={tf("seasonFailed")}
      resetOnSuccess={false}
      validate={(formData) => {
        const startsOn = String(formData.get("starts_on") ?? "");
        const endsOn = String(formData.get("ends_on") ?? "");
        if ((startsOn || endsOn) && !isValidSeasonRange(startsOn, endsOn)) {
          return labels.dateRangeError;
        }
        return null;
      }}
      onValidationError={(message) => {
        setClientError(message);
        setState(null);
      }}
      onResult={(outcome) => {
        if (outcome && !outcome.ok) {
          setClientError(null);
          setState({
            error: safeFeedbackMessage(outcome.error, tf("seasonFailed")),
          });
        }
      }}
      className="grid gap-4"
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="grid gap-1 text-xs text-muted-foreground">
          {labels.name}
          <input
            name="name"
            defaultValue={defaults?.name ?? ""}
            required
            maxLength={100}
            className="field"
          />
        </label>
        <label className="grid gap-1 text-xs text-muted-foreground">
          {labels.startsOn}
          <DateField
            name="starts_on"
            defaultValue={defaults?.starts_on ?? ""}
            required
            ariaLabel={labels.startsOn}
          />
        </label>
        <label className="grid gap-1 text-xs text-muted-foreground">
          {labels.endsOn}
          <DateField
            name="ends_on"
            defaultValue={defaults?.ends_on ?? ""}
            required
            ariaLabel={labels.endsOn}
          />
        </label>
      </div>

      {children}

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <FormSubmitButton
        idleLabel={labels.submit}
        pendingLabel={labels.submitting}
        className="w-fit rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
      />
    </MutationForm>
  );
}
