"use client";

import { format } from "date-fns";
import { useTranslations } from "next-intl";
import { ConfirmDeleteButton } from "@/components/ConfirmDeleteButton";
import { DocumentDownloadButton } from "@/components/documents/DocumentDownloadButton";
import { EmptyState } from "@/components/layout/EmptyState";
import { ClubDocumentDrawer } from "@/components/club/ClubDocumentDrawer";
import {
  clubDocumentFileType,
  type ClubDocumentCategory,
  type ClubDocumentEntry,
} from "@/lib/club-documents";

export interface ClubDocumentsManagerLabels {
  columns: {
    name: string;
    category: string;
    fileType: string;
    added: string;
    actions: string;
  };
  categories: Record<ClubDocumentCategory, string>;
  download: string;
  opening: string;
  downloadError: string;
  edit: string;
  delete: string;
  deleteTitle: string;
  deleteBody: string;
  deleteConfirm: string;
  deleting: string;
  emptyTitle: string;
  emptyDescription: string;
  drawer: {
    editTitle: string;
    name: string;
    namePlaceholder: string;
    category: string;
    notes: string;
    notesPlaceholder: string;
    currentFile: string;
    submitEdit: string;
    submittingEdit: string;
    close: string;
    cancel: string;
  };
}

interface ClubDocumentsManagerProps {
  documents: ClubDocumentEntry[];
  canManage: boolean;
  updateAction: (formData: FormData) => Promise<unknown>;
  deleteAction: (formData: FormData) => Promise<unknown>;
  downloadAction: (documentId: string) => Promise<{ url: string }>;
  /** Create-drawer trigger rendered inside the empty state. */
  emptyAction?: React.ReactNode;
  labels: ClubDocumentsManagerLabels;
}

/**
 * Compact club library table. No cards per document — a table scales better
 * and keeps the section utility-like. Rows are read-only except for the
 * download / edit / delete actions.
 */
export function ClubDocumentsManager({
  documents,
  canManage,
  updateAction,
  deleteAction,
  downloadAction,
  emptyAction,
  labels,
}: ClubDocumentsManagerProps) {
  const tf = useTranslations("feedback");

  if (documents.length === 0) {
    return (
      <EmptyState
        title={labels.emptyTitle}
        description={labels.emptyDescription}
        action={canManage ? emptyAction : undefined}
      />
    );
  }

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 font-medium">{labels.columns.name}</th>
              <th className="px-4 py-2.5 font-medium">{labels.columns.category}</th>
              <th className="px-4 py-2.5 font-medium">{labels.columns.fileType}</th>
              <th className="px-4 py-2.5 font-medium">{labels.columns.added}</th>
              <th className="px-4 py-2.5 font-medium">{labels.columns.actions}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {documents.map((document) => (
              <tr key={document.id} className="transition-colors hover:bg-muted/40">
                <td className="px-4 py-2.5">
                  <span className="font-medium text-foreground">{document.name}</span>
                  {document.notes ? (
                    <span className="block max-w-72 truncate text-xs text-muted-foreground">
                      {document.notes}
                    </span>
                  ) : null}
                </td>
                <td className="px-4 py-2.5 text-muted-foreground">
                  {labels.categories[document.category]}
                </td>
                <td className="px-4 py-2.5 tabular-nums text-muted-foreground">
                  {clubDocumentFileType(document.filename)}
                </td>
                <td className="px-4 py-2.5 tabular-nums text-muted-foreground">
                  {format(new Date(document.created_at), "dd.MM.yyyy")}
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex flex-wrap items-center gap-3">
                    <DocumentDownloadButton
                      documentId={document.id}
                      action={downloadAction}
                      label={labels.download}
                      loadingLabel={labels.opening}
                      errorLabel={labels.downloadError}
                    />
                    {canManage && (
                      <>
                        <ClubDocumentDrawer
                          mode="edit"
                          document={document}
                          action={updateAction}
                          triggerLabel={labels.edit}
                          triggerClassName="rounded text-xs font-medium text-primary hover:underline"
                          successMessage={tf("clubDocumentUpdated")}
                          errorMessage={tf("saveFailed")}
                          labels={{
                            addTitle: labels.drawer.editTitle,
                            editTitle: labels.drawer.editTitle,
                            name: labels.drawer.name,
                            namePlaceholder: labels.drawer.namePlaceholder,
                            category: labels.drawer.category,
                            notes: labels.drawer.notes,
                            notesPlaceholder: labels.drawer.notesPlaceholder,
                            file: "",
                            choose: "",
                            hint: "",
                            change: "",
                            currentFile: labels.drawer.currentFile,
                            submitCreate: labels.drawer.submitEdit,
                            submittingCreate: labels.drawer.submittingEdit,
                            submitEdit: labels.drawer.submitEdit,
                            submittingEdit: labels.drawer.submittingEdit,
                            close: labels.drawer.close,
                            cancel: labels.drawer.cancel,
                            categoryLabels: labels.categories,
                          }}
                        />
                        <ConfirmDeleteButton
                          action={deleteAction}
                          hiddenFields={{ document_id: document.id }}
                          triggerLabel={labels.delete}
                          triggerClassName="rounded text-xs font-medium text-destructive hover:underline"
                          successMessage={tf("clubDocumentDeleted")}
                          errorMessage={tf("deleteFailed")}
                          title={labels.deleteTitle}
                          body={labels.deleteBody}
                          confirmLabel={labels.deleteConfirm}
                          cancelLabel={labels.drawer.cancel}
                          pendingLabel={labels.deleting}
                        />
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
