/**
 * V1 business display order for teams. Sorting is derived from the real
 * `teams.category` enum values (never from a translated label), so the order is
 * stable across locales:
 *   1. first_team  — Prvi tim
 *   2. youth       — Omladinska selekcija
 *   3. academy     — Rezervni / B tim
 *   4. other       — Ostalo
 * Teams in the same category are ordered by name (Serbian collation).
 *
 * This is a display concern only — no `sort_order` column, no manual reordering.
 */
export const TEAM_CATEGORY_PRIORITY: Record<string, number> = {
  first_team: 0,
  youth: 1,
  academy: 2,
  other: 3,
};

export function sortTeamsByCategory<T extends { category: string; name: string }>(
  teams: T[]
): T[] {
  return [...teams].sort((a, b) => {
    const pa = TEAM_CATEGORY_PRIORITY[a.category] ?? Number.MAX_SAFE_INTEGER;
    const pb = TEAM_CATEGORY_PRIORITY[b.category] ?? Number.MAX_SAFE_INTEGER;
    if (pa !== pb) return pa - pb;
    return a.name.localeCompare(b.name, "sr");
  });
}
