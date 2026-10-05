"use client";

import { Camera, Trash2 } from "lucide-react";
import { MutationForm, useMutationPending } from "@/components/ui/MutationForm";
import { ConfirmDeleteButton } from "@/components/ConfirmDeleteButton";
import { AVATAR_MIME_ACCEPT } from "@/lib/storage";
import { cn } from "@/lib/utils";

export interface AthletePhotoLabels {
  add: string;
  change: string;
  remove: string;
  uploading: string;
  removing: string;
  uploaded: string;
  removed: string;
  uploadFailed: string;
  removeFailed: string;
  removeTitle: string;
  removeBody: string;
  removeConfirm: string;
  cancel: string;
  aria: string;
}

const AVATAR_BOX =
  "flex h-20 w-20 items-center justify-center overflow-hidden rounded-lg bg-primary/10 text-2xl font-bold text-primary";

/**
 * Player photo avatar for the profile header. Shows the photo (object-cover) or
 * the initials fallback in the same footprint. With edit rights the whole avatar
 * is the upload trigger (hover/focus overlay, keyboard focusable) and a small
 * badge removes the photo with confirmation. The upload runs through the
 * enclosing MutationForm, so the pending/spinner/no-double-submit feedback is
 * the shared Stožer behaviour.
 */
export function AthletePhoto({
  athleteId,
  photoUrl,
  initials,
  canEdit,
  uploadAction,
  removeAction,
  labels,
}: {
  athleteId: string;
  photoUrl: string | null;
  initials: string;
  canEdit: boolean;
  uploadAction: (formData: FormData) => Promise<unknown>;
  removeAction: (formData: FormData) => Promise<unknown>;
  labels: AthletePhotoLabels;
}) {
  const avatar = photoUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={photoUrl} alt={labels.aria} className="h-full w-full object-cover" />
  ) : (
    <span aria-hidden="true">{initials}</span>
  );

  if (!canEdit) {
    return (
      <span className={cn(AVATAR_BOX, "shrink-0")} data-testid="athlete-avatar">
        {avatar}
      </span>
    );
  }

  return (
    <div className="relative shrink-0" data-testid="athlete-avatar">
      <MutationForm
        action={uploadAction}
        successMessage={labels.uploaded}
        errorMessage={labels.uploadFailed}
        className="group relative block"
      >
        <input type="hidden" name="athlete_id" value={athleteId} />
        <label
          className="relative block cursor-pointer rounded-lg focus-within:ring-2 focus-within:ring-ring/40"
          aria-label={photoUrl ? labels.change : labels.add}
          title={photoUrl ? labels.change : labels.add}
        >
          <span className={AVATAR_BOX}>{avatar}</span>
          <PhotoOverlay />
          <input
            type="file"
            name="photo"
            accept={AVATAR_MIME_ACCEPT}
            required
            className="sr-only"
            onChange={(event) => event.currentTarget.form?.requestSubmit()}
          />
        </label>
      </MutationForm>

      {photoUrl && (
        <ConfirmDeleteButton
          action={removeAction}
          hiddenFields={{ athlete_id: athleteId }}
          triggerLabel={<Trash2 className="h-3.5 w-3.5" aria-hidden="true" />}
          triggerAriaLabel={labels.remove}
          triggerClassName="absolute -right-1.5 -top-1.5 z-10 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-sm transition-colors hover:border-destructive hover:text-destructive"
          title={labels.removeTitle}
          body={labels.removeBody}
          confirmLabel={labels.removeConfirm}
          cancelLabel={labels.cancel}
          pendingLabel={labels.removing}
          successMessage={labels.removed}
          errorMessage={labels.removeFailed}
        />
      )}
    </div>
  );
}

function PhotoOverlay() {
  const pending = useMutationPending();
  return (
    <span
      className={cn(
        "pointer-events-none absolute inset-0 flex items-center justify-center rounded-lg bg-foreground/55 text-background transition-opacity",
        pending
          ? "opacity-100"
          : "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"
      )}
    >
      {pending ? (
        <span
          aria-hidden="true"
          className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      ) : (
        <Camera className="h-5 w-5" aria-hidden="true" />
      )}
    </span>
  );
}
