import type { SectionTabItem } from "@/components/ui/SectionTabs";

export interface FinanceTabLabels {
  overview: string;
  players: string;
  staff: string;
}

/**
 * The central Finansije tab bar. "Pregled" is always present (the caller has at
 * least one finance permission to reach the section); "Isplate igrača" and
 * "Isplate osoblja" appear only when the caller can actually open them, so a
 * youth director (player finance view only) never sees a dead staff tab.
 */
export function buildFinanceTabs(
  locale: string,
  labels: FinanceTabLabels,
  canPlayers: boolean,
  canStaff: boolean
): SectionTabItem[] {
  const items: SectionTabItem[] = [
    { href: `/${locale}/finance`, label: labels.overview },
  ];
  if (canPlayers) {
    items.push({ href: `/${locale}/finance/players`, label: labels.players });
  }
  if (canStaff) {
    items.push({ href: `/${locale}/finance/staff`, label: labels.staff });
  }
  return items;
}
