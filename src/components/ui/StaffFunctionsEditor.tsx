"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { staffFunctions } from "@/lib/staff-functions";

export interface StaffFunctionRow {
  /** Preset function key from staff-functions.ts, "custom", or "" (unset). */
  key: string;
  /** Custom label, only when key === "custom". */
  custom: string;
}

/**
 * "Funkcije u klubu" editor: a plain list of equal club functions (no
 * "primary" concept in the UI). The user can add, remove and change any row;
 * only the last remaining row cannot be removed, because a staff member must
 * keep at least one function. Emits two hidden fields per row
 * (`function_key` + `custom_label`) in DOM order; the server stores the first
 * row as the internal compatibility primary and syncs the legacy staff.title.
 */
export function StaffFunctionsEditor({
  locale,
  initial,
  labels,
  className,
}: {
  locale: "sr" | "en";
  initial?: StaffFunctionRow[];
  labels: {
    add: string;
    remove: string;
    other: string;
    customPlaceholder: string;
    functionAria: string;
    selectPlaceholder: string;
  };
  className?: string;
}) {
  const presets = staffFunctions(locale);
  const [rows, setRows] = useState<StaffFunctionRow[]>(
    initial && initial.length > 0 ? initial : [{ key: "", custom: "" }]
  );

  const update = (index: number, patch: Partial<StaffFunctionRow>) => {
    setRows((current) =>
      current.map((row, i) => (i === index ? { ...row, ...patch } : row))
    );
  };

  return (
    <div className={className ?? "space-y-3"}>
      {rows.map((row, index) => (
        <div key={index} className="space-y-1.5">
          <div className="flex items-center gap-2">
            <select
              value={row.key}
              required={rows.length === 1 && index === 0}
              onChange={(event) =>
                update(index, {
                  key: event.target.value,
                  custom:
                    event.target.value === "custom" ? row.custom : "",
                })
              }
              aria-label={labels.functionAria}
              className="field min-w-0 flex-1"
            >
              <option value="" disabled>
                {labels.selectPlaceholder}
              </option>
              {presets.map((preset) => (
                <option key={preset.key} value={preset.key}>
                  {preset.label}
                </option>
              ))}
              <option value="custom">{labels.other}</option>
            </select>

            {rows.length > 1 && (
              <button
                type="button"
                onClick={() =>
                  setRows((current) => current.filter((_, i) => i !== index))
                }
                aria-label={labels.remove}
                title={labels.remove}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:border-destructive hover:text-destructive"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            )}
          </div>

          {row.key === "custom" && (
            <input
              value={row.custom}
              onChange={(event) => update(index, { custom: event.target.value })}
              placeholder={labels.customPlaceholder}
              aria-label={labels.customPlaceholder}
              maxLength={100}
              className="field"
            />
          )}

          <input type="hidden" name="function_key" value={row.key} />
          <input
            type="hidden"
            name="custom_label"
            value={row.key === "custom" ? row.custom : ""}
          />
        </div>
      ))}

      <button
        type="button"
        onClick={() =>
          setRows((current) => [...current, { key: "", custom: "" }])
        }
        className="inline-flex items-center gap-1.5 text-sm font-medium text-primary transition-colors hover:underline"
      >
        <Plus className="h-3.5 w-3.5" aria-hidden="true" />
        {labels.add}
      </button>
    </div>
  );
}
