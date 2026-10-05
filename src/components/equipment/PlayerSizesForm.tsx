"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { FormSubmitButton } from "@/components/FormSubmitButton";
import { MutationForm } from "@/components/ui/MutationForm";

const SIZES = ["XS", "S", "M", "L", "XL", "XXL", "XXXL"];
const CUSTOM = "__custom__";

/**
 * Map a default equipment-type name to a kit group + piece slot.
 * "Match Shirt"/"Match Shorts" -> DRES, "Tracksuit Top/Bottom" -> TRENERKA,
 * "Training Shirt/Shorts" -> TRENING. Anything custom stays a standalone row,
 * so a new apparel piece a club defines (e.g. a "Jakna" type) gets its own size
 * slot without touching this component.
 */
function groupOf(rawName: string): {
  group: "matchKit" | "tracksuit" | "training" | null;
  piece: "top" | "bottom";
} {
  switch (rawName) {
    case "Match Shirt":
      return { group: "matchKit", piece: "top" };
    case "Match Shorts":
      return { group: "matchKit", piece: "bottom" };
    case "Tracksuit Top":
      return { group: "tracksuit", piece: "top" };
    case "Tracksuit Bottom":
      return { group: "tracksuit", piece: "bottom" };
    case "Training Shirt":
      return { group: "training", piece: "top" };
    case "Training Shorts":
      return { group: "training", piece: "bottom" };
    default:
      return { group: null, piece: "top" };
  }
}

interface SizeRow {
  typeId: string;
  /** raw internal type name used for grouping (e.g. "Match Shirt") */
  name: string;
  label: string;
  size: string | null;
}

interface GroupedRow extends SizeRow {
  piece: "top" | "bottom";
}

export function PlayerSizesForm({
  action,
  athleteId,
  rows,
  noneLabel,
  otherLabel,
  customPlaceholder,
  saveLabel,
  savingLabel,
  groupLabels,
  topLabel,
  bottomLabel,
  shirtLabel,
  shortsLabel,
}: {
  action: (formData: FormData) => Promise<void>;
  athleteId: string;
  rows: SizeRow[];
  noneLabel: string;
  otherLabel: string;
  customPlaceholder: string;
  saveLabel: string;
  savingLabel: string;
  groupLabels: { matchKit: string; tracksuit: string; training: string };
  topLabel: string;
  bottomLabel: string;
  shirtLabel: string;
  shortsLabel: string;
}) {
  const tf = useTranslations("feedback");
  const [choices, setChoices] = useState<Record<string, string>>(
    Object.fromEntries(
      rows.map((row) => [
        row.typeId,
        row.size && SIZES.includes(row.size) ? row.size : row.size ? CUSTOM : "",
      ])
    )
  );
  const [customs, setCustoms] = useState<Record<string, string>>(
    Object.fromEntries(
      rows.map((row) => [
        row.typeId,
        row.size && !SIZES.includes(row.size) ? row.size : "",
      ])
    )
  );

  function SizeControl({ row, label }: { row: SizeRow; label: string }) {
    const choice = choices[row.typeId] ?? "";
    const showCustom = choice === CUSTOM;
    return (
      <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
        <select
          name={`size_${row.typeId}_preset`}
          aria-label={label}
          value={choice}
          onChange={(e) =>
            setChoices({ ...choices, [row.typeId]: e.target.value })
          }
          className="h-10 w-28 rounded-md border border-border bg-background px-2.5 text-sm sm:h-9"
        >
          <option value="">{noneLabel}</option>
          {SIZES.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
          <option value={CUSTOM}>{otherLabel}</option>
        </select>
        {showCustom && (
          <input
            name={`size_${row.typeId}_custom`}
            aria-label={`${label} — ${otherLabel}`}
            value={customs[row.typeId] ?? ""}
            onChange={(e) =>
              setCustoms({ ...customs, [row.typeId]: e.target.value })
            }
            placeholder={customPlaceholder}
            className="h-10 w-28 rounded-md border border-border bg-background px-2.5 text-sm sm:h-9"
          />
        )}
      </div>
    );
  }

  // One piece = a compact label + its select, laid out on a single line and
  // filling the width so the control sits in an aligned column (mirrors the
  // profile's key/value rows). Wraps to a second line only when too tight.
  function SizeField({ row, label }: { row: SizeRow; label: string }) {
    return (
      <label className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <span className="text-sm text-muted-foreground">{label}</span>
        <SizeControl row={row} label={label} />
      </label>
    );
  }

  // Group the six default pieces into the kit groups; everything else stays a
  // standalone row (custom club types).
  const groups: Record<"matchKit" | "tracksuit" | "training", GroupedRow[]> = {
    matchKit: [],
    tracksuit: [],
    training: [],
  };
  const singletons: SizeRow[] = [];
  for (const row of rows) {
    const g = groupOf(row.name);
    if (g.group) groups[g.group].push({ ...row, piece: g.piece });
    else singletons.push(row);
  }

  const pieceLabel = (row: GroupedRow) => {
    if (row.piece === "top") {
      return row.name.startsWith("Training") ? shirtLabel : topLabel;
    }
    return row.name.startsWith("Training") ? shortsLabel : bottomLabel;
  };

  const order: ("matchKit" | "tracksuit" | "training")[] = [
    "matchKit",
    "tracksuit",
    "training",
  ];

  // Grid template: a leading category label, then the two piece columns. On
  // phones the two fields sit side by side from ~400px up (below that they
  // stack); the category label always spans full width above them.
  const rowGrid =
    "grid grid-cols-1 gap-x-6 gap-y-2 min-[400px]:grid-cols-2 sm:grid-cols-[7rem_minmax(0,1fr)_minmax(0,1fr)] sm:items-center";

  return (
    <MutationForm
      action={action}
      successMessage={tf("playerSizesSaved")}
      errorMessage={tf("saveFailed")}
    >
      <input type="hidden" name="athlete_id" value={athleteId} />

      <div className="space-y-3.5 sm:space-y-3">
        {order.map((key) => {
          const items = groups[key];
          if (items.length === 0) return null;
          return (
            <div key={key} className={rowGrid}>
              <p className="text-sm font-semibold text-foreground sm:col-span-1">
                {groupLabels[key]}
              </p>
              {items.map((row) => (
                <SizeField
                  key={row.typeId}
                  row={row}
                  label={pieceLabel(row)}
                />
              ))}
            </div>
          );
        })}

        {singletons.map((row) => (
          <div key={row.typeId} className={rowGrid}>
            <p className="text-sm font-semibold text-foreground sm:col-span-1">
              {row.label}
            </p>
            <div className="min-[400px]:col-span-2 sm:col-span-2 sm:max-w-[calc(50%-0.75rem)]">
              <SizeField row={row} label={row.label} />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-5 flex justify-end">
        <FormSubmitButton
          idleLabel={saveLabel}
          pendingLabel={savingLabel}
          className="h-10 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground"
        />
      </div>
    </MutationForm>
  );
}
