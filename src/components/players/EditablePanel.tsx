"use client";

import { useState } from "react";

interface EditablePanelProps {
  title: string;
  editLabel: string;
  cancelLabel: string;
  /** When false the section is pure view (no edit affordance). */
  editable?: boolean;
  children: React.ReactNode;
  editForm: React.ReactNode;
}

/**
 * View-first section wrapper for the player profile. Shows compact read-only
 * content by default; "Izmeni" swaps in a focused edit form. Keeps the
 * profile a dossier, not an open database form.
 */
export function EditablePanel({
  title,
  editLabel,
  cancelLabel,
  editable = true,
  children,
  editForm,
}: EditablePanelProps) {
  const [open, setOpen] = useState(false);

  return (
    <section className="rounded-xl border border-border bg-card">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2.5 sm:px-5">
        <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          {title}
        </h2>
        {editable && (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:border-primary"
          >
            {open ? cancelLabel : editLabel}
          </button>
        )}
      </header>
      {open && editable ? (
        <div className="px-4 py-4 sm:px-5">{editForm}</div>
      ) : (
        <div className="px-4 py-4 sm:px-5">{children}</div>
      )}
    </section>
  );
}