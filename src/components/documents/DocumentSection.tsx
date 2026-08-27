import { format } from "date-fns";
import { getTranslations } from "next-intl/server";
import type { ClubDocument } from "@/lib/club-data";
import { documentTone } from "@/lib/club-data";
import type { StatusTone } from "@/lib/status";
import { uploadDocument, deleteDocument } from "@/app/[locale]/(dashboard)/documents/actions";
import { DocumentDownloadButton } from "./DocumentDownloadButton";

const toneClasses: Record<StatusTone, string> = {
  green: "bg-emerald-100 text-emerald-800",
  yellow: "bg-amber-100 text-amber-800",
  red: "bg-rose-100 text-rose-800",
};

export async function DocumentSection({
  documents,
  ownerType,
  ownerId,
  thresholdDays,
  canManage,
  redirectPath,
}: {
  documents: ClubDocument[];
  ownerType: "athlete" | "staff";
  ownerId: string;
  thresholdDays: number;
  canManage: boolean;
  redirectPath: string;
}) {
  const t = await getTranslations("documents");
  return (
    <section className="rounded-xl border border-border p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{t("title")}</h2>
          <p className="mt-1 text-xs text-muted-foreground">{t("privateNote")}</p>
        </div>
      </div>

      {documents.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <div className="mt-4 space-y-3">
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
                  {tone && tone !== "none" && <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${toneClasses[tone]}`}>{t(`tones.${tone}`)}</span>}
                  <DocumentDownloadButton documentId={document.id} label={t("download")} loadingLabel={t("opening")} errorLabel={t("downloadError")} />
                  {canManage && (
                    <form action={deleteDocument}>
                      <input type="hidden" name="document_id" value={document.id} />
                      <input type="hidden" name="redirect_path" value={redirectPath} />
                      <button type="submit" className="rounded-lg border border-destructive px-2.5 py-1 text-xs text-destructive">{t("delete")}</button>
                    </form>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {canManage && (
        <details className="mt-4 rounded-lg bg-muted/40 p-3">
          <summary className="cursor-pointer text-sm font-medium">{t("add")}</summary>
          <form action={uploadDocument} encType="multipart/form-data" className="mt-4 grid gap-3 sm:grid-cols-2">
            <input type="hidden" name="owner_type" value={ownerType} />
            <input type="hidden" name="owner_id" value={ownerId} />
            <input type="hidden" name="redirect_path" value={redirectPath} />
            <label className="grid gap-1 text-xs text-muted-foreground sm:col-span-2">
              {t("file")}
              <input name="file" type="file" accept="application/pdf,image/jpeg,image/png" required className="rounded-lg border bg-background px-3 py-2 text-sm" />
            </label>
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
              <input name="issued_at" type="date" className="rounded-lg border bg-background px-3 py-2 text-sm text-foreground" />
            </label>
            <label className="grid gap-1 text-xs text-muted-foreground">
              {t("expiresAt")}
              <input name="expires_at" type="date" className="rounded-lg border bg-background px-3 py-2 text-sm text-foreground" />
            </label>
            <label className="grid gap-1 text-xs text-muted-foreground sm:col-span-2">
              {t("notes")}
              <textarea name="notes" rows={2} className="rounded-lg border bg-background px-3 py-2 text-sm" />
            </label>
            <button type="submit" className="w-fit rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">{t("upload")}</button>
          </form>
        </details>
      )}
    </section>
  );
}
