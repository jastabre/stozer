"use client";

import { useTranslations } from "next-intl";
import { FormSubmitButton } from "@/components/FormSubmitButton";
import { MutationForm } from "@/components/ui/MutationForm";
import { FilePicker } from "@/components/ui/FilePicker";

interface LogoUploaderProps {
  currentUrl: string | null;
  uploadAction: (formData: FormData) => Promise<void>;
  removeAction: (formData: FormData) => Promise<void>;
  uploadLabel: string;
  uploadingLabel: string;
  removeLabel: string;
  removingLabel: string;
  chooseLabel: string;
  changeLabel: string;
  hint: string;
}

/**
 * Club crest uploader. Uploads through the club-logos storage bucket (server
 * action, org-scoped RLS) and shows the saved crest. The native file input is
 * wrapped by the shared FilePicker, so no English "Choose File / No file
 * chosen" copy ever appears while the real <input type="file"> stays in the
 * form — the upload action and its FormData are unchanged.
 */
export function LogoUploader({
  currentUrl,
  uploadAction,
  removeAction,
  uploadLabel,
  uploadingLabel,
  removeLabel,
  removingLabel,
  chooseLabel,
  changeLabel,
  hint,
}: LogoUploaderProps) {
  const tf = useTranslations("feedback");

  return (
    <div className="flex flex-wrap items-center gap-4">
      <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-muted/50">
        {currentUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={currentUrl} alt="" className="h-full w-full object-contain" />
        ) : (
          <span className="px-2 text-center text-xs text-muted-foreground">
            {chooseLabel}
          </span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <MutationForm
          action={uploadAction}
          successMessage={tf("logoUploaded")}
          errorMessage={tf("uploadFailed")}
          className="flex flex-wrap items-end gap-3"
        >
          <div className="min-w-0 flex-1">
            <FilePicker
              name="logo"
              accept="image/png,image/jpeg,image/svg+xml"
              required
              labels={{ choose: chooseLabel, hint, change: changeLabel }}
            />
          </div>
          <FormSubmitButton
            idleLabel={uploadLabel}
            pendingLabel={uploadingLabel}
            className="h-9 shrink-0 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground"
          />
        </MutationForm>

        {currentUrl && (
          <MutationForm
            action={removeAction}
            successMessage={tf("logoRemoved")}
            errorMessage={tf("deleteFailed")}
            className="mt-3"
          >
            <FormSubmitButton
              idleLabel={removeLabel}
              pendingLabel={removingLabel}
              className="text-xs font-medium text-destructive hover:underline"
            />
          </MutationForm>
        )}
      </div>
    </div>
  );
}
