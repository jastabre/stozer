"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Pencil } from "lucide-react";
import { FormSubmitButton } from "@/components/FormSubmitButton";
import { MutationForm } from "@/components/ui/MutationForm";

interface StaffTeamsEditorProps {
  action?: (formData: FormData) => Promise<unknown>;
  staffId: string;
  seasonId: string;
  teams: { id: string; name: string }[];
  currentTeamIds: string[];
  canEdit: boolean;
  labels: {
    title: string;
    edit: string;
    save: string;
    saving: string;
    cancel: string;
    empty: string;
  };
}

/**
 * Season team assignment as a quiet profile section: compact tags in view
 * mode, a small "Izmeni" action, and toggle pills while editing (no large
 * checkbox cards). Without staff.manage it stays read-only.
 */
export function StaffTeamsEditor({
  action,
  staffId,
  seasonId,
  teams,
  currentTeamIds,
  canEdit,
  labels,
}: StaffTeamsEditorProps) {
  const tf = useTranslations("feedback");
  const [editing, setEditing] = useState(false);
  const assigned = teams.filter((team) => currentTeamIds.includes(team.id));

  return (
    <section>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          {labels.title}
        </h3>
        {canEdit && action && !editing && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="inline-flex h-7 items-center gap-1.5 rounded-md border border-primary/30 bg-primary/5 px-2 text-xs font-medium text-primary transition-colors hover:border-primary/60 hover:bg-primary/10 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring"
          >
            <Pencil className="h-3 w-3" aria-hidden="true" />
            {labels.edit}
          </button>
        )}
      </div>

      {editing && action ? (
        <MutationForm
          action={action}
          successMessage={tf("changesSaved")}
          errorMessage={tf("saveFailed")}
          className="mt-2.5 space-y-3"
        >
          <input type="hidden" name="staff_id" value={staffId} />
          <input type="hidden" name="season_id" value={seasonId} />
          <div className="flex flex-wrap gap-2">
            {teams.map((team) => (
              <label
                key={team.id}
                className="flex cursor-pointer items-center gap-2 rounded-full border border-border px-3 py-1.5 text-sm transition-colors hover:border-primary has-[:checked]:border-primary has-[:checked]:bg-primary/10 has-[:checked]:font-medium has-[:checked]:text-primary"
              >
                <input
                  type="checkbox"
                  name="team_id"
                  value={team.id}
                  defaultChecked={currentTeamIds.includes(team.id)}
                  className="h-3.5 w-3.5 accent-primary"
                />
                {team.name}
              </label>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <FormSubmitButton
              idleLabel={labels.save}
              pendingLabel={labels.saving}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            />
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
            >
              {labels.cancel}
            </button>
          </div>
        </MutationForm>
      ) : assigned.length === 0 ? (
        <p className="mt-2.5 text-sm text-muted-foreground">{labels.empty}</p>
      ) : (
        <ul className="mt-2.5 flex flex-wrap items-center gap-2">
          {assigned.map((team) => (
            <li
              key={team.id}
              className="rounded-md bg-muted px-3 py-1.5 text-sm font-medium text-foreground"
            >
              {team.name}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
