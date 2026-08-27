import { notFound } from "next/navigation";
import { format } from "date-fns";
import { getTranslations } from "next-intl/server";
import { DocumentDownloadButton } from "@/components/documents/DocumentDownloadButton";
import { deleteDocument } from "./actions";
import { documentTone, listDocumentOverview } from "@/lib/club-data";
import { hasPermission, requireOrganization } from "@/lib/organization";
import { createServerClient } from "@/lib/supabase/server";
import type { DocumentTone } from "@/lib/club-data";

const documentTypes = ["registration", "contract", "medical", "insurance", "identity", "federation", "custom"] as const;
const tones = ["yellow", "red", "none"] as const;
const toneClasses: Record<Exclude<DocumentTone, "none">, string> = {
  green: "bg-emerald-100 text-emerald-800",
  yellow: "bg-amber-100 text-amber-800",
  red: "bg-rose-100 text-rose-800",
};

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; tone?: string }>;
}) {
  const params = await searchParams;
  const org = await requireOrganization();
  const supabase = await createServerClient();
  const t = await getTranslations("documents");
  const [canView, canManage] = await Promise.all([
    hasPermission("documents.view"),
    hasPermission("documents.manage"),
  ]);
  if (!canView) notFound();

  const [settings, overview] = await Promise.all([
    import("@/lib/club-data").then(({ getOrganizationSettings }) => getOrganizationSettings(supabase, org.organizationId)),
    listDocumentOverview(supabase, org.organizationId, 30),
  ]);
  const threshold = settings?.warning_threshold_days ?? 30;
  const typeFilter = documentTypes.includes(params.type as (typeof documentTypes)[number]) ? params.type : "all";
  const toneFilter = tones.includes(params.tone as (typeof tones)[number]) ? params.tone : "all";
  const attentionDocuments = overview
    .map((document) => ({ ...document, tone: documentTone(document.expires_at, threshold) }))
    .filter((document) => document.tone !== "green")
    .filter((document) => typeFilter === "all" || document.doc_type === typeFilter)
    .filter((document) => toneFilter === "all" || document.tone === toneFilter);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-primary">{t("eyebrow")}</p>
        <h1 className="mt-1 text-2xl font-bold">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("description")}</p>
      </div>
      <form method="get" className="flex flex-wrap items-end gap-3 rounded-xl border border-border p-4">
        <label className="grid gap-1 text-xs text-muted-foreground">{t("filterType")}<select name="type" defaultValue={typeFilter} className="rounded-lg border px-3 py-2 text-sm text-foreground"><option value="all">{t("all")}</option>{documentTypes.map((type) => <option key={type} value={type}>{t(`types.${type}`)}</option>)}</select></label>
        <label className="grid gap-1 text-xs text-muted-foreground">{t("filterTone")}<select name="tone" defaultValue={toneFilter} className="rounded-lg border px-3 py-2 text-sm text-foreground"><option value="all">{t("all")}</option>{tones.map((tone) => <option key={tone} value={tone}>{t(`tones.${tone}`)}</option>)}</select></label>
        <button type="submit" className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">{t("apply")}</button>
      </form>

      <section className="overflow-hidden rounded-xl border border-border">
        {attentionDocuments.length === 0 ? <p className="p-5 text-sm text-muted-foreground">{t("empty")}</p> : <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-b border-border bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="px-4 py-3">{t("owner")}</th><th className="px-4 py-3">{t("type")}</th><th className="px-4 py-3">{t("file")}</th><th className="px-4 py-3">{t("expiry")}</th><th className="px-4 py-3">{t("actions")}</th></tr></thead><tbody className="divide-y divide-border">{attentionDocuments.map((document) => <tr key={document.id}><td className="px-4 py-3"><span className="font-medium">{document.owner_name}</span><span className="block text-xs text-muted-foreground">{document.owner_type === "athlete" ? t("athlete") : t("staff")}</span></td><td className="px-4 py-3">{t(`types.${document.doc_type}`)}{document.custom_type ? <span className="block text-xs text-muted-foreground">{document.custom_type}</span> : null}</td><td className="max-w-64 truncate px-4 py-3">{document.filename}</td><td className="px-4 py-3">{document.expires_at ? <><span className={`rounded-full px-2.5 py-1 text-xs font-medium ${toneClasses[document.tone as Exclude<DocumentTone, "none">]}`}>{t(`tones.${document.tone}`)}</span><span className="mt-1 block text-xs text-muted-foreground">{format(new Date(`${document.expires_at}T00:00:00`), "dd MMM yyyy")}</span></> : <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">{t("noExpiry")}</span>}</td><td className="px-4 py-3"><div className="flex flex-wrap gap-2"><DocumentDownloadButton documentId={document.id} label={t("download")} loadingLabel={t("opening")} errorLabel={t("downloadError")} />{canManage && <form action={deleteDocument}><input type="hidden" name="document_id" value={document.id} /><input type="hidden" name="redirect_path" value="/documents" /><button type="submit" className="rounded-lg border border-destructive px-2.5 py-1 text-xs text-destructive">{t("delete")}</button></form>}</div></td></tr>)}</tbody></table></div>}
      </section>
    </div>
  );
}
