import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { getTranslations } from "next-intl/server";
import { getAthleteWithMemberships, getOrganizationSettings, listContracts, listDocuments, documentTone } from "@/lib/club-data";
import { deriveStatus, type StatusTone } from "@/lib/status";
import { hasPermission, requireOrganization } from "@/lib/organization";
import { createServerClient } from "@/lib/supabase/server";
import { deleteContract, saveContract } from "./actions";

const toneClasses: Record<StatusTone, string> = {
  green: "bg-emerald-100 text-emerald-800",
  yellow: "bg-amber-100 text-amber-800",
  red: "bg-rose-100 text-rose-800",
};

const statuses = ["draft", "active", "terminated", "expired"] as const;

export default async function PlayerContractsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const org = await requireOrganization();
  const supabase = await createServerClient();
  const t = await getTranslations("players.contracts");
  const [canView, canManage, canViewDocuments] = await Promise.all([
    hasPermission("contracts.view"),
    hasPermission("contracts.manage"),
    hasPermission("documents.view"),
  ]);
  if (!canView) notFound();

  const [athlete, contracts, documents, settings] = await Promise.all([
    getAthleteWithMemberships(supabase, org.organizationId, id),
    listContracts(supabase, org.organizationId, id),
    canViewDocuments
      ? listDocuments(supabase, org.organizationId, "athlete", id)
      : Promise.resolve([]),
    getOrganizationSettings(supabase, org.organizationId),
  ]);
  if (!athlete) notFound();
  const contractDocuments = documents.filter((document) => document.doc_type === "contract");
  const threshold = settings?.warning_threshold_days ?? 30;
  const inputClass = "rounded-lg border px-3 py-2 text-sm";

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/players/${id}`} className="text-sm text-primary hover:underline">← {t("back")}</Link>
        <h1 className="mt-1 text-2xl font-bold">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{athlete.last_name} {athlete.first_name}</p>
      </div>

      {canManage && (
        <details className="rounded-xl border border-border p-4">
          <summary className="cursor-pointer text-sm font-medium">{t("add")}</summary>
          <ContractForm athleteId={id} action={saveContract} documents={contractDocuments} inputClass={inputClass} t={t} />
        </details>
      )}

      <section className="rounded-xl border border-border p-5">
        {contracts.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("empty")}</p>
        ) : (
          <div className="space-y-3">
            {contracts.map((contract) => {
              const tone = contract.valid_until
                ? documentTone(contract.valid_until, threshold)
                : null;
              return (
                <div key={contract.id} className="rounded-lg border border-border p-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{contract.contract_type}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {contract.valid_from ? format(new Date(`${contract.valid_from}T00:00:00`), "dd MMM yyyy") : "—"}
                        {" – "}
                        {contract.valid_until ? format(new Date(`${contract.valid_until}T00:00:00`), "dd MMM yyyy") : "—"}
                        {contract.notes ? ` · ${contract.notes}` : ""}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">{t(`statuses.${contract.status}`)}</span>
                      {tone && tone !== "none" && <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${toneClasses[tone]}`}>{t(`tones.${tone}`)}</span>}
                    </div>
                  </div>
                  {contract.document_id && <p className="mt-2 text-xs text-muted-foreground">{t("linked")}: {contractDocuments.find((document) => document.id === contract.document_id)?.filename ?? t("noDocument")}</p>}
                  {canManage && <div className="mt-3 flex flex-wrap gap-2">
                    <details className="relative">
                      <summary className="cursor-pointer rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-primary">{t("edit")}</summary>
                      <div className="absolute right-0 z-10 mt-2 w-80 rounded-lg border border-border bg-card p-3 shadow-lg">
                        <ContractForm athleteId={id} action={saveContract} contract={contract} documents={contractDocuments} inputClass={inputClass} t={t} />
                      </div>
                    </details>
                    <form action={deleteContract}><input type="hidden" name="id" value={contract.id} /><input type="hidden" name="athlete_id" value={id} /><button type="submit" className="rounded-lg border border-destructive px-2.5 py-1 text-xs text-destructive">{t("delete")}</button></form>
                  </div>}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function ContractForm({
  athleteId,
  action,
  contract,
  documents,
  inputClass,
  t,
}: {
  athleteId: string;
  action: (formData: FormData) => void;
  contract?: Awaited<ReturnType<typeof listContracts>>[number];
  documents: Awaited<ReturnType<typeof listDocuments>>;
  inputClass: string;
  t: (key: string, values?: Record<string, string | number>) => string;
}) {
  return (
    <form action={action} className="mt-4 grid gap-3 text-left">
      {contract && <input type="hidden" name="id" value={contract.id} />}
      <input type="hidden" name="athlete_id" value={athleteId} />
      <label className="grid gap-1 text-xs text-muted-foreground">{t("type")}<input name="contract_type" defaultValue={contract?.contract_type} placeholder={t("typePlaceholder")} required className={inputClass} /></label>
      <label className="grid gap-1 text-xs text-muted-foreground">{t("status")}<select name="status" defaultValue={contract?.status ?? "draft"} className={inputClass}>{statuses.map((status) => <option key={status} value={status}>{t(`statuses.${status}`)}</option>)}</select></label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-xs text-muted-foreground">{t("validFrom")}<input name="valid_from" type="date" defaultValue={contract?.valid_from ?? ""} className={inputClass} /></label>
        <label className="grid gap-1 text-xs text-muted-foreground">{t("validUntil")}<input name="valid_until" type="date" defaultValue={contract?.valid_until ?? ""} className={inputClass} /></label>
      </div>
      <label className="grid gap-1 text-xs text-muted-foreground">{t("document")}<select name="document_id" defaultValue={contract?.document_id ?? ""} className={inputClass}><option value="">{t("noDocument")}</option>{documents.map((document) => <option key={document.id} value={document.id}>{document.filename}</option>)}</select></label>
      <label className="grid gap-1 text-xs text-muted-foreground">{t("notes")}<textarea name="notes" defaultValue={contract?.notes ?? ""} rows={2} className={inputClass} /></label>
      <button type="submit" className="w-fit rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground">{t("save")}</button>
    </form>
  );
}
