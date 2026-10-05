"use client";

import { useRef, useState } from "react";
import { FileText, Upload } from "lucide-react";
import { cn } from "@/lib/utils";

export interface FilePickerLabels {
  /** Idle prompt, e.g. "Izaberi fajl". */
  choose: string;
  /** Hint line, e.g. "PDF, JPG ili PNG • do 10 MB". */
  hint: string;
  /** Action shown once a file is chosen, e.g. "Promeni". */
  change: string;
}

/** Human-readable size for the selected-file line. */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb < 10 ? kb.toFixed(1) : Math.round(kb)} KB`;
  const mb = kb / 1024;
  return `${mb < 10 ? mb.toFixed(1) : Math.round(mb)} MB`;
}

/**
 * Compact, localized file picker. The real `<input type="file">` stays in the
 * DOM inside the enclosing form (so FormData still carries the file) but is
 * visually hidden — the visible UI is a single clickable, keyboard-focusable
 * surface that shows the chosen filename and size. No native
 * "Choose File / No file chosen" copy is ever shown.
 */
export function FilePicker({
  name,
  accept,
  required,
  labels,
}: {
  name: string;
  accept: string;
  required?: boolean;
  labels: FilePickerLabels;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<{ name: string; size: number } | null>(null);

  return (
    <label
      className={cn(
        "flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-border bg-background px-3 py-2.5 text-sm",
        "transition-colors hover:border-primary focus-within:border-primary focus-within:ring-2 focus-within:ring-ring/40"
      )}
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
        {file ? <FileText className="h-4 w-4" /> : <Upload className="h-4 w-4" />}
      </span>
      <span className="min-w-0 flex-1">
        {file ? (
          <>
            <span className="block truncate font-medium text-foreground">{file.name}</span>
            <span className="block text-xs tabular-nums text-muted-foreground">
              {formatFileSize(file.size)}
            </span>
          </>
        ) : (
          <>
            <span className="block font-medium text-foreground">{labels.choose}</span>
            <span className="block text-xs text-muted-foreground">{labels.hint}</span>
          </>
        )}
      </span>
      {file && (
        <span className="shrink-0 text-xs font-medium text-primary">{labels.change}</span>
      )}
      <input
        ref={inputRef}
        type="file"
        name={name}
        accept={accept}
        required={required}
        className="sr-only"
        onChange={() => {
          const chosen = inputRef.current?.files?.[0];
          setFile(chosen ? { name: chosen.name, size: chosen.size } : null);
        }}
      />
    </label>
  );
}
