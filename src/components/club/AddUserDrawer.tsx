"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Drawer } from "@/components/ui/Drawer";
import { FormSubmitButton } from "@/components/FormSubmitButton";
import { useMutationFeedback } from "@/components/ui/useMutationFeedback";
import { TeamMultiSelect } from "@/components/club/TeamMultiSelect";
import { RoleSummaryCard } from "@/components/club/RoleSummaryCard";
import { staffFunctionLabel } from "@/lib/staff-functions";
import type { LinkableStaff } from "@/lib/club-users";
import type { RoleMetadataView } from "@/lib/staff-profile";

export interface ClubAccountStateShape {
  error?: string;
  ok?: boolean;
  invited?: boolean;
}

interface AddUserDrawerProps {
  action: (
    state: ClubAccountStateShape | null,
    formData: FormData
  ) => Promise<ClubAccountStateShape | null>;
  staffOptions: LinkableStaff[];
  /** Person pre-selected by a deep link, e.g. /club/users?add=<staffId>. */
  defaultStaffId?: string;
  /** Open the drawer on mount, e.g. when arriving from a deep link. */
  defaultOpen?: boolean;
  locale: "sr" | "en";
  teams: { id: string; name: string }[];
  seasonId: string | null;
  roles: RoleMetadataView[];
  labels: {
    trigger: string;
    title: string;
    staff: string;
    staffPlaceholder: string;
    staffFunction: string;
    noStaff: string;
    email: string;
    emailHint: string;
    role: string;
    rolePlaceholder: string;
    roleHint: string;
    teams: string;
    teamsHint: string;
    chooseTeams: string;
    removeTeam: string;
    noSeason: string;
    scope: string;
    canTitle: string;
    deniedTitle: string;
    detailsToggle: string;
    noAccess: string;
    submit: string;
    submitting: string;
    close: string;
  };
  triggerClassName: string;
}

/**
 * "Dodaj Stožer nalog" — the central account drawer on Users & access. Plain
 * vertical form: pick a person, email, a normal role select with its
 * description, a compact capability summary, teams only for team-scoped roles,
 * and a sticky footer. It can be deep-linked open with the person pre-selected
 * from the staff profile.
 */
export function AddUserDrawer({
  action,
  staffOptions,
  defaultStaffId,
  defaultOpen,
  locale,
  teams,
  seasonId,
  roles,
  labels,
  triggerClassName,
}: AddUserDrawerProps) {
  const formId = "add-user-form";
  const tf = useTranslations("feedback");
  const initialStaffId = defaultStaffId ?? "";
  const [open, setOpen] = useState(defaultOpen ?? false);
  const [staffId, setStaffId] = useState(initialStaffId);
  const [role, setRole] = useState("");
  const [email, setEmail] = useState(
    staffOptions.find((option) => option.id === initialStaffId)?.email ?? ""
  );
  // The global feedback standard: pending comes from the action, the success
  // toast says whether an invite was sent or an existing account was linked,
  // and the drawer closes only after the server confirms.
  const [state, formAction, isPending] = useMutationFeedback(action, {
    successMessage: (result) =>
      result?.invited ? tf("inviteSent") : tf("userAdded"),
    errorMessage: tf("addFailed"),
    onSuccess: () => setOpen(false),
  });

  const selectedRole = roles.find((item) => item.key === role) ?? null;
  const selectedStaff =
    staffOptions.find((option) => option.id === staffId) ?? null;
  const staffFunctionsText = (option: LinkableStaff): string | null => {
    const functions = option.functions.map((fn) =>
      staffFunctionLabel(fn.function_key, locale, fn.custom_label)
    );
    if (functions.length > 0) return functions.join(" · ");
    return option.title;
  };
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const ready = Boolean(staffId) && Boolean(role) && emailValid;

  if (staffOptions.length === 0) {
    return (
      <button type="button" disabled className={triggerClassName}>
        {labels.noStaff}
      </button>
    );
  }

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
        onClose={() => setOpen(false)}
        title={labels.title}
        closeLabel={labels.close}
        size="lg"
        // The header X is the only way out: a half-filled invite form must not
        // vanish because of a stray backdrop click or Escape.
        dismissOnOverlayClick={false}
        dismissOnEscape={false}
        footer={
          <div className="flex items-center justify-end">
            <FormSubmitButton
              form={formId}
              idleLabel={labels.submit}
              pendingLabel={labels.submitting}
              pending={isPending}
              disabled={!ready}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            />
          </div>
        }
      >
        <form id={formId} action={formAction} className="space-y-6">
          <div className="grid gap-2">
            <label className="grid gap-2 text-xs font-medium text-muted-foreground">
              {labels.staff}
              <select
                name="staff_id"
                required
                value={staffId}
                onChange={(event) => {
                  setStaffId(event.target.value);
                  const option = staffOptions.find(
                    (candidate) => candidate.id === event.target.value
                  );
                  if (option?.email) setEmail(option.email);
                }}
                className="field"
              >
                <option value="" disabled>
                  {labels.staffPlaceholder}
                </option>
                {staffOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                ))}
              </select>
            </label>
            {/* Club function is NOT a Stožer role: show it as plain information
                so the role select below is never mistaken for it. */}
            {selectedStaff && (
              <div className="rounded-lg border border-border bg-muted/30 px-3 py-2.5">
                <p className="text-sm font-medium text-foreground">
                  {selectedStaff.name}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {labels.staffFunction}:{" "}
                  <span className="font-medium text-foreground">
                    {staffFunctionsText(selectedStaff) ?? "—"}
                  </span>
                </p>
              </div>
            )}
          </div>
          {seasonId && <input type="hidden" name="season_id" value={seasonId} />}

          <div>
            <label className="grid gap-2 text-xs font-medium text-muted-foreground">
              {labels.email}
              <input
                name="email"
                type="email"
                required
                maxLength={255}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="field"
                autoComplete="off"
              />
            </label>
            <p className="mt-1.5 text-xs text-muted-foreground">{labels.emailHint}</p>
          </div>

          <div>
            <label className="grid gap-2 text-xs font-medium text-muted-foreground">
              {labels.role}
              <select
                name="role"
                required
                value={role}
                onChange={(event) => setRole(event.target.value)}
                className="field"
              >
                <option value="" disabled>
                  {labels.rolePlaceholder}
                </option>
                {roles.map((option) => (
                  <option key={option.key} value={option.key}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <p className="mt-1.5 text-xs text-muted-foreground">
              {labels.roleHint}
            </p>
            {selectedRole && (
              <p className="mt-2 text-sm text-muted-foreground">
                {selectedRole.description}
              </p>
            )}
          </div>

          {selectedRole && (
            <RoleSummaryCard
              role={selectedRole}
              showDescription={false}
              labels={{
                scope: labels.scope,
                canTitle: labels.canTitle,
                deniedTitle: labels.deniedTitle,
                detailsToggle: labels.detailsToggle,
                noAccess: labels.noAccess,
              }}
            />
          )}

          {selectedRole?.teamScoped && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">
                {labels.teams}
              </p>
              {seasonId ? (
                <TeamMultiSelect
                  teams={teams}
                  labels={{
                    choose: labels.chooseTeams,
                    remove: labels.removeTeam,
                    empty: labels.teamsHint,
                  }}
                />
              ) : (
                <p className="text-xs text-muted-foreground">{labels.noSeason}</p>
              )}
            </div>
          )}

          {state?.error && (
            <p role="alert" className="text-sm text-destructive">
              {state.error}
            </p>
          )}
        </form>
      </Drawer>
    </>
  );
}
