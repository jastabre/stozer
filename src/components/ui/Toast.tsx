"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";

export type ToastTone = "success" | "error" | "info";

interface ToastItem {
  id: number;
  tone: ToastTone;
  message: string;
}

interface ToastContextValue {
  show: (tone: ToastTone, message: string) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

/** Auto-dismiss window per tone; errors stay a little longer. */
const AUTO_DISMISS_MS: Record<ToastTone, number> = {
  success: 4000,
  info: 4000,
  error: 6000,
};

const MAX_VISIBLE = 3;

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast() must be used inside <ToastProvider>.");
  }
  return context;
}

/**
 * App-level feedback toasts. Mounted once in the locale layout, so a toast
 * survives drawer/modal unmounts and client navigations. Only short
 * success/error/info messages live here — no notification center.
 */
export function ToastProvider({
  children,
  dismissLabel,
}: {
  children: ReactNode;
  dismissLabel: string;
}) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const show = useCallback((tone: ToastTone, message: string) => {
    const text = message.trim();
    if (!text) return;
    setItems((current) => [
      ...current.slice(-(MAX_VISIBLE - 1)),
      { id: nextId.current++, tone, message: text },
    ]);
  }, []);

  const value = useMemo<ToastContextValue>(
    () => ({
      show,
      success: (message: string) => show("success", message),
      error: (message: string) => show("error", message),
      info: (message: string) => show("info", message),
    }),
    [show]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[100] flex flex-col items-center gap-2 p-4 sm:items-end">
        {items.map((item) => (
          <ToastCard
            key={item.id}
            item={item}
            dismissLabel={dismissLabel}
            onDismiss={dismiss}
          />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastCard({
  item,
  dismissLabel,
  onDismiss,
}: {
  item: ToastItem;
  dismissLabel: string;
  onDismiss: (id: number) => void;
}) {
  useEffect(() => {
    const timer = window.setTimeout(
      () => onDismiss(item.id),
      AUTO_DISMISS_MS[item.tone]
    );
    return () => window.clearTimeout(timer);
  }, [item.id, item.tone, onDismiss]);

  const Icon =
    item.tone === "success"
      ? CheckCircle2
      : item.tone === "error"
        ? AlertCircle
        : Info;
  const iconClass =
    item.tone === "success"
      ? "text-success"
      : item.tone === "error"
        ? "text-destructive"
        : "text-primary";

  return (
    <div
      role={item.tone === "error" ? "alert" : "status"}
      aria-live={item.tone === "error" ? "assertive" : "polite"}
      className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border border-border bg-card p-3.5 text-sm text-foreground shadow-lg"
    >
      <Icon aria-hidden="true" className={`mt-0.5 h-4 w-4 shrink-0 ${iconClass}`} />
      <p className="min-w-0 flex-1 break-words">{item.message}</p>
      <button
        type="button"
        onClick={() => onDismiss(item.id)}
        aria-label={dismissLabel}
        className="-mr-1 -mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <X className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </div>
  );
}
