"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Search } from "lucide-react";
import {
  PlayerEquipmentDrawer,
  type EquipmentDrawerPlayer,
} from "./PlayerEquipmentDrawer";
import type { IssuePlayerItem } from "./IssuePlayerItemForm";
import { StatusBadge, type StatusTone } from "@/components/ui/StatusBadge";
import { formatClubAthleteNumber } from "@/lib/athlete-id";

function statusOf(
  player: EquipmentDrawerPlayer,
  labels: { complete: string; missing: string; lostDamaged: string }
): { tone: StatusTone; label: string } | null {
  if (!player.summary.hasRequirements) return null;
  if (player.summary.lostDamagedCount > 0) {
    return {
      tone: "red",
      label: `${labels.lostDamaged} (${player.summary.lostDamagedCount})`,
    };
  }
  if (player.summary.complete) return { tone: "green", label: labels.complete };
  return {
    tone: "blue",
    label: `${labels.missing} (${player.summary.missingCount})`,
  };
}

/**
 * Compact, searchable team roster for the daily equipment workflow. Desktop
 * gets a table, phones get the same information as stacked rows. The player
 * drawer is rendered once and follows the selected athlete.
 */
export function PlayerEquipmentTable({
  players,
  items,
  canReport,
  canManage,
  issueAction,
  transitionAction,
  deleteAction,
}: {
  players: EquipmentDrawerPlayer[];
  items: IssuePlayerItem[];
  canReport: boolean;
  canManage: boolean;
  issueAction: (formData: FormData) => Promise<unknown>;
  transitionAction: (formData: FormData) => Promise<unknown>;
  deleteAction: (formData: FormData) => Promise<unknown>;
}) {
  const t = useTranslations("equipment");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const normalized = query.trim().toLocaleLowerCase();
  const visible = normalized
    ? players.filter((player) => {
        const haystack = [
          player.first_name,
          player.last_name,
          `${player.last_name} ${player.first_name}`,
          String(player.club_athlete_number),
          formatClubAthleteNumber(player.club_athlete_number),
        ]
          .join(" ")
          .toLocaleLowerCase();
        return haystack.includes(normalized);
      })
    : players;

  const selected =
    players.find((player) => player.athlete_id === selectedId) ?? null;
  const statusLabels = {
    complete: t("completeLabel"),
    missing: t("missingLabel"),
    lostDamaged: t("lostDamaged"),
  };

  return (
    <div className="space-y-3">
      <label className="relative block max-w-sm">
        <span className="sr-only">{t("searchPlaceholder")}</span>
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("searchPlaceholder")}
          className="h-9 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm"
        />
      </label>

      {visible.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          {t("noSearchResults")}
        </p>
      ) : (
        <>
          {/* Desktop: compact table */}
          <div className="hidden overflow-hidden rounded-xl border border-border bg-card md:block">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">{t("columns.player")}</th>
                  <th className="px-3 py-3 font-medium">{t("columns.number")}</th>
                  <th className="px-3 py-3 font-medium">{t("columns.sizes")}</th>
                  <th className="px-3 py-3 font-medium">{t("columns.issued")}</th>
                  <th className="px-3 py-3 font-medium">{t("columns.missing")}</th>
                  <th className="px-3 py-3 font-medium">{t("columns.status")}</th>
                  <th className="px-4 py-3 text-right font-medium">
                    {t("columns.action")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {visible.map((player) => {
                  const status = statusOf(player, statusLabels);
                  return (
                    <tr
                      key={player.athlete_id}
                      className="border-t border-border align-top"
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium text-foreground">
                          {player.last_name} {player.first_name}
                        </p>
                        <p className="font-mono text-[11px] text-muted-foreground">
                          {formatClubAthleteNumber(player.club_athlete_number)}
                        </p>
                      </td>
                      <td className="px-3 py-3 tabular-nums text-foreground">
                        {player.jersey_number ?? "—"}
                      </td>
                      <td className="max-w-[16rem] px-3 py-3 text-xs text-muted-foreground">
                        {player.sizesCompact || "—"}
                      </td>
                      <td className="px-3 py-3 tabular-nums text-foreground">
                        {player.summary.issuedCount}
                      </td>
                      <td className="px-3 py-3 tabular-nums text-foreground">
                        {player.summary.hasRequirements
                          ? player.summary.missingCount
                          : "—"}
                      </td>
                      <td className="px-3 py-3">
                        {status ? (
                          <StatusBadge tone={status.tone} label={status.label} />
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => setSelectedId(player.athlete_id)}
                          className="rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:border-primary hover:text-primary"
                        >
                          {t("view")}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile: stacked rows */}
          <ul className="space-y-2 md:hidden">
            {visible.map((player) => {
              const status = statusOf(player, statusLabels);
              return (
                <li
                  key={player.athlete_id}
                  className="rounded-xl border border-border bg-card p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-foreground">
                        {player.last_name} {player.first_name}
                      </p>
                      <p className="font-mono text-[11px] text-muted-foreground">
                        {formatClubAthleteNumber(player.club_athlete_number)}
                        {player.jersey_number ? ` · #${player.jersey_number}` : ""}
                      </p>
                    </div>
                    {status && (
                      <StatusBadge tone={status.tone} label={status.label} />
                    )}
                  </div>
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    {player.sizesCompact || "—"}
                  </p>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <p className="text-xs text-muted-foreground">
                      {t("columns.issued")}: {player.summary.issuedCount}
                      {player.summary.hasRequirements
                        ? ` · ${t("columns.missing")}: ${player.summary.missingCount}`
                        : ""}
                    </p>
                    <button
                      type="button"
                      onClick={() => setSelectedId(player.athlete_id)}
                      className="rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:border-primary hover:text-primary"
                    >
                      {t("view")}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}

      <PlayerEquipmentDrawer
        key={selected?.athlete_id ?? "none"}
        open={Boolean(selected)}
        onClose={() => setSelectedId(null)}
        player={selected}
        items={items}
        canReport={canReport}
        canManage={canManage}
        issueAction={issueAction}
        transitionAction={transitionAction}
        deleteAction={deleteAction}
      />
    </div>
  );
}
