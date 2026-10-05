import { format } from "date-fns";
import { getTranslations } from "next-intl/server";
import type { ClubDocument } from "@/lib/club-data";
import { documentTone } from "@/lib/club-data";
import { uploadDocument, deleteDocument } from "@/app/[locale]/(dashboard)/documents/actions";
import { DocumentDownloadButton } from "./DocumentDownloadButton";
import { FormSubmitButton } from "@/components/FormSubmitButton";
import { ConfirmDeleteButton } from "@/components/ConfirmDeleteButton";
import { MutationForm } from "@/components/ui/MutationForm";
import { FilePicker } from "@/components/ui/FilePicker";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { DateField } from "@/components/ui/DateField";
import { formatDmy } from "@/lib/date-format";

/**
 * Shared documents panel. Two layouts:
 *  - Default (staff profile documents): unchanged — bordered header, compact
 *    action row per document, and the muted "add" block under the list.
 *  - `addInHeader` (player Documents tab): friendlier polish — title + upload
 *    CTA share the header (no wide full-row action), a non-technical privacy
 *    caption, a numeric DD.MM.GGGG. date format, a divided compact list and a
 *    precise "Još nema dokumenata." empty state.
 *
 * Both layouts share the upload form, download action, and confirmation-free
 * delete button; type labels come from the `documents` i18n namespace so no raw
 * enum values surface. Documents stay pure attachments — they never feed the
 * registration / medical / contract statuses.
 */
export async function DocumentSection({
  documents,
  ownerType,
  ownerId,
  thresholdDays,
  canManage,
  redirectPath,
  privacyNote,
  emptyLabel,
  addLabel,
  addInHeader = false,
}: {
  documents: ClubDocument[];
  ownerType: "athlete" | "staff";
  ownerId: string;
  thresholdDays: number;
  canManage: boolean;
  redirectPath: string;
  privacyNote?: string;
  emptyLabel?: string;
  addLabel?: string;
  addInHeader?: boolean;
}) {
  const t = await getTranslations("documents");
  const tf = await getTranslations("feedback");
  const privacy = privacyNote ?? t("privateNote");
  const empty = emptyLabel ?? t("empty");
  const addText = addLabel ?? t("add");

  const uploadForm = (
    <MutationForm
      action={uploadDocument}
      successMessage={tf("documentUploaded")}
      errorMessage={tf("uploadFailed")}
      className="mt-4 grid gap-3 sm:grid-cols-2"
    >
      <input type="hidden" name="owner_type" value={ownerType} />
      <input type="hidden" name="owner_id" value={ownerId} />
      <input type="hidden" name="redirect_path" value={redirectPath} />
      <div className="grid gap-1 text-xs text-muted-foreground sm:col-span-2">
        {t("file")}
        <FilePicker
          name="file"
          accept="application/pdf,image/jpeg,image/png"
          required
          labels={{ choose: t("chooseFile"), hint: t("fileHint"), change: t("change") }}
        />
      </div>
      <label className="grid gap-1 text-xs text-muted-foreground">
        {t("type")}
        <select name="doc_type" defaultValue="registration" className="rounded-lg border bg-background px-3 py-2 text-sm text-foreground">
          {(["registration", "contract", "medical", "insurance", "identity", "federation", "custom"] as const).map((type) => <option key={type} value={type}>{t(`types.${type}`)}</option>)}
        </select>
      </label>
      <label className="grid gap-1 text-xs text-muted-foreground">
        {t("customType")}
        <input name="custom_type" placeholder={t("customTypePlaceholder")} className="rounded-lg border bg-background px-3 py-2 text-sm" />
      </label>
      <label className="grid gap-1 text-xs text-muted-foreground">
        {t("issuedAt")}
        <DateField name="issued_at" ariaLabel={t("issuedAt")} />
      </label>
      <label className="grid gap-1 text-xs text-muted-foreground">
        {t("expiresAt")}
        <DateField name="expires_at" ariaLabel={t("expiresAt")} />
      </label>
      <label className="grid gap-1 text-xs text-muted-foreground sm:col-span-2">
        {t("notes")}
        <textarea name="notes" rows={2} className="rounded-lg border bg-background px-3 py-2 text-sm" />
      </label>
      <FormSubmitButton idleLabel={t("upload")} pendingLabel={t("submitting")} className="w-fit rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground" />
    </MutationForm>
  );

  // Compact list (player tab): divide-y rows, no per-document box, numeric dates.
  function listRow(document: ClubDocument) {
    const tone = document.expires_at
      ? documentTone(document.expires_at, thresholdDays)
      : null;
    return (
      <li key={document.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-2.5">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">{document.filename}</p>
          <p className="text-xs text-muted-foreground">
            {t(`types.${document.doc_type}`)}
            {document.custom_type ? ` · ${document.custom_type}` : ""}
            {document.issued_at ? ` · ${t("issued", { date: formatDmy(document.issued_at) })}` : ""}
            {document.expires_at ? ` · ${t("expires", { date: formatDmy(document.expires_at) })}` : ` · ${t("noExpiry")}`}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {tone && tone !== "none" && tone !== "green" && (
            <StatusBadge tone={tone === "yellow" ? "yellow" : "red"} label={t(`tones.${tone}`)} />
          )}
          <DocumentDownloadButton documentId={document.id} label={t("download")} loadingLabel={t("opening")} errorLabel={t("downloadError")} />
          {canManage && (
            <ConfirmDeleteButton
              action={deleteDocument}
              hiddenFields={{ document_id: document.id, redirect_path: redirectPath }}
              triggerLabel={t("delete")}
              triggerClassName="rounded text-xs font-medium text-destructive hover:underline"
              successMessage={tf("documentDeleted")}
              errorMessage={tf("deleteFailed")}
              title={t("deleteConfirmTitle")}
              body={t("deleteConfirmBody")}
              confirmLabel={t("deleteConfirm")}
              cancelLabel={t("cancel")}
              pendingLabel={t("deleting")}
            />
          )}
        </div>
      </li>
    );
  }

  if (addInHeader) {
    return (
      <section className="rounded-xl border border-border bg-card">
        {canManage ? (
          <details className="group">
            <summary className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-border px-4 py-2.5 [&::-webkit-details-marker]:hidden sm:px-5">
              <div className="min-w-0">
                <h2 className="text-lg font-semibold text-foreground">{t("title")}</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">{privacy}</p>
              </div>
              <span className="inline-flex h-9 shrink-0 items-center rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground">
                {addText}
              </span>
            </summary>
            <div className="border-b border-border px-4 py-4 sm:px-5">{uploadForm}</div>
          </details>
        ) : (
          <header className="border-b border-border px-4 py-3 sm:px-5">
            <h2 className="text-lg font-semibold text-foreground">{t("title")}</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">{privacy}</p>
          </header>
        )}
        <div className="px-4 sm:px-5">
          {documents.length === 0 ? (
            <p className="py-3 text-sm text-muted-foreground">{empty}</p>
          ) : (
            <ul className="divide-y divide-border">{documents.map(listRow)}</ul>
          )}
        </div>
      </section>
    );
  }

  // Default (staff): unchanged look & dates.
  return (
    <section className="rounded-xl border border-border bg-card">
      <header className="border-b border-border px-4 py-2.5 sm:px-5">
        <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          {t("title")}
        </h2>
        <p className="mt-0.5 text-xs text-muted-foreground">{privacy}</p>
      </header>
      <div className="px-4 py-4 sm:px-5">
        {documents.length === 0 ? (
          <p className="text-sm text-muted-foreground">{empty}</p>
        ) : (
          <div className="space-y-3">
            {documents.map((document) => {
              const tone = document.expires_at
                ? documentTone(document.expires_at, thresholdDays)
                : null;
              return (
                <div key={document.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{document.filename}</p>
                    <p className="text-xs text-muted-foreground">
                      {t(`types.${document.doc_type}`)}
                      {document.custom_type ? ` · ${document.custom_type}` : ""}
                      {document.issued_at ? ` · ${t("issued", { date: format(new Date(`${document.issued_at}T00:00:00`), "dd MMM yyyy") })}` : ""}
                      {document.expires_at ? ` · ${t("expires", { date: format(new Date(`${document.expires_at}T00:00:00`), "dd MMM yyyy") })}` : ` · ${t("noExpiry")}`}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {tone && tone !== "none" && (
                      <StatusBadge
                        tone={tone === "green" ? "green" : tone === "yellow" ? "yellow" : tone === "red" ? "red" : "neutral"}
                        label={t(`tones.${tone}`)}
                      />
                    )}
                    <DocumentDownloadButton documentId={document.id} label={t("download")} loadingLabel={t("opening")} errorLabel={t("downloadError")} />
                    {canManage && (
                      <ConfirmDeleteButton
                        action={deleteDocument}
                        hiddenFields={{ document_id: document.id, redirect_path: redirectPath }}
                        triggerLabel={t("delete")}
                        triggerClassName="rounded-lg border border-destructive px-2.5 py-1 text-xs text-destructive"
                        successMessage={tf("documentDeleted")}
                        errorMessage={tf("deleteFailed")}
                        title={t("deleteConfirmTitle")}
                        body={t("deleteConfirmBody")}
                        confirmLabel={t("deleteConfirm")}
                        cancelLabel={t("cancel")}
                        pendingLabel={t("deleting")}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {canManage && (
          <details className="mt-4 rounded-lg bg-muted/40 p-3">
            <summary className="cursor-pointer text-sm font-medium">{addText}</summary>
            {uploadForm}
          </details>
        )}
      </div>
    </section>
  );
}
