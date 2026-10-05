"use client";

import { usePathname } from "next/navigation";
import { SectionTabs, type SectionTabItem } from "@/components/ui/SectionTabs";

/**
 * Client tab bar for section shells (player, staff, club). It derives the
 * active tab from the current pathname so the highlight follows the user during
 * client-side navigation, even though the surrounding server layout is
 * preserved (and does not re-run) between sibling tab routes. Every shell uses
 * this one component, so tab height, padding, active state and hover/focus
 * behaviour stay identical across the app.
 */
export function ProfileTabs({
  items,
  label,
}: {
  items: SectionTabItem[];
  label: string;
}) {
  const pathname = usePathname();
  return (
    <SectionTabs variant="segmented" items={items} activeHref={pathname} label={label} />
  );
}
