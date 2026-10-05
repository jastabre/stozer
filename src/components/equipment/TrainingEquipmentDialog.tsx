"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Modal } from "@/components/ui/Modal";
import { MutationForm } from "@/components/ui/MutationForm";
import { FormSubmitButton } from "@/components/FormSubmitButton";

const STATES = ["missing", "issued", "returned", "lost", "damaged"] as const;
const inputClass =
  "h-9 w-full rounded-lg border border-border bg-background px-2.5 text-sm";

export interface TrainingEquipmentValue {
  id: string;
  item_name: string;
  team_id: string | null;
  responsible_staff_id: string | null;
  quantity: number;
  state: string;
  note: string | null;
}

/**
 * Compact create/edit dialog for team & training equipment (balls, cones,
 * bibs…). Kept out of the table rows so the list stays readable.
 */
export function TrainingEquipmentDialog({
  mode,
  equipment,
  teams,
  staff,
  seasonId,
  createAction,
  updateAction,
  triggerClassName,
}: {
  mode: "create" | "edit";
  equipment?: TrainingEquipmentValue;
  teams: { id: string; name: string }[];
  staff: { id: string; name: string }[];
  seasonId: string | null;
  createAction: (formData: FormData) => Promise<unknown>;
  updateAction: (formData: FormData) => Promise<unknown>;
  triggerClassName?: string;
}) {
  const t = useTranslations("equipment");
  const tf = useTranslations("feedback");
  const [open, setOpen] = useState(false);

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
          {mode === "edit" && equipment && (
            <input type="hidden" name="equipment_id" value={equipment.id} />
          )}
          {mode === "create" && (
            <input type="hidden" name="season_id" value={seasonId ?? ""} />
          )}

          <label className="grid gap-1 text-xs text-muted-foreground">
            {t("itemName")}
            <input
              name="item_name"
              required
              maxLength={120}
              defaultValue={equipment?.item_name ?? ""}
              className={inputClass}
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-xs text-muted-foreground">
              {t("team")}
              <select
                name="team_id"
                defaultValue={equipment?.team_id ?? ""}
                className={inputClass}
              >
                <option value="">{t("unassigned")}</option>
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-xs text-muted-foreground">
              {t("responsible")}
              <select
                name="responsible_staff_id"
                defaultValue={equipment?.responsible_staff_id ?? ""}
                className={inputClass}
              >
                <option value="">{t("noResponsible")}</option>
                {staff.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-xs text-muted-foreground">
              {t("quantity")}
              <input
                name="quantity"
                type="number"
                min={0}
                max={9999}
                defaultValue={equipment?.quantity ?? 1}
                className={inputClass}
              />
            </label>
            <label className="grid gap-1 text-xs text-muted-foreground">
              {t("state")}
              <select
                name="state"
                defaultValue={equipment?.state ?? "issued"}
                className={inputClass}
              >
                {STATES.map((state) => (
                  <option key={state} value={state}>
                    {t(`teamStates.${state}`)}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="grid gap-1 text-xs text-muted-foreground">
            {t("noteLabel")}
            <textarea
              name="note"
              rows={2}
              maxLength={300}
              defaultValue={equipment?.note ?? ""}
              placeholder={t("notePlaceholder")}
              className="rounded-lg border border-border bg-background px-2.5 py-2 text-sm"
            />
          </label>

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
