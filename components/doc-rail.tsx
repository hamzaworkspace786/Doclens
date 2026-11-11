"use client";

import { useRef, useState } from "react";
import { LoaderCircle, Trash2, Upload } from "lucide-react";
import { ACCEPT_ATTRIBUTE, MAX_FILE_LABEL } from "@/lib/constants";
import { describeLength, fileTypeLabel } from "@/lib/format";
import type { DocumentSummary } from "@/lib/types";

interface DocRailProps {
  documents: DocumentSummary[];
  loading: boolean;
  loadError: string;
  selectedId: string | null;
  uploadingNames: string[];
  uploadError: string;
  onSelect: (id: string) => void;
  onUpload: (files: File[]) => void;
  onDelete: (id: string) => void;
}

export function DocRail({
  documents,
  loading,
  loadError,
  selectedId,
  uploadingNames,
  uploadError,
  onSelect,
  onUpload,
  onDelete,
}: DocRailProps) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const uploading = uploadingNames.length > 0;
  const isEmpty = !loading && documents.length === 0 && !uploading;

  function openFilePicker() {
    fileInput.current?.click();
  }

  function handleFiles(fileList: FileList | null) {
    const files = Array.from(fileList ?? []);
    if (files.length > 0) onUpload(files);
    // Reset so choosing the same file again still fires a change event.
    if (fileInput.current) fileInput.current.value = "";
  }

  return (
    <div
      className="flex h-full min-h-0 flex-col"
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
          setDragging(false);
        }
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        handleFiles(e.dataTransfer.files);
      }}
    >
      <input
        ref={fileInput}
        type="file"
        accept={ACCEPT_ATTRIBUTE}
        multiple
        className="sr-only"
        tabIndex={-1}
        aria-label="Choose documents to upload"
        onChange={(e) => handleFiles(e.target.files)}
      />

      <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
        <h2 className="text-[15px] font-semibold">Documents</h2>
        <button
          type="button"
          onClick={openFilePicker}
          disabled={uploading}
          className="inline-flex items-center gap-1.5 rounded-lg bg-mark px-3 py-1.5 text-sm font-semibold text-on-mark transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          <Upload size={15} aria-hidden="true" />
          Upload
        </button>
      </div>

      {(uploadError || loadError) && (
        <p
          role="alert"
          className="whitespace-pre-line border-b border-line px-4 py-3 text-sm leading-relaxed text-danger"
        >
          {uploadError || loadError}
        </p>
      )}

      <div
        className={`m-3 flex min-h-0 flex-1 flex-col rounded-xl border border-dashed transition-colors ${
          dragging ? "border-mark bg-raised/60" : "border-transparent"
        }`}
      >
        {loading && (
          <p className="px-3 py-4 text-sm text-muted">Loading your documents...</p>
        )}

        {isEmpty && (
          <button
            type="button"
            onClick={openFilePicker}
            className="m-1 flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-line px-5 text-center transition-colors hover:border-mark"
          >
            <span className="text-[15px] font-medium">No documents yet</span>
            <span className="mt-1.5 text-sm leading-relaxed text-muted">
              Drop a PDF, Word file, or text file here, or click to choose one.
              Files can be up to {MAX_FILE_LABEL}.
            </span>
          </button>
        )}

        {(documents.length > 0 || uploading) && (
          <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto p-1">
            {uploadingNames.map((name, i) => (
              <li
                key={`${name}-${i}`}
                className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm text-muted"
              >
                <LoaderCircle size={15} className="shrink-0 animate-spin" aria-hidden="true" />
                <span className="min-w-0 truncate">Reading {name}...</span>
              </li>
            ))}

            {documents.map((doc) => {
              const selected = doc.id === selectedId;
              const confirming = doc.id === confirmingId;

              return (
                <li
                  key={doc.id}
                  className={`group flex items-center rounded-lg transition-colors ${
                    selected ? "bg-raised" : "hover:bg-raised/60"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => onSelect(doc.id)}
                    aria-current={selected ? "true" : undefined}
                    className="min-w-0 flex-1 rounded-lg px-3 py-2.5 text-left"
                  >
                    <span className="block truncate text-sm font-medium">{doc.title}</span>
                    <span className="mt-0.5 block text-xs text-muted">
                      {doc.status === "ready" && `${fileTypeLabel(doc.fileType)}, ${describeLength(doc)}`}
                      {doc.status === "processing" && "Reading..."}
                      {doc.status === "failed" && (
                        <span className="text-danger">Could not be read</span>
                      )}
                    </span>
                  </button>

                  {confirming ? (
                    <span className="flex shrink-0 items-center gap-1 pr-2">
                      <button
                        type="button"
                        onClick={() => {
                          setConfirmingId(null);
                          onDelete(doc.id);
                        }}
                        className="rounded-md px-2 py-1 text-xs font-medium text-danger hover:bg-ink"
                      >
                        Delete
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmingId(null)}
                        className="rounded-md px-2 py-1 text-xs text-muted hover:bg-ink"
                      >
                        Keep
                      </button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmingId(doc.id)}
                      aria-label={`Delete ${doc.title}`}
                      className="mr-1 grid h-8 w-8 shrink-0 place-items-center rounded-md text-muted transition-opacity hover:text-danger focus-visible:opacity-100 lg:opacity-0 lg:group-hover:opacity-100"
                    >
                      <Trash2 size={15} aria-hidden="true" />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {documents.length > 0 && (
        <p className="px-4 pb-3 text-xs text-muted">
          Drop files anywhere here to add more. Up to {MAX_FILE_LABEL} each.
        </p>
      )}
    </div>
  );
}
