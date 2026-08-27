"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
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
  Lock,
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

export interface NavItemProps {
  label: string;
  href: string;
  icon: string;
  locked?: boolean;
  locale?: string;
}

export function NavItem({
  label,
  href,
  icon: iconName,
  locked = false,
  locale = "sr",
}: NavItemProps) {
  const pathname = usePathname();
  const t = useTranslations();
  const Icon = iconMap[iconName] || Home;

  const fullPath = `/${locale}${href}`;
  const isActive = pathname === fullPath || pathname?.startsWith(fullPath + "/");

  if (locked) {
    return (
      <div className="flex h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium text-muted-foreground/50">
        <Icon className="h-5 w-5" />
        <span className="flex-1">{t(label)}</span>
        <Lock className="h-3.5 w-3.5" />
      </div>
    );
  }

  return (
    <Link
      href={fullPath}
      className={`flex h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors ${
        isActive
          ? "bg-sidebar-accent text-sidebar-primary"
          : "text-sidebar-foreground hover:bg-sidebar-accent"
      }`}
    >
      <Icon className="h-5 w-5" />
      <span>{t(label)}</span>
    </Link>
  );
}
