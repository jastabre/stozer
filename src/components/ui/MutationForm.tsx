"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useTransition,
  type ComponentPropsWithoutRef,
} from "react";
import { unstable_rethrow } from "next/navigation";
import { safeFeedbackMessage } from "@/lib/feedback";
import { useToast } from "@/components/ui/Toast";

/**
 * Pending flag for the mutation form currently wrapping the submit button.
 * FormSubmitButton falls back to it, so buttons keep showing spinner + pending
 * label even though the form is submitted through onSubmit (not a form action).
 */
const MutationPendingContext = createContext(false);

export function useMutationPending(): boolean {
  return useContext(MutationPendingContext);
}

export interface MutationOutcome {
  ok: boolean;
  error?: string;
}

/** Normalizes whatever a server action returned into a feedback outcome. */
export function readMutationOutcome(result: unknown): MutationOutcome {
  if (result && typeof result === "object") {
    const record = result as { ok?: unknown; error?: unknown };
    if (typeof record.error === "string" && record.error.trim()) {
      return { ok: false, error: record.error };
    }
    if (record.ok === false) return { ok: false };
  }
  return { ok: true };
}

/**
 * True when the rejection is a Next.js control-flow error (redirect/notFound).
 * Navigation has already been dispatched by the router at this point.
 */
export function isNavigationError(error: unknown): boolean {
  try {
    unstable_rethrow(error);
    return false;
  } catch {
    return true;
  }
}

export type MutationFormProps = Omit<
  ComponentPropsWithoutRef<"form">,
  "action" | "onSubmit"
> & {
  /** Server action (or client wrapper) that performs the mutation. */
  action: (formData: FormData) => Promise<unknown>;
  /** Concrete success message, e.g. "Promene su sačuvane". */
  successMessage: string;
  /** User-friendly fallback when the action fails without its own message. */
  errorMessage: string;
  /**
   * Reset uncontrolled fields after a successful mutation. Defaults to true
   * (native form behaviour). Set false for controlled fields or flows that
   * manage their own reset.
   */
  resetOnSuccess?: boolean;
  /** Called with the normalized outcome after every completed submission. */
  onResult?: (outcome: MutationOutcome | null) => void;
  /** Called when the pending state changes (for buttons outside the form). */
  onPendingChange?: (pending: boolean) => void;
  /** Client-side gate that runs before the action; return a message to block. */
  validate?: (formData: FormData) => string | null;
  /** Receives the message returned by `validate`. */
  onValidationError?: (message: string) => void;
};

/**
 * The single mutation form primitive: real pending state (no double submit),
 * success toast only after the server confirms, error toast with a safe
 * message, and field values preserved on failure (onSubmit + preventDefault,
 * so React never auto-resets on error).
 */
export function MutationForm({
  action,
  successMessage,
  errorMessage,
  resetOnSuccess = true,
  onResult,
  onPendingChange,
  validate,
  onValidationError,
  children,
  ...formProps
}: MutationFormProps) {
  const { success, error } = useToast();
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const running = useRef(false);

  useEffect(() => {
    onPendingChange?.(pending);
  }, [pending, onPendingChange]);

  const handleSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (running.current) return;
      running.current = true;

      const form = event.currentTarget;
      const formData = new FormData(form);

      if (validate) {
        const message = validate(formData);
        if (message) {
          onValidationError?.(message);
          return;
        }
      }

      startTransition(async () => {
        let outcome: MutationOutcome | null = null;
        try {
          const result = await action(formData);
          outcome = readMutationOutcome(result);
          if (outcome.ok) {
            success(successMessage);
            if (resetOnSuccess) form.reset();
          } else {
            error(safeFeedbackMessage(outcome.error, errorMessage));
          }
        } catch (caught) {
          if (isNavigationError(caught)) {
            // Redirects are a success path; the router already navigates.
            success(successMessage);
          } else {
            // Surface a friendly thrown message (e.g. a jersey conflict), but
            // keep raw backend text out via the shared safeFeedbackMessage guard.
            error(
              safeFeedbackMessage(
                caught instanceof Error ? caught.message : undefined,
                errorMessage
              )
            );
          }
        } finally {
          running.current = false;
          onResult?.(outcome);
        }
      });
    },
    [
      action,
      successMessage,
      errorMessage,
      resetOnSuccess,
      onResult,
      validate,
      onValidationError,
      success,
      error,
    ]
  );

  const contextValue = useMemo(() => pending, [pending]);

  return (
    <MutationPendingContext.Provider value={contextValue}>
      <form ref={formRef} onSubmit={handleSubmit} {...formProps}>
        {children}
      </form>
    </MutationPendingContext.Provider>
  );
}
