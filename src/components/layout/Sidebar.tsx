"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { createBrowserClient } from "@/lib/supabase/browser";
import { getNavConfig, type NavItem as NavItemType } from "@/lib/rbac";
import type { AppRole } from "@/types/database";
import { Menu, X } from "lucide-react";
import { NavItem } from "./NavItem";
import { UserMenu } from "./UserMenu";

export function Sidebar({ orgId: _orgId }: { orgId: string }) {
  const [open, setOpen] = useState(false);
  const [navItems, setNavItems] = useState<NavItemType[]>([]);
  const t = useTranslations("navigation");

  useEffect(() => {
    async function loadRole() {
      const supabase = createBrowserClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const role = (user?.app_metadata?.user_role as string) || "club_president";
      setNavItems(getNavConfig(role as AppRole));
    }
    loadRole();
  }, []);

  return (
    <>
      {/* Mobile hamburger */}
      <button
        onClick={() => setOpen(true)}
        className="fixed left-4 top-4 z-40 flex h-11 w-11 items-center justify-center rounded-lg bg-card shadow-md md:hidden"
        aria-label={t("home")}
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

        <nav className="flex-1 space-y-1 p-3">
          {navItems.map((item) => (
            <NavItem
              key={item.href}
              label={item.label}
              href={item.href}
              icon={item.icon}
            />
          ))}
        </nav>

        <div className="border-t border-border p-3">
          <UserMenu />
        </div>
      </aside>
    </>
  );
}
