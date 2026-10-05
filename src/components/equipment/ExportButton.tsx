"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useToast } from "@/components/ui/Toast";

/**
 * File-download button for the equipment XLSX export route. The file is
 * fetched as a blob so the UI can tell whether the server actually produced it:
 * a real pending state while the file is generated, then either a "Fajl je
 * spreman" success toast and a download, or an error toast — never a success
 * message for a failed generation.
 */
export function ExportButton({
  href,
  label,
  pendingLabel,
  className,
}: {
  href: string;
  label: string;
  pendingLabel: string;
  className?: string;
}) {
  const tf = useTranslations("feedback");
  const { success, error } = useToast();
  const [pending, setPending] = useState(false);

  async function handleExport() {
    if (pending) return;
    setPending(true);
    try {
      const response = await fetch(href);
      if (!response.ok) throw new Error(`Export failed (${response.status})`);

      const blob = await response.blob();
      const disposition = response.headers.get("Content-Disposition") ?? "";
      const filename =
        /filename="?([^";]+)"?/.exec(disposition)?.[1] ?? "izvoz.xlsx";

      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);

      success(tf("fileReady"));
    } catch {
      error(tf("exportFailed"));
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleExport}
      disabled={pending}
      className={`inline-flex items-center gap-2 disabled:cursor-wait disabled:opacity-60 ${
        className ?? ""
      }`}
    >
      {pending && (
        <span
          aria-hidden="true"
          className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      )}
      {pending ? pendingLabel : label}
    </button>
  );
}
