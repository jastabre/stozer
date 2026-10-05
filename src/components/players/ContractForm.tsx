"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { DateField } from "@/components/ui/DateField";
import { MoneyInput } from "@/components/finance/MoneyInput";
import { FormSubmitButton } from "@/components/FormSubmitButton";
import { MutationForm } from "@/components/ui/MutationForm";

export type ContractFormValues = {
  id?: string;
  contract_type: string;
  status: string;
  valid_from: string;
  valid_until: string;
  monthly_salary: number | null;
  pay_schedule: string;
  custom_months: number[] | null;
  notes: string;
};

export type ContractFormLabels = {
  startDate: string;
  endDate: string;
  monthlySalary: string;
  paySchedule: string;
  schedules: { all_year: string; competition_months: string; custom_months: string };
  months: string[];
  pickMonths: string;
  notes: string;
  save: string;
  saving: string;
};

const SCHEDULES = ["all_year", "competition_months", "custom_months"] as const;

/**
 * The single add/edit contract form. Uses the shared DateField for DD.MM.GGGG
 * entry, and reveals the month picker only for the "custom months" schedule
 * (progressive disclosure). The salary uses the shared MoneyInput with the
 * CLUB currency as suffix — there is no per-contract currency choice in V1.
 * `contract_type`/`status` stay as hidden fields so the existing obligation
 * logic and DB NOT NULLs are untouched.
 */
export function ContractForm({
  action,
  athleteId,
  contract,
  currency,
  labels,
}: {
  action: (formData: FormData) => Promise<void>;
  athleteId: string;
  contract?: ContractFormValues | null;
  /** The club's single currency (V1), shown as the salary input suffix. */
  currency: string;
  labels: ContractFormLabels;
}) {
  const tf = useTranslations("feedback");
  const [schedule, setSchedule] = useState<string>(
    contract?.pay_schedule ?? "all_year"
  );
  const [months, setMonths] = useState<number[]>(
    (contract?.custom_months ?? []).filter((n) => n >= 1 && n <= 12)
  );
  const [salary, setSalary] = useState(
    contract?.monthly_salary != null ? String(contract.monthly_salary) : ""
  );

  function toggleMonth(m: number) {
    setMonths((prev) =>
      prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m].sort((a, b) => a - b)
    );
  }

  return (
    <MutationForm
      action={action}
      successMessage={tf("contractSaved")}
      errorMessage={tf("saveFailed")}
      resetOnSuccess={false}
      className="grid gap-3 text-left sm:grid-cols-2"
    >
      <input type="hidden" name="athlete_id" value={athleteId} />
      {contract?.id && <input type="hidden" name="id" value={contract.id} />}
      {/* Preserved so the DB NOT NULL + existing obligations keep working; the
          simple UI never surfaces these. */}
      <input type="hidden" name="contract_type" value={contract?.contract_type ?? "Standard"} />
      <input type="hidden" name="status" value={contract?.status ?? "active"} />

      <label className="grid gap-1 text-xs text-muted-foreground">
        {labels.startDate}
        <DateField
          name="valid_from"
          defaultValue={contract?.valid_from ?? ""}
          required
          ariaLabel={labels.startDate}
        />
      </label>
      <label className="grid gap-1 text-xs text-muted-foreground">
        {labels.endDate}
        <DateField
          name="valid_until"
          defaultValue={contract?.valid_until ?? ""}
          ariaLabel={labels.endDate}
        />
      </label>

      <label className="grid gap-1 text-xs text-muted-foreground">
        {labels.monthlySalary}
        <MoneyInput
          name="monthly_salary"
          value={salary}
          onValueChange={setSalary}
          currency={currency}
          ariaLabel={labels.monthlySalary}
          className="mt-1"
          inputClassName="h-10"
        />
      </label>

      <div className="sm:col-span-2">
        <span className="text-xs text-muted-foreground">{labels.paySchedule}</span>
        <div className="mt-1 grid gap-2 sm:grid-cols-3">
          {SCHEDULES.map((value) => (
            <label
              key={value}
              className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
                schedule === value
                  ? "border-primary bg-primary/5 text-foreground"
                  : "border-border text-muted-foreground hover:bg-muted/40"
              }`}
            >
              <input
                type="radio"
                name="pay_schedule"
                value={value}
                checked={schedule === value}
                onChange={() => setSchedule(value)}
                className="accent-primary"
              />
              {labels.schedules[value]}
            </label>
          ))}
        </div>
      </div>

      {schedule === "custom_months" && (
        <fieldset className="sm:col-span-2">
          <legend className="text-xs text-muted-foreground">{labels.pickMonths}</legend>
          <div className="mt-2 grid grid-cols-3 gap-1.5 sm:grid-cols-4">
            {labels.months.map((name, i) => {
              const m = i + 1;
              const on = months.includes(m);
              return (
                <label
                  key={m}
                  className={`flex items-center gap-2 rounded-md border px-2 py-1.5 text-xs transition-colors ${
                    on
                      ? "border-primary bg-primary/5 text-foreground"
                      : "border-border text-muted-foreground hover:bg-muted/40"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() => toggleMonth(m)}
                    className="sr-only"
                  />
                  <span
                    aria-hidden="true"
                    className={`h-3.5 w-3.5 shrink-0 rounded border ${
                      on ? "border-primary bg-primary" : "border-border"
                    }`}
                  />
                  <span className="truncate">{name}</span>
                </label>
              );
            })}
          </div>
          {/* Single submit field the action parses as "1,2,3" (kept stable for
              the existing custom_months contract shape). */}
          <input type="hidden" name="custom_months" value={months.join(",")} />
        </fieldset>
      )}

      <label className="grid gap-1 text-xs text-muted-foreground sm:col-span-2">
        {labels.notes}
        <textarea
          name="notes"
          rows={2}
          defaultValue={contract?.notes ?? ""}
          className="mt-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
        />
      </label>

      <div className="sm:col-span-2">
        <FormSubmitButton
          idleLabel={labels.save}
          pendingLabel={labels.saving}
          className="h-10 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground"
        />
      </div>
    </MutationForm>
  );
}
