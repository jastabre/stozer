/**
 * STOŽER venue-conflict predicate (D-37..D-39). Time intervals are half-open
 * [start, end): an event that ends exactly when another starts does NOT
 * conflict. Pure — no DB access; the scheduling action runs this over the
 * calendar feed for a venue before saving.
 */

export interface TimeInterval {
  startsAt: Date;
  endsAt: Date;
}

/** True when [aStart, aEnd) and [bStart, bEnd) overlap. */
export function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart.getTime() < bEnd.getTime() && bStart.getTime() < aEnd.getTime();
}

/** Items from `items` that overlap the `candidate` interval. */
export function findConflicts<T extends TimeInterval>(
  items: T[],
  candidate: TimeInterval
): T[] {
  return items.filter((item) =>
    overlaps(candidate.startsAt, candidate.endsAt, item.startsAt, item.endsAt)
  );
}
