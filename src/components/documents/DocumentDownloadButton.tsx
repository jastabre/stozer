"use client";

import { useState, useTransition } from "react";
import { getDocumentDownloadUrl } from "@/app/[locale]/(dashboard)/documents/actions";

export function DocumentDownloadButton({
  documentId,
  label,
  loadingLabel,
  errorLabel,
}: {
  documentId: string;
  label: string;
  loadingLabel: string;
  errorLabel: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState(false);

  function handleDownload() {
    setError(false);
    const popup = window.open("about:blank", "_blank");
    startTransition(async () => {
      try {
        const result = await getDocumentDownloadUrl(documentId);
        if (popup) {
          popup.opener = null;
          popup.location.href = result.url;
        } else {
          window.open(result.url, "_blank", "noopener,noreferrer");
        }
      } catch {
        popup?.close();
        setError(true);
      }
    });
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={handleDownload}
        disabled={isPending}
        className="rounded-lg border border-border px-2.5 py-1 text-xs font-medium hover:border-primary hover:text-primary disabled:opacity-60"
      >
        {isPending ? loadingLabel : label}
      </button>
      {error && <span className="text-xs text-destructive">{errorLabel}</span>}
    </span>
  );
}
