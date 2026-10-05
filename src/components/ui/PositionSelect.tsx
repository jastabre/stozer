"use client";

import { useState } from "react";
import { positionsForSport, isPresetPosition } from "@/lib/positions";

/**
 * Sport-aware position selector. Presents localized preset options; when the
 * current value is a custom one (or the user chooses "Ostalo / Drugo") a
 * free-text field is revealed so custom values are never lost. Emits the
 * position under `name` (preset label or custom text).
 */
export function PositionSelect({
  name,
  current,
  sport,
  locale,
  ariaLabel,
  className,
}: {
  name: string;
  current?: string | null;
  sport?: string | null;
  locale: "sr" | "en";
  ariaLabel: string;
  className?: string;
}) {
  const presets = positionsForSport(sport, locale);
  const initialPreset = isPresetPosition(current, sport, locale);
  const [mode, setMode] = useState<"preset" | "custom">(
    current && !initialPreset && current ? "custom" : "preset"
  );
  const [preset, setPreset] = useState(
    initialPreset ? current ?? "" : ""
  );
  const [custom, setCustom] = useState(
    current && !initialPreset ? current ?? "" : ""
  );

  return (
    <div className="space-y-2">
      {presets.length > 0 && (
        <select
          name={mode === "preset" ? name : undefined}
          value={mode === "preset" ? preset : ""}
          onChange={(e) => {
            if (e.target.value === "__custom__") {
              setMode("custom");
            } else {
              setPreset(e.target.value);
              setMode("preset");
            }
          }}
          aria-label={ariaLabel}
          className={className ?? "rounded-lg border px-3 py-2 text-sm"}
        >
          <option value="">—</option>
          {presets.map((p) => (
            <option key={p.key} value={p.label}>
              {p.label}
            </option>
          ))}
          <option value="__custom__">Ostalo / Drugo</option>
        </select>
      )}
      {mode === "custom" && (
        <input
          name={name}
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          placeholder="Pozicija"
          aria-label={ariaLabel}
          className={className ?? "rounded-lg border px-3 py-2 text-sm"}
        />
      )}
    </div>
  );
}