"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * Viewport-level right-side drawer.
 *
 * Rendered through a portal into <body>, so no page wrapper can become its
 * containing block: the panel is always pinned to the real viewport
 * (top: 0, right: 0, height: 100dvh), never to the page content box.
 *
 * Layout is a strict three-part flex column:
 *   header (fixed height) / body (the ONLY scroll container) / footer (fixed).
 * The page behind is scroll-locked while the drawer is open, and the body
 * always starts at scrollTop 0 on open.
 */
export function Drawer({
  open,
  onClose,
  title,
  subtitle,
  ariaLabel,
  closeLabel,
  size = "md",
  footer,
  dismissOnOverlayClick = true,
  dismissOnEscape = true,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  ariaLabel?: string;
  closeLabel: string;
  /**
   * md = 448px, form = 560px, lg = 640px on desktop; always full width on
   * phones.
   */
  size?: "md" | "form" | "lg";
  /** Sticky footer outside the scroll area (primary action stays visible). */
  footer?: ReactNode;
  /**
   * Set false to make the header X the only close action: backdrop clicks and
   * clicks on the page behind are ignored. Other drawers keep the default.
   */
  dismissOnOverlayClick?: boolean;
  /** Set false to keep the drawer open on Escape. Other drawers keep the default. */
  dismissOnEscape?: boolean;
  children: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || !dismissOnEscape) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose, dismissOnEscape]);

  // Focus the panel ONCE per open. Deliberately depends on `open` only:
  // callers pass a fresh `onClose` identity on every render, and re-focusing
  // here would steal focus from whatever the user is typing into (e.g. the
  // email field of the add-user drawer).
  useEffect(() => {
    if (!open) return;
    panelRef.current?.focus();
  }, [open]);

  // Lock the page scroll behind the drawer.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  // Every open starts at the top of the form.
  useEffect(() => {
    if (!open) return;
    scrollRef.current?.scrollTo({ top: 0 });
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel ?? title}
      className="fixed inset-0 z-50 bg-black/50"
      onClick={dismissOnOverlayClick ? onClose : undefined}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        className={`fixed inset-y-0 right-0 flex h-dvh w-full flex-col border-l border-border bg-card shadow-xl focus:outline-none ${
          size === "lg"
            ? "sm:max-w-[640px]"
            : size === "form"
              ? "sm:max-w-[560px]"
              : "sm:max-w-md"
        }`}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-6 py-3.5">
          <div className="min-w-0">
            {title && (
              <h2 className="truncate text-base font-semibold text-foreground">
                {title}
              </h2>
            )}
            {subtitle && (
              <p className="truncate text-sm text-muted-foreground">{subtitle}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={closeLabel}
            className="-mr-1.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <span aria-hidden="true" className="text-lg leading-none">
              ×
            </span>
          </button>
        </header>

        <div
          ref={scrollRef}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-6"
        >
          {children}
        </div>

        {footer && (
          <div className="shrink-0 border-t border-border bg-card px-6 py-3">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
