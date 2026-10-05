"use client";

import { useRouter } from "next/navigation";
import { monthName, parsePeriod } from "@/lib/first-team";

/**
 * Month selector for the staff payout screen. A plain <select> that navigates
 * to the same route with ?period=YYYY-MM on change. Options are the union of
 * the current month and every month that has a staff obligation, so a month
 * with no obligations is still reachable (and shows its empty state).
 */
export function StaffMonthSelector({
  periods,
  current,
  locale,
  label,
}: {
  periods: string[];
  current: string;
  locale: "sr" | "en";
  label: string;
}) {
  const router = useRouter();

  return (
    <select
      value={current}
      onChange={(event) => router.push(`?period=${event.target.value}`)}
      aria-label={label}
      className="field h-10 w-full py-0 sm:w-auto"
    >
      {periods.map((period) => {
        const { year, month } = parsePeriod(period);
        return (
          <option key={period} value={period}>
            {`${monthName(month, locale)} ${year}`}
          </option>
        );
      })}
    </select>
  );
}
