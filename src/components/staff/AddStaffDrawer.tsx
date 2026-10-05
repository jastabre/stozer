"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Info } from "lucide-react";
import { Drawer } from "@/components/ui/Drawer";
import { FormSubmitButton } from "@/components/FormSubmitButton";
import { DateField } from "@/components/ui/DateField";
import { MutationForm } from "@/components/ui/MutationForm";
import { StaffFunctionsEditor } from "@/components/ui/StaffFunctionsEditor";
import { formatClubAthleteNumber } from "@/lib/athlete-id";
import { safeFeedbackMessage } from "@/lib/feedback";
import type { LinkableAthlete } from "@/lib/staff";

export interface StaffCreateStateShape {
  error?: string;
}

interface AddStaffDrawerProps {
  action: (
    state: StaffCreateStateShape | null,
    formData: FormData
  ) => Promise<StaffCreateStateShape | null>;
  locale: "sr" | "en";
  /** Athletes that are not linked to a staff profile yet. */
  athleteOptions: LinkableAthlete[];
  labels: {
    trigger: string;
    title: string;
    subtitle: string;
    basicInfo: string;
    contact: string;
    engagement: string;
    firstName: string;
    lastName: string;
    modeNew: string;
    modeExisting: string;
    athleteSearch: string;
    athleteSearchPlaceholder: string;
    athleteEmpty: string;
    athleteSelected: string;
    athleteNoTeam: string;
    titleField: string;
    addFunction: string;
    removeFunction: string;
    otherFunction: string;
    customFunctionPlaceholder: string;
    functionSelectPlaceholder: string;
    accountInfoTitle: string;
    accountInfoBody: string;
    email: string;
    emailHint: string;
    phone: string;
    startDate: string;
    endDate: string;
    submit: string;
    submitting: string;
    linkSubmit: string;
    linkSubmitting: string;
    cancel: string;
    close: string;
  };
  triggerClassName: string;
}

const FORM_ID = "add-staff-form";

/**
 * "Dodaj člana osoblja" — creates ONLY a staff record (no Stožer account, no
 * role, no permissions). Two ways in: a brand-new person, or an existing
 * athlete that becomes staff without retyping the name (the profile is linked
 * through staff.athlete_id; no new athlete row is created). Club functions are
 * multi-value with one primary; Stožer access is added later from the profile
 * card via Klub → Korisnici i pristup.
 */
export function AddStaffDrawer({
  action,
  locale,
  athleteOptions,
  labels,
  triggerClassName,
}: AddStaffDrawerProps) {
  const tf = useTranslations("feedback");
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"new" | "existing">("new");
  const [athleteQuery, setAthleteQuery] = useState("");
  const [selectedAthleteId, setSelectedAthleteId] = useState<string | null>(
    null
  );
  const [state, setState] = useState<StaffCreateStateShape | null>(null);
  const [isPending, setIsPending] = useState(false);

  const sectionTitle =
    "text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground";
  const fieldLabel = "grid gap-1.5 text-sm font-medium text-foreground";
  const requiredMark = (
    <span aria-hidden="true" className="text-destructive">
      *
    </span>
  );

  const selectedAthlete =
    athleteOptions.find((option) => option.id === selectedAthleteId) ?? null;
  const normalizedQuery = athleteQuery.trim().toLowerCase();
  const matches = (
    normalizedQuery
      ? athleteOptions.filter(
          (option) =>
            option.name.toLowerCase().includes(normalizedQuery) ||
            String(option.club_athlete_number).includes(normalizedQuery)
        )
      : athleteOptions
  ).slice(0, 8);

  const close = () => setOpen(false);
  const functionLabels = {
    add: labels.addFunction,
    remove: labels.removeFunction,
    other: labels.otherFunction,
    customPlaceholder: labels.customFunctionPlaceholder,
    functionAria: labels.titleField,
    selectPlaceholder: labels.functionSelectPlaceholder,
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={triggerClassName}
      >
        {labels.trigger}
      </button>

      <Drawer
        open={open}
        onClose={close}
        title={labels.title}
        subtitle={labels.subtitle}
        closeLabel={labels.close}
        size="form"
        footer={
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={close}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
            >
              {labels.cancel}
            </button>
            <FormSubmitButton
              form={FORM_ID}
              idleLabel={mode === "existing" ? labels.linkSubmit : labels.submit}
              pendingLabel={
                mode === "existing"
                  ? labels.linkSubmitting
                  : labels.submitting
              }
              pending={isPending}
              disabled={mode === "existing" && !selectedAthleteId}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
            />
          </div>
        }
      >
        <MutationForm
          id={FORM_ID}
          action={async (formData) => action(null, formData)}
          successMessage={tf("staffAdded")}
          errorMessage={tf("addFailed")}
          resetOnSuccess={false}
          onPendingChange={setIsPending}
          onResult={(outcome) => {
            if (outcome && !outcome.ok) {
              setState({
                error: safeFeedbackMessage(outcome.error, tf("addFailed")),
              });
            }
          }}
          className="space-y-6"
        >
          <input type="hidden" name="locale" value={locale} />

          <section className="space-y-4">
            {/* Two clear ways in: new person, or an existing athlete. */}
            <div
              role="radiogroup"
              aria-label={labels.basicInfo}
              className="flex rounded-lg border border-border bg-muted/40 p-1"
            >
              {(["new", "existing"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={mode === value}
                  onClick={() => setMode(value)}
                  className={`flex h-8 flex-1 items-center justify-center rounded-md text-sm font-medium transition-colors ${
                    mode === value
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-background hover:text-foreground"
                  }`}
                >
                  {value === "new" ? labels.modeNew : labels.modeExisting}
                </button>
              ))}
            </div>

            {mode === "new" ? (
              <>
                <label className={fieldLabel}>
                  <span>
                    {labels.firstName} {requiredMark}
                  </span>
                  <input
                    name="first_name"
                    required
                    maxLength={100}
                    className="field"
                  />
                </label>
                <label className={fieldLabel}>
                  <span>
                    {labels.lastName} {requiredMark}
                  </span>
                  <input
                    name="last_name"
                    required
                    maxLength={100}
                    className="field"
                  />
                </label>
              </>
            ) : (
              <div className="space-y-2">
                {selectedAthlete ? (
                  <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2.5">
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">
                        {labels.athleteSelected}
                      </p>
                      <p className="truncate text-sm font-medium text-foreground">
                        {selectedAthlete.name}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {formatClubAthleteNumber(
                          selectedAthlete.club_athlete_number
                        )}{" "}
                        · {selectedAthlete.team_name ?? labels.athleteNoTeam}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedAthleteId(null)}
                      className="shrink-0 text-xs font-medium text-primary hover:underline"
                    >
                      {labels.athleteSearch}
                    </button>
                  </div>
                ) : (
                  <>
                    <label className={fieldLabel}>
                      {labels.athleteSearch}
                      <input
                        value={athleteQuery}
                        onChange={(event) =>
                          setAthleteQuery(event.target.value)
                        }
                        placeholder={labels.athleteSearchPlaceholder}
                        className="field"
                        autoComplete="off"
                      />
                    </label>
                    {athleteOptions.length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        {labels.athleteEmpty}
                      </p>
                    ) : (
                      <ul className="max-h-56 space-y-1 overflow-y-auto">
                        {matches.map((option) => (
                          <li key={option.id}>
                            <button
                              type="button"
                              onClick={() => setSelectedAthleteId(option.id)}
                              className="w-full rounded-lg border border-border px-3 py-2 text-left transition-colors hover:border-primary"
                            >
                              <span className="block text-sm font-medium text-foreground">
                                {option.name}
                              </span>
                              <span className="block text-xs text-muted-foreground">
                                {formatClubAthleteNumber(
                                  option.club_athlete_number
                                )}{" "}
                                · {option.team_name ?? labels.athleteNoTeam}
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                )}
                <input
                  type="hidden"
                  name="athlete_id"
                  value={selectedAthleteId ?? ""}
                />
              </div>
            )}

            <div className={fieldLabel}>
              <span>
                {labels.titleField} {requiredMark}
              </span>
              <StaffFunctionsEditor
                locale={locale}
                labels={functionLabels}
              />
            </div>

            {/* Club function and Stožer account are separate concepts: this
                block makes that explicit before the profile is created. */}
            <div className="flex gap-2 text-xs text-muted-foreground">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <div>
                <p className="font-medium text-foreground">
                  {labels.accountInfoTitle}
                </p>
                <p className="mt-0.5">{labels.accountInfoBody}</p>
              </div>
            </div>
          </section>

          <section className="space-y-4 border-t border-border pt-5">
            <h3 className={sectionTitle}>{labels.contact}</h3>
            <div>
              <label className={fieldLabel}>
                {labels.email}
                <input
                  name="email"
                  type="email"
                  maxLength={255}
                  autoComplete="off"
                  className="field"
                />
              </label>
              <p className="mt-1.5 text-xs text-muted-foreground">
                {labels.emailHint}
              </p>
            </div>
            <label className={fieldLabel}>
              {labels.phone}
              <input name="phone" type="tel" maxLength={50} className="field" />
            </label>
          </section>

          <section className="space-y-4 border-t border-border pt-5">
            <h3 className={sectionTitle}>{labels.engagement}</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className={fieldLabel}>
                {labels.startDate}
                <DateField name="start_date" ariaLabel={labels.startDate} />
              </label>
              <label className={fieldLabel}>
                {labels.endDate}
                <DateField name="end_date" ariaLabel={labels.endDate} />
              </label>
            </div>
          </section>

          {state?.error && (
            <p role="alert" className="text-sm text-destructive">
              {state.error}
            </p>
          )}
        </MutationForm>
      </Drawer>
    </>
  );
}
