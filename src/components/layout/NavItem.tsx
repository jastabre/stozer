"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Shield,
  UsersRound,
  UserRound,
  Shirt,
  FileText,
  Building2,
  Settings,
  Coins,
} from "lucide-react";
import { cn } from "@/lib/utils";

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Home,
  Shield,
  UsersRound,
  UserRound,
  Shirt,
  FileText,
  Building2,
  Settings,
  Coins,
};

export interface NavItemProps {
  label: string;
  href: string;
  icon: string;
  onNavigate?: () => void;
}

export function NavItem({ label, href, icon: iconName, onNavigate }: NavItemProps) {
  const pathname = usePathname();
  const Icon = iconMap[iconName] || Home;

  // Keep links on the current locale so /en navigation stays on /en pages.
  const locale = pathname.startsWith("/en") ? "en" : "sr";
  const fullPath = `/${locale}${href}`;
  // Home (href "") is only active on the exact dashboard path, never on
  // every /sr/… sub-route.
  const isActive =
    href === ""
      ? pathname === fullPath
      : pathname === fullPath || pathname.startsWith(fullPath + "/");

  return (
    <Link
      href={fullPath}
      onClick={onNavigate}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "relative flex h-9 items-center gap-2.5 rounded-md px-3 text-sm transition-colors",
        isActive
          ? "font-semibold text-sidebar-accent-foreground"
          : "font-medium text-sidebar-foreground hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground"
      )}
    >
      {isActive && (
        <span className="absolute left-0 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-full bg-primary" />
      )}
      <Icon
        className={cn("h-[18px] w-[18px] shrink-0", isActive ? "text-primary" : "text-muted-foreground")}
      />
      <span className="truncate">{label}</span>
    </Link>
  );
}