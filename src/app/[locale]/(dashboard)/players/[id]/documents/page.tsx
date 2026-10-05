import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { DocumentSection } from "@/components/documents/DocumentSection";
import { getOrganizationSettings, listDocuments } from "@/lib/club-data";
import { hasPermission, requireOrganization } from "@/lib/organization";
import { createServerClient } from "@/lib/supabase/server";

export default async function PlayerDocumentsPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const org = await requireOrganization();
  const supabase = await createServerClient();
  const t = await getTranslations("players.documents");
  const [canView, canManage] = await Promise.all([
    hasPermission("documents.view"),
    hasPermission("documents.manage"),
  ]);
  if (!canView) notFound();

  const [documents, settings] = await Promise.all([
    listDocuments(supabase, org.organizationId, "athlete", id),
    getOrganizationSettings(supabase, org.organizationId),
  ]);

  return (
    <DocumentSection
      documents={documents}
      ownerType="athlete"
      ownerId={id}
      thresholdDays={settings?.warning_threshold_days ?? 30}
      canManage={canManage}
      redirectPath={`/${locale}/players/${id}/documents`}
      privacyNote={t("privateNote")}
      emptyLabel={t("none")}
      addLabel={t("uploadCta")}
      addInHeader
    />
  );
}
