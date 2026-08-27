import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { DocumentSection } from "@/components/documents/DocumentSection";
import { getOrganizationSettings, listDocuments, getAthleteWithMemberships } from "@/lib/club-data";
import { hasPermission, requireOrganization } from "@/lib/organization";
import { createServerClient } from "@/lib/supabase/server";

export default async function PlayerDocumentsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const org = await requireOrganization();
  const supabase = await createServerClient();
  const t = await getTranslations("players.documents");
  const [canView, canManage] = await Promise.all([
    hasPermission("documents.view"),
    hasPermission("documents.manage"),
  ]);
  if (!canView) notFound();

  const [athlete, documents, settings] = await Promise.all([
    getAthleteWithMemberships(supabase, org.organizationId, id),
    listDocuments(supabase, org.organizationId, "athlete", id),
    getOrganizationSettings(supabase, org.organizationId),
  ]);
  if (!athlete) notFound();

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/players/${id}`} className="text-sm text-primary hover:underline">← {t("back")}</Link>
        <h1 className="mt-1 text-2xl font-bold">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{athlete.last_name} {athlete.first_name}</p>
      </div>
      <DocumentSection
        documents={documents}
        ownerType="athlete"
        ownerId={id}
        thresholdDays={settings?.warning_threshold_days ?? 30}
        canManage={canManage}
        redirectPath={`/players/${id}/documents`}
      />
    </div>
  );
}
