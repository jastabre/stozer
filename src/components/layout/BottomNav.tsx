"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { createBrowserClient } from "@/lib/supabase/browser";
import { getNavConfig, type NavItem as NavItemType } from "@/lib/rbac";
import type { AppRole } from "@/types/database";
import Link from "next/link";
import { usePathname } from "next/navigation";
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
    <nav className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-around border-t border-border bg-card px-2 pb-[env(safe-area-inset-bottom)] md:hidden">
      {navItems.map((item) => {
        const Icon = iconMap[item.icon] || Home;
        const fullPath = `/sr${item.href}`;
        const isActive =
          pathname === fullPath || pathname?.startsWith(fullPath + "/");
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
  );
}
