"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase/browser";
import {
  Menu,
  X,
  Home,
  Users,
  Calendar,
  Settings,
  LogOut,
} from "lucide-react";
import { UserMenu } from "./UserMenu";

const NAV_ITEMS = [
  { label: "Početna", href: "/dashboard", icon: Home },
  { label: "Timovi", href: "/teams", icon: Users },
  { label: "Kalendar", href: "/calendar", icon: Calendar },
  { label: "Podešavanja", href: "/settings", icon: Settings },
];

export function Sidebar({ orgId }: { orgId: string }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <>
      {/* Mobile hamburger */}
      <button
        onClick={() => setOpen(true)}
        className="fixed left-4 top-4 z-40 flex h-11 w-11 items-center justify-center rounded-lg bg-card shadow-md md:hidden"
        aria-label="Otvori meni"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-border bg-sidebar-background transition-transform duration-200 md:relative md:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex h-16 items-center justify-between border-b border-border px-4">
          <span className="text-lg font-bold">STOŽER</span>
          <button
            onClick={() => setOpen(false)}
            className="flex h-11 w-11 items-center justify-center rounded-lg md:hidden"
            aria-label="Zatvori meni"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 p-3">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname?.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={`/sr${item.href}`}
                onClick={() => setOpen(false)}
                className={`flex h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-sidebar-accent text-sidebar-primary"
                    : "text-sidebar-foreground hover:bg-sidebar-accent"
                }`}
              >
                <item.icon className="h-5 w-5" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* User menu */}
        <div className="border-t border-border p-3">
          <UserMenu />
        </div>
      </aside>
    </>
  );
}
