import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { hasPermission, requireOrganization } from "@/lib/organization";
import { createServerClient } from "@/lib/supabase/server";
import {
  CLUB_DOCUMENT_CATEGORIES,
  listClubDocuments,
  type ClubDocumentCategory,
} from "@/lib/club-documents";
import { buildClubTabs } from "@/lib/club-nav";
import { ProfileTabs } from "@/components/ui/ProfileTabs";
import { PageHeader } from "@/components/ui/PageHeader";
import { ClubDocumentsManager } from "@/components/club/ClubDocumentsManager";
import { ClubDocumentDrawer } from "@/components/club/ClubDocumentDrawer";
import {
  createClubDocument,
  deleteClubDocument,
  getClubDocumentDownloadUrl,
  updateClubDocument,
} from "./actions";

export default async function ClubDocumentsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const org = await requireOrganization();
  if (!(await hasPermission("documents.view"))) notFound();
  const canManage = await hasPermission("documents.manage");

  const supabase = await createServerClient();
  const t = await getTranslations("club");
  const tc = await getTranslations("common");
  const tf = await getTranslations("feedback");

  const [documents, tabs] = await Promise.all([
    listClubDocuments(supabase, org.organizationId),
    buildClubTabs(locale, {
      settings: t("tabs.settings"),
      users: t("tabs.users"),
      documents: t("tabs.documents"),
      facilities: t("tabs.facilities"),
    }),
  ]);

  const categoryLabels = Object.fromEntries(
    CLUB_DOCUMENT_CATEGORIES.map((category) => [
      category,
      t(`documents.categories.${category}`),
    ])
  ) as Record<ClubDocumentCategory, string>;

  const drawerLabels = {
    addTitle: t("documents.addTitle"),
    editTitle: t("documents.editTitle"),
    name: t("documents.name"),
    namePlaceholder: t("documents.namePlaceholder"),
    category: t("documents.category"),
    notes: t("documents.notes"),
    notesPlaceholder: t("documents.notesPlaceholder"),
    file: t("documents.file"),
    choose: t("documents.chooseFile"),
    hint: t("documents.fileHint"),
    change: t("documents.changeFile"),
    currentFile: t("documents.currentFile"),
    submitCreate: t("documents.add"),
    submittingCreate: t("documents.submitting"),
    submitEdit: t("documents.save"),
    submittingEdit: t("documents.saving"),
    close: tc("close"),
    cancel: tc("cancel"),
    categoryLabels,
  };

  const triggerClassName =
    "inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90";

  return (
    <div className="space-y-5">
      <ProfileTabs label={t("tabs.label")} items={tabs} />

      <PageHeader
        title={t("documents.title")}
        description={t("documents.description")}
      >
        {canManage && (
          <ClubDocumentDrawer
            mode="create"
            action={createClubDocument}
            triggerLabel={t("documents.add")}
            triggerClassName={triggerClassName}
            successMessage={tf("clubDocumentAdded")}
            errorMessage={tf("uploadFailed")}
            labels={drawerLabels}
          />
        )}
      </PageHeader>

      <p className="text-xs text-muted-foreground">{t("documents.privateNote")}</p>

      <ClubDocumentsManager
        documents={documents}
        canManage={canManage}
        updateAction={updateClubDocument}
        deleteAction={deleteClubDocument}
        downloadAction={getClubDocumentDownloadUrl}
        emptyAction={
          canManage ? (
            <ClubDocumentDrawer
              mode="create"
              action={createClubDocument}
              triggerLabel={t("documents.emptyAction")}
              triggerClassName={triggerClassName}
              successMessage={tf("clubDocumentAdded")}
              errorMessage={tf("uploadFailed")}
              labels={drawerLabels}
            />
          ) : undefined
        }
        labels={{
          columns: {
            name: t("documents.columns.name"),
            category: t("documents.columns.category"),
            fileType: t("documents.columns.fileType"),
            added: t("documents.columns.added"),
            actions: t("documents.columns.actions"),
          },
          categories: categoryLabels,
          download: t("documents.download"),
          opening: t("documents.opening"),
          downloadError: t("documents.downloadError"),
          edit: t("documents.edit"),
          delete: t("documents.delete"),
          deleteTitle: t("documents.deleteConfirmTitle"),
          deleteBody: t("documents.deleteConfirmBody"),
          deleteConfirm: t("documents.deleteConfirm"),
          deleting: t("documents.deleting"),
          emptyTitle: t("documents.emptyTitle"),
          emptyDescription: t("documents.emptyDescription"),
          drawer: {
            editTitle: t("documents.editTitle"),
            name: t("documents.name"),
            namePlaceholder: t("documents.namePlaceholder"),
            category: t("documents.category"),
            notes: t("documents.notes"),
            notesPlaceholder: t("documents.notesPlaceholder"),
            currentFile: t("documents.currentFile"),
            submitEdit: t("documents.save"),
            submittingEdit: t("documents.saving"),
            close: tc("close"),
            cancel: tc("cancel"),
          },
        }}
      />
    </div>
  );
}
