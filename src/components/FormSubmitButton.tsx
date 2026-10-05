"use client";

import { useFormStatus } from "react-dom";
import { useMutationPending } from "@/components/ui/MutationForm";

/**
 * Submit button with a pending state driven by the enclosing server-action
 * form. While the action runs the button is disabled (no double submit) and
 * shows a small spinner plus the pending label.
 */
export function FormSubmitButton({
  idleLabel,
  pendingLabel,
  className,
  formAction,
  form,
  name,
  value,
  pending: pendingOverride,
  disabled: disabledOverride,
}: {
  idleLabel: string;
  pendingLabel: string;
  className?: string;
  formAction?: (formData: FormData) => Promise<void>;
  /** Associate with a form elsewhere in the DOM (drawer sticky footer). */
  form?: string;
  name?: string;
  value?: string;
  /** Optional explicit pending state for forms without a native action. */
  pending?: boolean;
  /** Optional client-side gate (e.g. invalid input) on top of the pending state. */
  disabled?: boolean;
}) {
  const status = useFormStatus();
  const mutationPending = useMutationPending();
  const pending = pendingOverride ?? (status.pending || mutationPending);

  return (
    <button
      type="submit"
      formAction={formAction}
      form={form}
      name={name}
      value={value}
      disabled={pending || disabledOverride}
      className={`inline-flex items-center justify-center gap-2 disabled:cursor-wait disabled:opacity-60 ${
        className ?? ""
      }`}
    >
      {pending && (
        <span
          aria-hidden="true"
          className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      )}
      {pending ? pendingLabel : idleLabel}
    </button>
  );
}