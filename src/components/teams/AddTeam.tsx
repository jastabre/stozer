"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { FormSubmitButton } from "@/components/FormSubmitButton";
import { MutationForm } from "@/components/ui/MutationForm";

/**
 * "Dodaj tim" trigger + compact form dialog. One instance renders the trigger
 * and owns the form, so the empty-state CTA and the header CTA open the exact
 * same flow (never a second create form).
 */
export function AddTeam({
  action,
  categories,
  labels,
  triggerClassName,
}: {
  action: (formData: FormData) => Promise<void>;
  categories: { value: string; label: string }[];
  labels: {
    add: string;
    name: string;
    category: string;
    submit: string;
    submitting: string;
    cancel: string;
  };
  triggerClassName?: string;
}) {
  const tf = useTranslations("feedback");
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          triggerClassName ??
          "inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        }
      >
        <Plus className="h-4 w-4" aria-hidden="true" />
        {labels.add}
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title={labels.add}>
        <MutationForm
          action={action}
          successMessage={tf("teamAdded")}
          errorMessage={tf("addFailed")}
          className="grid gap-3 sm:grid-cols-2"
        >
          <input
            name="name"
            placeholder={labels.name}
            required
            className="field sm:col-span-2"
          />
          <select
            name="category"
            defaultValue=""
            required
            aria-label={labels.category}
            className="field"
          >
            <option value="" disabled>
              {labels.category}
            </option>
            {categories.map((category) => (
              <option key={category.value} value={category.value}>
                {category.label}
              </option>
            ))}
          </select>
          <div className="flex justify-end gap-2 sm:col-span-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
            >
              {labels.cancel}
            </button>
            <FormSubmitButton
              idleLabel={labels.submit}
              pendingLabel={labels.submitting}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            />
          </div>
        </MutationForm>
      </Modal>
    </>
  );
}
