import type { AppRole } from "@/types/database";

export interface NavItem {
  label: string;
  href: string;
  icon: string; // Lucide icon name
  children?: NavItem[];
}

// Navigation configs per role as defined in STOZER-BRIEF §17-19
export const navConfigs: Record<string, NavItem[]> = {
  // §17: Club President - 8 main sections
  club_president: [
    { label: "navigation.home", href: "/dashboard", icon: "Home" },
    { label: "navigation.teams", href: "/teams", icon: "Users" },
    { label: "navigation.people", href: "/people", icon: "UsersRound" },
    { label: "navigation.equipment", href: "/equipment", icon: "Shirt" },
    { label: "navigation.calendar", href: "/calendar", icon: "Calendar" },
    { label: "navigation.finances", href: "/finances", icon: "Wallet" },
    { label: "navigation.documents", href: "/documents", icon: "FileText" },
    { label: "navigation.reports", href: "/reports", icon: "BarChart3" },
    { label: "navigation.club", href: "/club", icon: "Building2" },
  ],

  // §18: Youth Director - 5 sections
  youth_director: [
    { label: "navigation.home", href: "/dashboard", icon: "Home" },
    { label: "navigation.teams", href: "/teams", icon: "Users" },
    { label: "navigation.people", href: "/people", icon: "UsersRound" },
    { label: "navigation.equipment", href: "/equipment", icon: "Shirt" },
    { label: "navigation.youthAcademy", href: "/youth", icon: "GraduationCap" },
    { label: "navigation.calendar", href: "/calendar", icon: "Calendar" },
    { label: "navigation.documents", href: "/documents", icon: "FileText" },
    { label: "navigation.reports", href: "/reports", icon: "BarChart3" },
  ],

  // §19: Coach - 4 mobile-first items
  coach: [
    { label: "navigation.today", href: "/today", icon: "CalendarCheck" },
    { label: "navigation.team", href: "/team", icon: "Users" },
    { label: "navigation.equipment", href: "/equipment", icon: "Shirt" },
    { label: "navigation.calendar", href: "/calendar", icon: "Calendar" },
    { label: "navigation.more", href: "/more", icon: "MoreHorizontal" },
  ],

  // Admin/Finance - configurable scope
  admin_finance: [
    { label: "navigation.home", href: "/dashboard", icon: "Home" },
    { label: "navigation.members", href: "/members", icon: "Users" },
    { label: "navigation.equipment", href: "/equipment", icon: "Shirt" },
    { label: "navigation.finances", href: "/finances", icon: "Wallet" },
    { label: "navigation.reports", href: "/reports", icon: "BarChart3" },
    { label: "navigation.settings", href: "/settings", icon: "Settings" },
  ],
};

export function getNavConfig(role: AppRole): NavItem[] {
  return navConfigs[role] || navConfigs.club_president;
}
