import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { hasPermission } from "@/lib/organization";
import { loadStaffShell } from "@/lib/staff-profile";
import { listDocuments } from "@/lib/club-data";
import { DocumentSection } from "@/components/documents/DocumentSection";

export default async function StaffDocumentsPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;

  const [canView, canManage] = await Promise.all([
    hasPermission("documents.view"),
    hasPermission("documents.manage"),
  ]);
  if (!canView) notFound();

  const { org, supabase, person, settings } = await loadStaffShell(id);
  if (!person) notFound();

  const t = await getTranslations("people");
  const documents = await listDocuments(supabase, org.organizationId, "staff", person.id);

  return (
    <DocumentSection
      documents={documents}
      ownerType="staff"
      ownerId={person.id}
      thresholdDays={settings?.warning_threshold_days ?? 30}
      canManage={canManage}
      redirectPath={`/${locale}/people/${person.id}/documents`}
      emptyLabel={t("documentsEmpty")}
      addInHeader
    />
  );
}
