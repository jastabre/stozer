import type { AppRole } from "@/types/database";

export interface NavItem {
  label: string;
  href: string;
  icon: string; // Lucide icon name (must exist in NavItem/BottomNav icon maps)
  /** Utility items (e.g. Settings) render in a separate bottom zone. */
  bottom?: boolean;
  children?: NavItem[];
}

// Only SHIPPED modules appear in navigation. Calendar, training, matches,
// attendance, reports, youth academy and first-team finance screens are not
// implemented yet — they are hidden rather than offered as dead links.
export const navConfigs: Record<string, NavItem[]> = {
  club_president: [
    { label: "navigation.home", href: "", icon: "Home" },
    { label: "navigation.teams", href: "/teams", icon: "Shield" },
    { label: "navigation.players", href: "/players", icon: "UserRound" },
    { label: "navigation.people", href: "/people", icon: "UsersRound" },
    { label: "navigation.finances", href: "/finance", icon: "Coins" },
    { label: "navigation.equipment", href: "/equipment", icon: "Shirt" },
    { label: "navigation.club", href: "/club", icon: "Building2" },
    { label: "navigation.settings", href: "/settings", icon: "Settings", bottom: true },
  ],

  youth_director: [
    { label: "navigation.home", href: "", icon: "Home" },
    { label: "navigation.teams", href: "/teams", icon: "Shield" },
    { label: "navigation.players", href: "/players", icon: "UserRound" },
    { label: "navigation.people", href: "/people", icon: "UsersRound" },
    { label: "navigation.finances", href: "/finance", icon: "Coins" },
    { label: "navigation.equipment", href: "/equipment", icon: "Shirt" },
    { label: "navigation.club", href: "/club", icon: "Building2" },
    { label: "navigation.settings", href: "/settings", icon: "Settings", bottom: true },
  ],

  coach: [
    { label: "navigation.home", href: "", icon: "Home" },
    { label: "navigation.teams", href: "/teams", icon: "Shield" },
    { label: "navigation.players", href: "/players", icon: "UserRound" },
    { label: "navigation.equipment", href: "/equipment", icon: "Shirt" },
    { label: "navigation.settings", href: "/settings", icon: "Settings", bottom: true },
  ],

  admin_finance: [
    { label: "navigation.home", href: "", icon: "Home" },
    { label: "navigation.teams", href: "/teams", icon: "Shield" },
    { label: "navigation.players", href: "/players", icon: "UserRound" },
    { label: "navigation.people", href: "/people", icon: "UsersRound" },
    { label: "navigation.finances", href: "/finance", icon: "Coins" },
    { label: "navigation.equipment", href: "/equipment", icon: "Shirt" },
    { label: "navigation.club", href: "/club", icon: "Building2" },
    { label: "navigation.settings", href: "/settings", icon: "Settings", bottom: true },
  ],

  // Equipment manager: the kit workflow (players/equipment/teams) and personal
  // settings. No club settings, documents, finances or user administration.
  equipment_manager: [
    { label: "navigation.home", href: "", icon: "Home" },
    { label: "navigation.teams", href: "/teams", icon: "Shield" },
    { label: "navigation.players", href: "/players", icon: "UserRound" },
    { label: "navigation.equipment", href: "/equipment", icon: "Shirt" },
    { label: "navigation.settings", href: "/settings", icon: "Settings", bottom: true },
  ],

  // Medical staff: player/team context and the medical exams tab.
  medical_staff: [
    { label: "navigation.home", href: "", icon: "Home" },
    { label: "navigation.teams", href: "/teams", icon: "Shield" },
    { label: "navigation.players", href: "/players", icon: "UserRound" },
    { label: "navigation.settings", href: "/settings", icon: "Settings", bottom: true },
  ],
};

export function getNavConfig(role: AppRole): NavItem[] {
  return navConfigs[role] || navConfigs.club_president;
}