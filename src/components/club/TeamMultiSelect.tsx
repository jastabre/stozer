"use client";

import { useState } from "react";
import { X } from "lucide-react";

/**
 * Compact team multi-select: selected teams render as removable chips with a
 * "Choose teams" toggle revealing a short checkbox list. Checkboxes carry the
 * form values directly (name="team_id"), so there is no apply step.
 */
export function TeamMultiSelect({
  teams,
  defaultValue = [],
  name = "team_id",
  labels,
}: {
  teams: { id: string; name: string }[];
  defaultValue?: string[];
  name?: string;
  labels: { choose: string; remove: string; empty: string };
}) {
  const [selected, setSelected] = useState<string[]>(defaultValue);
  const [open, setOpen] = useState(false);

  if (teams.length === 0) {
    return <p className="text-xs text-muted-foreground">{labels.empty}</p>;
  }

  const toggle = (teamId: string) =>
    setSelected((previous) =>
      previous.includes(teamId)
        ? previous.filter((id) => id !== teamId)
        : [...previous, teamId]
    );

  const selectedTeams = teams.filter((team) => selected.includes(team.id));

  return (
    <div>
      {/* Values live outside the collapsible list so saving never depends on
          whether the checkbox list was expanded. */}
      {selected.map((teamId) => (
        <input key={teamId} type="hidden" name={name} value={teamId} />
      ))}

      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
        {selectedTeams.map((team) => (
          <span
            key={team.id}
            className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/40 py-0.5 pl-2 pr-1 text-xs font-medium text-foreground"
          >
            {team.name}
            <button
              type="button"
              onClick={() => toggle(team.id)}
              aria-label={`${labels.remove}: ${team.name}`}
              className="flex h-4 w-4 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
            >
              <X className="h-3 w-3" aria-hidden="true" />
            </button>
          </span>
        ))}
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="text-xs font-medium text-primary hover:underline"
        >
          {labels.choose}
        </button>
      </div>

      {open && (
        <div className="mt-2 grid gap-0.5 rounded-lg border border-border p-2 sm:grid-cols-2">
          {teams.map((team) => (
            <label
              key={team.id}
              className="flex items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-muted/50"
            >
              <input
                type="checkbox"
                checked={selected.includes(team.id)}
                onChange={() => toggle(team.id)}
                className="rounded border-border"
              />
              {team.name}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
