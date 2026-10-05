"use client";

import { useState } from "react";
import { StatusBadge, type StatusTone } from "@/components/ui/StatusBadge";
import { UserDrawer } from "@/components/club/UserDrawer";
import type { AccountStatus } from "@/lib/account-status";
import type { OrgUser } from "@/lib/club-users";
import type { RoleMetadataView } from "@/lib/staff-profile";
import type { ClubAccountStateShape } from "./AddUserDrawer";

const STATUS_TONES: Record<AccountStatus, StatusTone> = {
  none: "muted",
  invited: "blue",
  active: "green",
  disabled: "red",
};

interface UsersTableProps {
  users: OrgUser[];
  teams: { id: string; name: string }[];
  seasonId: string | null;
  roles: RoleMetadataView[];
  /** User pre-selected by a deep link, e.g. /club/users?user=<userId>. */
  initialSelectedUserId?: string | null;
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
  /** Localized names for every possible role value (incl. reserved ones). */
  roleLabels: Record<string, string>;
  labels: {
    columns: { user: string; role: string; scope: string; status: string };
    clubScope: string;
    noScope: string;
    drawer: Parameters<typeof UserDrawer>[0]["labels"];
  };
}

/** Users & access list: compact desktop table, cards on phones, row → drawer. */
export function UsersTable({
  users,
  teams,
  seasonId,
  roles,
  initialSelectedUserId,
  updateAction,
  resendAction,
  disableAction,
  statusLabels,
  roleLabels,
  labels,
}: UsersTableProps) {
  const [selectedId, setSelectedId] = useState<string | null>(
    initialSelectedUserId ?? null
  );
  const selected = users.find((user) => user.userId === selectedId) ?? null;

  const scopeLabel = (user: OrgUser) => {
    const role = roles.find((item) => item.key === user.role);
    if (!role?.teamScoped) return labels.clubScope;
    return user.teamNames.length > 0 ? user.teamNames.join(", ") : labels.noScope;
  };

  const staffName = (user: OrgUser) => user.staffName?.trim() ?? "";
  const displayName = (user: OrgUser) => staffName(user) || user.email;

  return (
    <>
      <div className="hidden overflow-hidden rounded-xl border border-border bg-card md:block">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 font-medium">{labels.columns.user}</th>
              <th className="px-4 py-2.5 font-medium">{labels.columns.role}</th>
              <th className="px-4 py-2.5 font-medium">{labels.columns.scope}</th>
              <th className="px-4 py-2.5 font-medium">{labels.columns.status}</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => {
              const role = roles.find((item) => item.key === user.role);
              return (
                <tr
                  key={user.userId}
                  onClick={() => setSelectedId(user.userId)}
                  className="cursor-pointer border-t border-border transition-colors hover:bg-muted/40"
                >
                  <td className="px-4 py-2.5">
                    <div className="min-w-0">
                      <p
                        className="max-w-[240px] truncate font-medium text-foreground"
                        title={displayName(user)}
                      >
                        {displayName(user)}
                      </p>
                      {staffName(user) && (
                        <p
                          className="max-w-[240px] truncate text-xs text-muted-foreground"
                          title={user.email}
                        >
                          {user.email}
                        </p>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {role?.label ?? roleLabels[user.role] ?? "—"}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {scopeLabel(user)}
                  </td>
                  <td className="px-4 py-2.5">
                    <StatusBadge
                      tone={STATUS_TONES[user.status]}
                      label={statusLabels[user.status]}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ul className="space-y-2 md:hidden">
        {users.map((user) => {
          const role = roles.find((item) => item.key === user.role);
          return (
            <li key={user.userId}>
              <button
                type="button"
                onClick={() => setSelectedId(user.userId)}
                className="w-full rounded-xl border border-border bg-card p-3.5 text-left transition-colors hover:bg-muted/40"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-foreground">
                      {displayName(user)}
                    </p>
                    {staffName(user) && (
                      <p className="truncate text-xs text-muted-foreground">
                        {user.email}
                      </p>
                    )}
                  </div>
                  <StatusBadge
                    tone={STATUS_TONES[user.status]}
                    label={statusLabels[user.status]}
                  />
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">
                    {role?.label ?? roleLabels[user.role] ?? "—"}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>{scopeLabel(user)}</span>
                </div>
              </button>
            </li>
          );
        })}
      </ul>

      <UserDrawer
        open={selected != null}
        onClose={() => setSelectedId(null)}
        user={selected}
        teams={teams}
        seasonId={seasonId}
        roles={roles}
        updateAction={updateAction}
        resendAction={resendAction}
        disableAction={disableAction}
        statusLabels={statusLabels}
        labels={labels.drawer}
      />
    </>
  );
}
