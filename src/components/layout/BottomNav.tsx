"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase/browser";
import { getNavConfig, type NavItem as NavItemType } from "@/lib/rbac";
import type { AppRole } from "@/types/database";
import {
  Home,
  Users,
  UsersRound,
  Calendar,
  CalendarCheck,
  Wallet,
  FileText,
  BarChart3,
  Building2,
  GraduationCap,
  MoreHorizontal,
  Settings,
  X,
} from "lucide-react";

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Home,
  Users,
  UsersRound,
  Calendar,
  CalendarCheck,
  Wallet,
  FileText,
  BarChart3,
  Building2,
  GraduationCap,
  MoreHorizontal,
  Settings,
};

export function BottomNav() {
  const pathname = usePathname();
  const t = useTranslations();
  const [navItems, setNavItems] = useState<NavItemType[]>([]);
  const [showMore, setShowMore] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadRole() {
      const supabase = createBrowserClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (cancelled) return;
      const role = (user?.app_metadata?.user_role as string) || "club_president";
      setNavItems(getNavConfig(role as AppRole));
    }
    loadRole();

    return () => {
      cancelled = true;
    };
  }, []);

  // Coach gets 4 items in bottom nav, others get first 4
  const primaryNav = navItems.slice(0, 4);
  const moreNav = navItems.slice(4);

  return (
    <>
      {/* More drawer */}
      {showMore && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowMore(false)}
          />
          <div className="absolute bottom-0 left-0 right-0 rounded-t-xl bg-card p-4 pb-[env(safe-area-inset-bottom)]">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-medium">Više</h3>
              <button
                onClick={() => setShowMore(false)}
                className="flex h-11 w-11 items-center justify-center rounded-lg"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="space-y-1">
              {moreNav.map((item) => {
                const Icon = iconMap[item.icon] || Home;
                const fullPath = `/sr${item.href}`;
                const isActive =
                  pathname === fullPath ||
                  pathname?.startsWith(fullPath + "/");
                return (
                  <Link
                    key={item.href}
                    href={fullPath}
                    onClick={() => setShowMore(false)}
                    className={`flex h-12 items-center gap-3 rounded-lg px-3 text-sm font-medium ${
                      isActive
                        ? "bg-primary/10 text-primary"
                        : "text-foreground hover:bg-muted"
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                    <span>{t(item.label)}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      )}

      {/* Bottom nav bar */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-around border-t border-border bg-card px-2 pb-[env(safe-area-inset-bottom)] md:hidden">
        {primaryNav.map((item) => {
          const Icon = iconMap[item.icon] || Home;
          const fullPath = `/sr${item.href}`;
          const isActive =
            pathname === fullPath || pathname?.startsWith(fullPath + "/");

          // Last item in coach nav (More) opens drawer
          if (item.icon === "MoreHorizontal" && moreNav.length > 0) {
            return (
              <button
                key={item.href}
                onClick={() => setShowMore(true)}
                className="flex min-h-11 min-w-11 flex-col items-center justify-center gap-0.5 rounded-lg px-2 py-1 text-[11px] font-medium text-muted-foreground"
              >
                <Icon className="h-5 w-5" />
                <span>{t(item.label)}</span>
              </button>
            );
          }

          return (
            <Link
              key={item.href}
              href={fullPath}
              className={`flex min-h-11 min-w-11 flex-col items-center justify-center gap-0.5 rounded-lg px-2 py-1 text-[11px] font-medium transition-colors ${
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-5 w-5" />
              <span>{t(item.label)}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
