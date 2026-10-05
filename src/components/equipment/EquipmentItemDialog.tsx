"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Modal } from "@/components/ui/Modal";
import { MutationForm } from "@/components/ui/MutationForm";
import { FormSubmitButton } from "@/components/FormSubmitButton";

const inputClass =
  "h-9 w-full rounded-lg border border-border bg-background px-2.5 text-sm";

const SIZE_MODES = ["none", "single", "split"] as const;

export interface EquipmentItemValue {
  id: string;
  name: string;
  size_mode: string;
  has_number: boolean;
}

/**
 * Compact create/edit dialog for a catalog article. The article only declares
 * HOW MANY size values it uses (no size / one size / upper + lower) and whether
 * it carries a number when issued. The actual clothing sizes are chosen later,
 * when the article is issued to a player — the catalog never stores a number.
 */
export function EquipmentItemDialog({
  mode,
  item,
  createAction,
  updateAction,
  triggerClassName,
}: {
  mode: "create" | "edit";
  item?: EquipmentItemValue;
  createAction: (formData: FormData) => Promise<unknown>;
  updateAction: (formData: FormData) => Promise<unknown>;
  triggerClassName?: string;
}) {
  const t = useTranslations("equipment");
  const tf = useTranslations("feedback");
  const [open, setOpen] = useState(false);
  const currentMode = item?.size_mode ?? "none";

  const sizeModeLabel = (value: (typeof SIZE_MODES)[number]) =>
    value === "single"
      ? t("sizeModeSingle")
      : value === "split"
        ? t("sizeModeSplit")
        : t("sizeNone");

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          triggerClassName ??
          (mode === "create"
            ? "inline-flex h-9 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            : "rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:border-primary hover:text-primary")
        }
      >
        {mode === "create" ? t("addItem") : t("edit")}
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={mode === "create" ? t("addItem") : t("edit")}
        panelClassName="max-w-md"
      >
        <MutationForm
          action={mode === "create" ? createAction : updateAction}
          successMessage={
            mode === "create"
              ? tf("equipmentItemAdded")
              : tf("equipmentItemUpdated")
          }
          errorMessage={mode === "create" ? tf("addFailed") : tf("saveFailed")}
          resetOnSuccess={false}
          onResult={(outcome) => {
            if (outcome?.ok) setOpen(false);
          }}
          className="grid gap-3"
        >
          {mode === "edit" && item && (
            <input type="hidden" name="item_id" value={item.id} />
          )}

          <label className="grid gap-1 text-xs text-muted-foreground">
            {t("itemName")}
            <input
              name="name"
              required
              maxLength={120}
              defaultValue={item?.name ?? ""}
              className={inputClass}
            />
          </label>

          <fieldset className="grid gap-2">
            <legend className="text-xs text-muted-foreground">
              {t("sizeModeLabel")}
            </legend>
            {SIZE_MODES.map((value) => (
              <label
                key={value}
                className="flex items-center gap-2 text-sm text-foreground"
              >
                <input
                  type="radio"
                  name="size_mode"
                  value={value}
                  defaultChecked={currentMode === value}
                  required
                />
                {sizeModeLabel(value)}
              </label>
            ))}
          </fieldset>

          <div className="grid gap-1">
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                name="has_number"
                value="true"
                defaultChecked={item?.has_number ?? false}
              />
              {t("hasNumber")}
            </label>
            <p className="text-xs text-muted-foreground">{t("hasNumberHint")}</p>
          </div>

          <div className="flex justify-end">
            <FormSubmitButton
              idleLabel={t("save")}
              pendingLabel={t("saving")}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            />
          </div>
        </MutationForm>
      </Modal>
    </>
  );
}
