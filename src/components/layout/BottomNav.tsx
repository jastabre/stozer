"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { Home, Users, Calendar, Settings } from "lucide-react";

export function BottomNav() {
  const pathname = usePathname();
  const t = useTranslations("navigation");

  const NAV_ITEMS = [
    { label: t("home"), href: "/dashboard", icon: Home },
    { label: t("teams"), href: "/teams", icon: Users },
    { label: t("calendar"), href: "/calendar", icon: Calendar },
    { label: t("settings"), href: "/settings", icon: Settings },
  ];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-around border-t border-border bg-card px-2 pb-[env(safe-area-inset-bottom)] md:hidden">
      {NAV_ITEMS.map((item) => {
        const isActive = pathname?.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={`/sr${item.href}`}
            className={`flex min-h-11 min-w-11 flex-col items-center justify-center gap-0.5 rounded-lg px-2 py-1 text-[11px] font-medium transition-colors ${
              isActive
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <item.icon className="h-5 w-5" />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
