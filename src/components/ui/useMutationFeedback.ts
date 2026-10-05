"use client";

import { useActionState, useCallback, useEffect, useRef } from "react";
import { safeFeedbackMessage } from "@/lib/feedback";
import { isNavigationError } from "@/components/ui/MutationForm";
import { useToast } from "@/components/ui/Toast";

export interface MutationState {
  ok?: boolean;
  error?: string;
}

export interface UseMutationFeedbackOptions<S extends MutationState> {
  /** Fixed success message, or a resolver for actions with several outcomes. */
  successMessage: string | ((state: S | null) => string);
  errorMessage: string;
  initialState?: S | null;
  /** Called when the action completes successfully (returned ok or redirect). */
  onSuccess?: () => void;
}

/**
 * useActionState plus the global feedback standard: success toast on
 * `{ ok: true }` (or on a redirect, which is this app's success path), error
 * toast on `{ error }` or on a thrown action error. Returns the exact same
 * tuple shape as useActionState so call sites only swap the hook.
 *
 * Only use this for forms whose fields are controlled or reset manually:
 * React resets uncontrolled fields when an action resolves, including when it
 * returns an error state. Uncontrolled forms should use <MutationForm>.
 */
export function useMutationFeedback<S extends MutationState>(
  action: (state: S | null, formData: FormData) => Promise<S | null>,
  {
    successMessage,
    errorMessage,
    initialState,
    onSuccess,
  }: UseMutationFeedbackOptions<S>
): [S | null, (formData: FormData) => void, boolean] {
  const { success, error } = useToast();

  const resolveSuccess = useCallback(
    (state: S | null) =>
      typeof successMessage === "function"
        ? successMessage(state)
        : successMessage,
    [successMessage]
  );

  const wrappedAction = useCallback(
    async (previous: S | null, formData: FormData): Promise<S | null> => {
      try {
        return await action(previous, formData);
      } catch (caught) {
        if (isNavigationError(caught)) {
          success(resolveSuccess(previous));
          return previous;
        }
        error(errorMessage);
        return previous;
      }
    },
    [action, success, error, resolveSuccess, errorMessage]
  );

  const [state, formAction, pending] = useActionState<S | null, FormData>(
    wrappedAction,
    (initialState ?? null) as Awaited<S> | null
  );
  const handled = useRef<S | null>(null);

  useEffect(() => {
    if (!state || state === handled.current) return;
    handled.current = state;
    if (state.ok) {
      success(resolveSuccess(state));
      onSuccess?.();
      return;
    }
    if (state.error) {
      error(safeFeedbackMessage(state.error, errorMessage));
    }
  }, [state, success, error, resolveSuccess, errorMessage, onSuccess]);

  return [state, formAction, pending];
}
