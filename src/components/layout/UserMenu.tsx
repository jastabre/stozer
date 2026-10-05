"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase/browser";
import { LogOut } from "lucide-react";

export function UserMenu({
  email,
  initials,
  logoutLabel,
}: {
  email?: string | null;
  initials: string;
  logoutLabel: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  async function handleLogout() {
    const supabase = createBrowserClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={email ?? logoutLabel}
        className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-card text-xs font-semibold text-foreground hover:border-foreground/30"
      >
        {initials}
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div
            role="menu"
            className="absolute right-0 top-10 z-50 w-64 rounded-xl border border-border bg-popover p-1 shadow-raised animate-fade"
          >
            {email && (
              <div className="border-b border-border px-3 py-2.5">
                <p className="truncate text-sm font-medium text-foreground">{email}</p>
              </div>
            )}
            <button
              type="button"
              role="menuitem"
              onClick={handleLogout}
              className="mt-1 flex h-9 w-full items-center gap-2.5 rounded-lg px-3 text-sm font-medium text-foreground hover:bg-muted"
            >
              <LogOut className="h-4 w-4" />
              {logoutLabel}
            </button>
          </div>
        </>
      )}
    </div>
  );
}