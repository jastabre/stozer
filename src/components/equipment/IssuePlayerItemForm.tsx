"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { FormSubmitButton } from "@/components/FormSubmitButton";
import { MutationForm } from "@/components/ui/MutationForm";

const SIZES = ["XS", "S", "M", "L", "XL", "XXL", "XXXL"];
const CUSTOM = "__custom__";

export interface IssuePlayerItem {
  id: string;
  name: string;
  /** none | single | split — how many sizes this article uses. */
  size_mode: string;
  /** Whether this article carries a number/marking when issued. */
  has_number: boolean;
}

function SizeControl({
  label,
  name,
  noneLabel,
  otherLabel,
  customPlaceholder,
}: {
  label: string;
  name: string;
  noneLabel: string;
  otherLabel: string;
  customPlaceholder: string;
}) {
  const [choice, setChoice] = useState("");
  const [custom, setCustom] = useState("");

  return (
    <label className="grid gap-1 text-xs text-muted-foreground">
      {label}
      <select
        name={`${name}_preset`}
        value={choice}
        onChange={(event) => {
          setChoice(event.target.value);
          if (event.target.value !== CUSTOM) setCustom("");
        }}
        className="h-9 rounded-lg border border-border bg-background px-2 text-sm"
      >
        <option value="">{noneLabel}</option>
        {SIZES.map((size) => (
          <option key={size} value={size}>
            {size}
          </option>
        ))}
        <option value={CUSTOM}>{otherLabel}</option>
      </select>
      {choice === CUSTOM && (
        <input
          name={`${name}_custom`}
          value={custom}
          onChange={(event) => setCustom(event.target.value)}
          placeholder={customPlaceholder}
          className="h-9 rounded-lg border border-border bg-background px-2 text-sm"
        />
      )}
    </label>
  );
}

/**
 * The single "issue equipment" form: pick a catalog item, then fill in the
 * actual sizes the article uses (none / one / upper+lower, per the article's
 * size mode), its optional equipment number (prefilled from the player's
 * current-team jersey number and editable) and a note. One form per player
 * instead of one form per catalog item.
 */
export function IssuePlayerItemForm({
  action,
  athleteId,
  items,
  jerseyNumber,
  onDone,
}: {
  action: (formData: FormData) => Promise<unknown>;
  athleteId: string;
  items: IssuePlayerItem[];
  /** The player's current active-season jersey number (for the note). */
  jerseyNumber: number | null;
  onDone?: () => void;
}) {
  const t = useTranslations("equipment");
  const tf = useTranslations("feedback");
  const [itemId, setItemId] = useState("");
  const selected = items.find((item) => item.id === itemId) ?? null;

  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">{t("noAvailableItems")}</p>;
  }

  return (
    <MutationForm
      action={action}
      successMessage={tf("equipmentAssigned")}
      errorMessage={tf("equipmentFailed")}
      resetOnSuccess={false}
      onResult={(outcome) => {
        if (outcome?.ok) onDone?.();
      }}
      className="grid gap-3 rounded-lg border border-border bg-muted/20 p-3 sm:grid-cols-2"
    >
      <input type="hidden" name="athlete_id" value={athleteId} />
      <label className="grid gap-1 text-xs text-muted-foreground sm:col-span-2">
        {t("itemLabel")}
        <select
          name="item_id"
          required
          value={itemId}
          onChange={(event) => setItemId(event.target.value)}
          className="h-9 rounded-lg border border-border bg-background px-2 text-sm"
        >
          <option value="" disabled>
            {t("itemPlaceholder")}
          </option>
          {items.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </label>

      {selected?.size_mode === "single" && (
        <SizeControl
          key={`single-${selected.id}`}
          label={t("sizes.size")}
          name="size_top"
          noneLabel={t("sizeNone")}
          otherLabel={t("sizes.other")}
          customPlaceholder={t("sizes.customPlaceholder")}
        />
      )}
      {selected?.size_mode === "split" && (
        <>
          <SizeControl
            key={`top-${selected.id}`}
            label={t("topLabel")}
            name="size_top"
            noneLabel={t("sizeNone")}
            otherLabel={t("sizes.other")}
            customPlaceholder={t("sizes.customPlaceholder")}
          />
          <SizeControl
            key={`bottom-${selected.id}`}
            label={t("bottomLabel")}
            name="size_bottom"
            noneLabel={t("sizeNone")}
            otherLabel={t("sizes.other")}
            customPlaceholder={t("sizes.customPlaceholder")}
          />
        </>
      )}

      {selected?.has_number && (
        <div className="grid gap-1">
          <label className="grid gap-1 text-xs text-muted-foreground">
            {t("numberLabel")}
            <input
              name="number"
              maxLength={12}
              defaultValue={jerseyNumber ?? ""}
              className="h-9 rounded-lg border border-border bg-background px-2 text-sm"
            />
          </label>
          {jerseyNumber == null && (
            <p className="text-xs text-muted-foreground">
              {t("jerseyNumberMissing")}
            </p>
          )}
        </div>
      )}

      <label className="grid gap-1 text-xs text-muted-foreground sm:col-span-2">
        {t("noteLabel")}
        <input
          name="note"
          maxLength={200}
          placeholder={t("notePlaceholder")}
          className="h-9 rounded-lg border border-border bg-background px-2 text-sm"
        />
      </label>

      <div className="sm:col-span-2">
        <FormSubmitButton
          idleLabel={t("issue")}
          pendingLabel={t("issuing")}
          disabled={!selected}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
        />
      </div>
    </MutationForm>
  );
}
