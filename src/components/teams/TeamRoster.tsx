"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { SlidersHorizontal } from "lucide-react";
import { StatusBadge, type StatusTone } from "@/components/ui/StatusBadge";
import { ConfirmDeleteButton } from "@/components/ConfirmDeleteButton";
import { formatClubAthleteNumber } from "@/lib/athlete-id";
import { cn } from "@/lib/utils";

export type RosterRegState = "green" | "yellow" | "red" | "none";
export type RosterMedTone =
  | "not_recorded"
  | "valid"
  | "expiring_soon"
  | "expired";

export interface RosterRow {
  athleteId: string;
  firstName: string;
  lastName: string;
  position: string | null;
  clubAthleteNumber: number;
  jerseyNumber: number | null;
  regState: RosterRegState;
  medTone: RosterMedTone;
}

interface FilterOption {
  value: string;
  label: string;
}

export interface TeamRosterLabels {
  searchPlaceholder: string;
  filters: string;
  clearFilters: string;
  filterPosition: string;
  filterReg: string;
  filterMed: string;
  positionOptions: FilterOption[];
  regOptions: FilterOption[];
  medOptions: FilterOption[];
  table: {
    clubId: string;
    name: string;
    jersey: string;
    position: string;
    registration: string;
    medical: string;
    actions: string;
  };
  empty: string;
  emptyFiltered: string;
  remove: string;
  removeTitle: string;
  removeBody: string;
  removeConfirm: string;
  removing: string;
  cancel: string;
}

function regTone(state: RosterRegState): StatusTone {
  return state === "green" || state === "yellow" || state === "red"
    ? state
    : "neutral";
}

function medTone(tone: RosterMedTone): StatusTone {
  if (tone === "valid") return "green";
  if (tone === "expiring_soon") return "yellow";
  if (tone === "expired") return "red";
  return "neutral";
}

/**
 * Team roster: compact toolbar (search + two instant selects, no Apply) over a
 * status table. Desktop uses an overflow-x table; mobile uses a compact list so
 * the page never overflows horizontally.
 */
export function TeamRoster({
  locale,
  teamId,
  rows,
  canAssign,
  removeAction,
  labels,
}: {
  locale: string;
  teamId: string;
  rows: RosterRow[];
  canAssign: boolean;
  removeAction: (formData: FormData) => Promise<void>;
  labels: TeamRosterLabels;
}) {
  const tf = useTranslations("feedback");
  const [query, setQuery] = useState("");
  const [position, setPosition] = useState("all");
  const [reg, setReg] = useState("all");
  const [med, setMed] = useState("all");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const activeFilterCount =
    (position !== "all" ? 1 : 0) +
    (reg !== "all" ? 1 : 0) +
    (med !== "all" ? 1 : 0);

  const clearFilters = () => {
    setPosition("all");
    setReg("all");
    setMed("all");
  };

  const regLabel = (value: string) =>
    labels.regOptions.find((option) => option.value === value)?.label ?? "";
  const medLabel = (value: string) =>
    labels.medOptions.find((option) => option.value === value)?.label ?? "";

  const visible = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return rows.filter((row) => {
      if (needle) {
        const name = `${row.lastName} ${row.firstName}`.toLocaleLowerCase();
        if (!name.includes(needle)) return false;
      }
      if (position !== "all" && row.position !== position) return false;
      if (reg !== "all" && row.regState !== reg) return false;
      if (med !== "all" && row.medTone !== med) return false;
      return true;
    });
  }, [rows, query, position, reg, med]);

  const isFiltered = query.trim() !== "" || reg !== "all" || med !== "all";

  return (
    <div className="space-y-3">
      {/* Compact toolbar. Search is always visible; the two registrations/medical
          filters live behind "Filteri". Filtering is instant — no Apply. */}
      <div className="rounded-xl border border-border bg-card">
        <div className="flex items-center gap-2 p-3">
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={labels.searchPlaceholder}
            aria-label={labels.searchPlaceholder}
            className="field flex-1 sm:max-w-xs"
          />
          <button
            type="button"
            onClick={() => setFiltersOpen((value) => !value)}
            aria-expanded={filtersOpen}
            className={cn(
              "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
              activeFilterCount > 0
                ? "border-primary text-primary hover:bg-primary/5"
                : "border-border text-foreground hover:bg-muted"
            )}
          >
            <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
            {labels.filters}
            {activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
          </button>
        </div>

        {filtersOpen && (
          <div className="grid gap-3 border-t border-border p-3 sm:grid-cols-[repeat(3,minmax(0,1fr))_auto] sm:items-end">
            <label className="grid gap-1 text-xs text-muted-foreground">
              {labels.filterPosition}
              <select
                value={position}
                onChange={(event) => setPosition(event.target.value)}
                className="field h-9 py-0"
              >
                {labels.positionOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-xs text-muted-foreground">
              {labels.filterReg}
              <select
                value={reg}
                onChange={(event) => setReg(event.target.value)}
                className="field h-9 py-0"
              >
                {labels.regOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-xs text-muted-foreground">
              {labels.filterMed}
              <select
                value={med}
                onChange={(event) => setMed(event.target.value)}
                className="field h-9 py-0"
              >
                {labels.medOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={clearFilters}
              className="h-9 justify-self-start rounded-lg px-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground sm:justify-self-end"
            >
              {labels.clearFilters}
            </button>
          </div>
        )}
      </div>

      {visible.length === 0 ? (
        <p className="rounded-xl border border-border bg-card px-4 py-6 text-center text-sm text-muted-foreground">
          {isFiltered ? labels.emptyFiltered : labels.empty}
        </p>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-x-auto rounded-xl border border-border bg-card md:block">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="w-px whitespace-nowrap px-4 py-2 font-medium">
                    {labels.table.clubId}
                  </th>
                  <th className="px-4 py-2 font-medium">{labels.table.name}</th>
                  <th className="px-4 py-2 font-medium">{labels.table.jersey}</th>
                  <th className="px-4 py-2 font-medium">{labels.table.position}</th>
                  <th className="px-4 py-2 font-medium">
                    {labels.table.registration}
                  </th>
                  <th className="px-4 py-2 font-medium">{labels.table.medical}</th>
                  {canAssign && <th className="px-4 py-2 font-medium" />}
                </tr>
              </thead>
              <tbody>
                {visible.map((row) => (
                  <tr
                    key={row.athleteId}
                    className="border-t border-border transition-colors hover:bg-muted/40"
                  >
                    <td className="w-px whitespace-nowrap px-4 py-2 font-mono text-xs text-muted-foreground">
                      {formatClubAthleteNumber(row.clubAthleteNumber)}
                    </td>
                    <td className="px-4 py-2">
                      <Link
                        href={`/${locale}/players/${row.athleteId}`}
                        className="font-medium text-foreground transition-colors hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                      >
                        {row.lastName} {row.firstName}
                      </Link>
                    </td>
                    <td className="px-4 py-2 tabular-nums text-muted-foreground">
                      {row.jerseyNumber ?? "—"}
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {row.position ?? "—"}
                    </td>
                    <td className="px-4 py-2">
                      <StatusBadge
                        tone={regTone(row.regState)}
                        label={regLabel(row.regState)}
                      />
                    </td>
                    <td className="px-4 py-2">
                      <StatusBadge
                        tone={medTone(row.medTone)}
                        label={medLabel(row.medTone)}
                      />
                    </td>
                    {canAssign && (
                      <td className="px-4 py-2 text-right">
                        <RemoveMember
                          action={removeAction}
                          teamId={teamId}
                          athleteId={row.athleteId}
                          labels={labels}
                          successMessage={tf("memberRemoved")}
                          errorMessage={tf("deleteFailed")}
                        />
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile list */}
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card md:hidden">
            {visible.map((row) => (
              <li key={row.athleteId} className="px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <Link
                    href={`/${locale}/players/${row.athleteId}`}
                    className="min-w-0 flex-1"
                  >
                    <span className="block break-words text-sm font-medium text-foreground">
                      {row.lastName} {row.firstName}
                    </span>
                    <span className="mt-0.5 block font-mono text-[11px] text-muted-foreground">
                      {formatClubAthleteNumber(row.clubAthleteNumber)}
                    </span>
                  </Link>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="tabular-nums text-sm text-muted-foreground">
                      {row.jerseyNumber != null ? `#${row.jerseyNumber}` : "—"}
                    </span>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <StatusBadge
                    tone={regTone(row.regState)}
                    label={regLabel(row.regState)}
                  />
                  <StatusBadge
                    tone={medTone(row.medTone)}
                    label={medLabel(row.medTone)}
                  />
                  {row.position && (
                    <span className="text-xs text-muted-foreground">
                      {row.position}
                    </span>
                  )}
                </div>
                {canAssign && (
                  <div className="mt-2">
                    <RemoveMember
                      action={removeAction}
                      teamId={teamId}
                      athleteId={row.athleteId}
                      labels={labels}
                      successMessage={tf("memberRemoved")}
                      errorMessage={tf("deleteFailed")}
                    />
                  </div>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function RemoveMember({
  action,
  teamId,
  athleteId,
  labels,
  successMessage,
  errorMessage,
}: {
  action: (formData: FormData) => Promise<void>;
  teamId: string;
  athleteId: string;
  labels: TeamRosterLabels;
  successMessage: string;
  errorMessage: string;
}) {
  return (
    <ConfirmDeleteButton
      action={action}
      hiddenFields={{ team_id: teamId, athlete_id: athleteId }}
      triggerLabel={labels.remove}
      triggerClassName="rounded px-1 text-xs font-medium text-muted-foreground transition-colors hover:text-destructive"
      title={labels.removeTitle}
      body={labels.removeBody}
      confirmLabel={labels.removeConfirm}
      cancelLabel={labels.cancel}
      pendingLabel={labels.removing}
      successMessage={successMessage}
      errorMessage={errorMessage}
    />
  );
}
