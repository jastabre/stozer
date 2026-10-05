"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { FormSubmitButton } from "@/components/FormSubmitButton";
import { isNavigationError } from "@/components/ui/MutationForm";
import { useToast } from "@/components/ui/Toast";

type ActionState = { error?: string; ok?: boolean } | null;

/**
 * Adds an EXISTING club player to this team for the active season. The dialog
 * is never permanently open; on success it closes and the roster re-renders.
 * Errors (duplicate jersey, already in the season) are shown in place.
 */
export function AddTeamPlayer({
  teamId,
  athletes,
  totalPlayers,
  playersHref,
  action,
  labels,
}: {
  teamId: string;
  athletes: { id: string; name: string }[];
  /** Total athletes in the organization (drives which empty state to show). */
  totalPlayers: number;
  /** Locale-aware link to the club players list. */
  playersHref: string;
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  labels: {
    addToTeam: string;
    addTitle: string;
    player: string;
    choosePlayer: string;
    jerseyNumber: string;
    add: string;
    adding: string;
    cancel: string;
    noPlayersInClub: string;
    noPlayersInClubHint: string;
    goToPlayers: string;
    noEligiblePlayers: string;
    noEligiblePlayersHint: string;
  };
}) {
  const tf = useTranslations("feedback");
  const { success, error: showError } = useToast();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasEligible = athletes.length > 0;
  const clubHasPlayers = totalPlayers > 0;

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setPending(true);
    setError(null);
    try {
      const result = await action(null, new FormData(form));
      if (result?.error) {
        setError(result.error);
        showError(tf("addFailed"));
        return;
      }
      success(tf("memberAdded"));
      form.reset();
      setOpen(false);
    } catch (caught) {
      if (isNavigationError(caught)) {
        success(tf("memberAdded"));
        form.reset();
        setOpen(false);
        return;
      }
      setError("Greška pri dodavanju igrača. Pokušajte ponovo.");
      showError(tf("addFailed"));
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <Plus className="h-4 w-4" aria-hidden="true" />
        {labels.addToTeam}
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title={labels.addTitle}>
        {hasEligible ? (
          <form onSubmit={onSubmit} className="space-y-3">
            <input type="hidden" name="team_id" value={teamId} />
            <label className="grid gap-1 text-xs text-muted-foreground">
              {labels.player}
              <select
                name="athlete_id"
                required
                defaultValue=""
                className="field"
              >
                <option value="" disabled>
                  {labels.choosePlayer}
                </option>
                {athletes.map((athlete) => (
                  <option key={athlete.id} value={athlete.id}>
                    {athlete.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-xs text-muted-foreground">
              {labels.jerseyNumber}
              <input
                name="jersey_number"
                type="number"
                min={1}
                max={99}
                inputMode="numeric"
                className="field"
              />
            </label>

            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
              >
                {labels.cancel}
              </button>
              <FormSubmitButton
                idleLabel={labels.add}
                pendingLabel={labels.adding}
                pending={pending}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
              />
            </div>
          </form>
        ) : clubHasPlayers ? (
          <div className="space-y-4">
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">
                {labels.noEligiblePlayers}
              </p>
              <p className="text-sm text-muted-foreground">
                {labels.noEligiblePlayersHint}
              </p>
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
              >
                {labels.cancel}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">
                {labels.noPlayersInClub}
              </p>
              <p className="text-sm text-muted-foreground">
                {labels.noPlayersInClubHint}
              </p>
            </div>
            <div className="flex items-center justify-between gap-2">
              <Link
                href={playersHref}
                className="text-sm font-medium text-primary transition-colors hover:underline"
              >
                {labels.goToPlayers}
              </Link>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
              >
                {labels.cancel}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
