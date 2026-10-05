"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Drawer } from "@/components/ui/Drawer";
import { FormSubmitButton } from "@/components/FormSubmitButton";
import { useMutationFeedback } from "@/components/ui/useMutationFeedback";
import { TeamMultiSelect } from "@/components/club/TeamMultiSelect";
import { RoleSummaryCard } from "@/components/club/RoleSummaryCard";
import { StatusBadge, type StatusTone } from "@/components/ui/StatusBadge";
import type { AccountStatus } from "@/lib/account-status";
import type { RoleMetadataView } from "@/lib/staff-profile";
import type { ClubAccountStateShape } from "./AddUserDrawer";

interface DrawerUser {
  userId: string;
  email: string;
  role: string;
  staffName: string | null;
  status: AccountStatus;
  teamIds: string[];
  isSelf: boolean;
}

interface UserDrawerProps {
  open: boolean;
  onClose: () => void;
  user: DrawerUser | null;
  teams: { id: string; name: string }[];
  seasonId: string | null;
  roles: RoleMetadataView[];
  updateAction: (
    state: ClubAccountStateShape | null,
    formData: FormData
  ) => Promise<ClubAccountStateShape | null>;
  resendAction: (
    state: ClubAccountStateShape | null,
    formData: FormData
  ) => Promise<ClubAccountStateShape | null>;
  disableAction: (
    state: ClubAccountStateShape | null,
    formData: FormData
  ) => Promise<ClubAccountStateShape | null>;
  statusLabels: Record<AccountStatus, string>;
  labels: {
    linkedStaff: string;
    noLinkedStaff: string;
    role: string;
    rolePlaceholder: string;
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
    save: string;
    saving: string;
    saved: string;
    resend: string;
    resending: string;
    resendOk: string;
    deactivate: string;
    deactivateConfirmTitle: string;
    deactivateConfirmBody: string;
    deactivateConfirm: string;
    deactivating: string;
    reactivate: string;
    reactivating: string;
    cancel: string;
    selfNote: string;
    close: string;
  };
}

const STATUS_TONES: Record<AccountStatus, StatusTone> = {
  none: "muted",
  invited: "blue",
  active: "green",
  disabled: "red",
};

const FORM_ID = "edit-user-form";

/**
 * Account detail drawer (edit flow) — the same drawer shell as "Dodaj Stožer
 * nalog". The shell is keyed by user id, so switching users resets every form
 * without a state-syncing effect; the sticky footer keeps "Sačuvaj izmene"
 * visible while the body scrolls.
 */
export function UserDrawer(props: UserDrawerProps) {
  if (!props.user) return null;
  const user = props.user;

  return <UserDrawerShell key={user.userId} {...props} user={user} />;
}

function UserDrawerShell({
  open,
  onClose,
  user,
  teams,
  seasonId,
  roles,
  updateAction,
  resendAction,
  disableAction,
  statusLabels,
  labels,
}: UserDrawerProps & { user: DrawerUser }) {
  const tf = useTranslations("feedback");
  const [role, setRole] = useState(user.role);
  const [confirmingDisable, setConfirmingDisable] = useState(false);

  const [updateState, updateFormAction, updatePending] = useMutationFeedback(
    updateAction,
    {
      successMessage: tf("accessUpdated"),
      errorMessage: tf("accessFailed"),
    }
  );
  const [resendState, resendFormAction] = useMutationFeedback(resendAction, {
    successMessage: tf("inviteResent"),
    errorMessage: tf("inviteFailed"),
  });
  const [disableState, disableFormAction] = useMutationFeedback(disableAction, {
    successMessage: tf("accessDisabled"),
    errorMessage: tf("accessFailed"),
  });
  const [enableState, enableFormAction] = useMutationFeedback(disableAction, {
    successMessage: tf("accessEnabled"),
    errorMessage: tf("accessFailed"),
  });
  const disableError = disableState?.error ?? enableState?.error;

  const selectedRole = roles.find((item) => item.key === role) ?? null;
  const disabled = user.status === "disabled";

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={user.staffName ?? user.email}
      subtitle={user.staffName ? user.email : undefined}
      ariaLabel={labels.role}
      closeLabel={labels.close}
      size="lg"
      footer={
        user.isSelf ? undefined : (
          <div className="flex items-center justify-end">
            <FormSubmitButton
              form={FORM_ID}
              idleLabel={labels.save}
              pendingLabel={labels.saving}
              pending={updatePending}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            />
          </div>
        )
      }
    >
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground">
              {labels.linkedStaff}
            </p>
            <p className="mt-0.5 truncate text-sm text-foreground">
              {user.staffName ?? labels.noLinkedStaff}
            </p>
          </div>
          <StatusBadge
            tone={STATUS_TONES[user.status]}
            label={statusLabels[user.status]}
          />
        </div>

        {user.isSelf ? (
          <p className="text-sm text-muted-foreground">{labels.selfNote}</p>
        ) : (
          <>
            <form id={FORM_ID} action={updateFormAction} className="space-y-6">
              <input type="hidden" name="user_id" value={user.userId} />
              {seasonId && <input type="hidden" name="season_id" value={seasonId} />}

              <div>
                <label className="grid gap-2 text-xs font-medium text-muted-foreground">
                  {labels.role}
                  <select
                    name="role"
                    value={role}
                    onChange={(event) => setRole(event.target.value)}
                    className="field"
                  >
                    {roles.map((option) => (
                      <option key={option.key} value={option.key}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
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
                      defaultValue={user.teamIds}
                      labels={{
                        choose: labels.chooseTeams,
                        remove: labels.removeTeam,
                        empty: labels.teamsHint,
                      }}
                    />
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      {labels.noSeason}
                    </p>
                  )}
                </div>
              )}

              {updateState?.error && (
                <p role="alert" className="text-sm text-destructive">
                  {updateState.error}
                </p>
              )}
            </form>

            <div className="space-y-3 border-t border-border pt-5">
              {user.status === "invited" && (
                <form action={resendFormAction} className="space-y-2">
                  <input type="hidden" name="user_id" value={user.userId} />
                  {resendState?.error && (
                    <p role="alert" className="text-sm text-destructive">
                      {resendState.error}
                    </p>
                  )}
                  <FormSubmitButton
                    idleLabel={labels.resend}
                    pendingLabel={labels.resending}
                    className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
                  />
                </form>
              )}

              {disableError && (
                <p role="alert" className="text-sm text-destructive">
                  {disableError}
                </p>
              )}
              {confirmingDisable ? (
                <div className="space-y-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3">
                  <p className="text-sm font-medium text-foreground">
                    {labels.deactivateConfirmTitle}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {labels.deactivateConfirmBody}
                  </p>
                  <form
                    action={disableFormAction}
                    className="flex justify-end gap-2"
                  >
                    <input type="hidden" name="user_id" value={user.userId} />
                    <input type="hidden" name="disabled" value="on" />
                    <button
                      type="button"
                      onClick={() => setConfirmingDisable(false)}
                      className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted"
                    >
                      {labels.cancel}
                    </button>
                    <FormSubmitButton
                      idleLabel={labels.deactivateConfirm}
                      pendingLabel={labels.deactivating}
                      className="rounded-lg bg-destructive px-3 py-1.5 text-sm font-medium text-destructive-foreground hover:bg-destructive/90"
                    />
                  </form>
                </div>
              ) : disabled ? (
                <form action={enableFormAction}>
                  <input type="hidden" name="user_id" value={user.userId} />
                  <FormSubmitButton
                    idleLabel={labels.reactivate}
                    pendingLabel={labels.reactivating}
                    className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
                  />
                </form>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmingDisable(true)}
                  className="rounded-lg border border-destructive/50 px-4 py-2 text-sm font-medium text-destructive transition-colors hover:bg-destructive/5"
                >
                  {labels.deactivate}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </Drawer>
  );
}
