import type { SectionTabItem } from "@/components/ui/SectionTabs";
import { hasPermission } from "@/lib/organization";

export interface ClubTabLabels {
  settings: string;
  users: string;
  documents: string;
  facilities: string;
}

/**
 * The Club section tab bar, filtered by what the caller may actually open. The
 * section now hosts three independent areas with three independent permissions,
 * so a role that only administers the club library (e.g. youth director) sees
 * just the "Dokumenti kluba" tab.
 */
export async function buildClubTabs(
  locale: string,
  labels: ClubTabLabels
): Promise<SectionTabItem[]> {
  const [canSettings, canUsers, canDocuments, canFacilities] = await Promise.all([
    hasPermission("club_settings.manage"),
    hasPermission("users.manage"),
    hasPermission("documents.view"),
    hasPermission("venue.view"),
  ]);

  const items: SectionTabItem[] = [];
  if (canSettings) items.push({ href: `/${locale}/club`, label: labels.settings });
  if (canUsers) items.push({ href: `/${locale}/club/users`, label: labels.users });
  if (canDocuments) {
    items.push({ href: `/${locale}/club/documents`, label: labels.documents });
  }
  if (canFacilities) {
    items.push({ href: `/${locale}/club/facilities`, label: labels.facilities });
  }
  return items;
}
