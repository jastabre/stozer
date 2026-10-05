"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

interface StaffProfileHeaderProps {
  identity: React.ReactNode;
  editForm: React.ReactNode;
  editLabel: string;
  cancelLabel: string;
  editable: boolean;
}

/**
 * Borderless staff identity header with a single "Izmeni profil" affordance.
 * View-first: the form only replaces the identity when a manager opens it, so
 * the profile never reads as an open database form.
 *
 * Open state lives in the `?edit=1` query param so section-level "Izmeni"
 * actions elsewhere on the profile (e.g. next to "Funkcije u klubu") can open
 * the same form without a second edit flow.
 */
export function StaffProfileHeader({
  identity,
  editForm,
  editLabel,
  cancelLabel,
  editable,
}: StaffProfileHeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const open = editable && searchParams.get("edit") === "1";

  const toggle = () => {
    const next = new URLSearchParams(searchParams);
    if (open) {
      next.delete("edit");
    } else {
      next.set("edit", "1");
    }
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, {
      scroll: false,
    });
  };

  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0 flex-1">
        {open && editable ? (
          <div className="rounded-xl border border-border bg-card p-4">{editForm}</div>
        ) : (
          identity
        )}
      </div>
      {editable && (
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          className="shrink-0 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-primary transition-colors hover:border-primary"
        >
          {open ? cancelLabel : editLabel}
        </button>
      )}
    </div>
  );
}
