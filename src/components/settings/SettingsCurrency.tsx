"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { FormSubmitButton } from "@/components/FormSubmitButton";
import { useMutationFeedback } from "@/components/ui/useMutationFeedback";
import { SUPPORTED_CURRENCIES, type Currency } from "@/lib/currency";

type CurrencyActionState = { ok?: boolean; error?: string } | null;

/**
 * The club's single currency (V1) — one setting for the whole organization, so
 * no per-player/per-contract choice exists anywhere. A plain select keeps the
 * two human-readable options ("Srpski dinar (RSD)" / "Evro (EUR)") on one line
 * at any width; saving runs the real server action with a real pending state
 * ("Sačuvaj" -> "Čuvanje...") and a disabled button, so double submits are
 * impossible. Changing the currency never converts stored amounts.
 */
export function SettingsCurrency({
  action,
  current,
  canManage,
  title,
  description,
  rsdLabel,
  eurLabel,
  saveLabel,
  savingLabel,
}: {
  action: (state: CurrencyActionState, formData: FormData) => Promise<CurrencyActionState>;
  current: Currency;
  canManage: boolean;
  title: string;
  description: string;
  rsdLabel: string;
  eurLabel: string;
  saveLabel: string;
  savingLabel: string;
}) {
  const tf = useTranslations("feedback");
  const [state, formAction] = useMutationFeedback(action, {
    successMessage: tf("currencySaved"),
    errorMessage: tf("saveFailed"),
  });
  const [selected, setSelected] = useState<Currency>(current);
  const optionLabels: Record<Currency, string> = { RSD: rsdLabel, EUR: eurLabel };

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card">
      <header className="border-b border-border px-4 py-3 sm:px-5">
        <h2 className="text-sm font-semibold tracking-tight text-foreground">{title}</h2>
      </header>
      <form
        action={formAction}
        className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5"
      >
        <div className="min-w-0 sm:flex-1">
          <p className="text-sm text-muted-foreground">{description}</p>
          {state?.error && (
            <p role="alert" className="mt-1 text-sm text-destructive">
              {state.error}
            </p>
          )}

        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:shrink-0 sm:flex-row sm:items-center">
          <select
            name="currency"
            value={selected}
            onChange={(event) => setSelected(event.target.value as Currency)}
            disabled={!canManage}
            aria-label={title}
            className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-60 sm:w-60"
          >
            {SUPPORTED_CURRENCIES.map((code) => (
              <option key={code} value={code}>
                {optionLabels[code]}
              </option>
            ))}
          </select>
          {canManage && (
            <FormSubmitButton
              idleLabel={saveLabel}
              pendingLabel={savingLabel}
              className="h-10 w-full rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 sm:w-auto"
            />
          )}
        </div>
      </form>
    </section>
  );
}
