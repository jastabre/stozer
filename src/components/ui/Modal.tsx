"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * Minimal accessible dialog used for compact forms and confirmations. Rendered
 * through a portal into <body> so no transformed page wrapper can become its
 * containing block (fixed overlays must always track the real viewport).
 * Closes on overlay click and Escape; moves focus into the panel on open.
 */
export function Modal({
  open,
  onClose,
  title,
  ariaLabel,
  panelClassName,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  ariaLabel?: string;
  panelClassName?: string;
  children: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    panelRef.current?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel ?? title}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        className={`w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-xl focus:outline-none ${
          panelClassName ?? ""
        }`}
        onClick={(event) => event.stopPropagation()}
      >
        {title && <h3 className="text-lg font-semibold">{title}</h3>}
        <div className={title ? "mt-3" : undefined}>{children}</div>
      </div>
    </div>,
    document.body
  );
}
