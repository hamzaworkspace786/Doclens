import { ESTIMATED_PAGE_CHARS } from "@/lib/constants";
import { describeLength, fileTypeLabel, formatBytes } from "@/lib/format";
import type { DocumentSummary } from "@/lib/types";
import { PageViewer } from "./page-viewer";

// The Text tab works now. The other tabs get their content in the analysis phase.
const tabs = [
  { label: "Text", ready: true },
  { label: "Summary", ready: false },
  { label: "Key points", ready: false },
  { label: "Names and numbers", ready: false },
  { label: "Action items", ready: false },
];

export function AnalysisPanel({ document }: { document: DocumentSummary | null }) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-line px-5 pt-4">
        <h2 className="truncate text-[15px] font-semibold">
          {document ? document.title : "No document selected"}
        </h2>

        {document && (
          <>
            <p className="mt-1 text-sm text-muted">
              {fileTypeLabel(document.fileType)}, {describeLength(document)},{" "}
              {formatBytes(document.fileSize)}, {document.chunkCount} text{" "}
              {document.chunkCount === 1 ? "chunk" : "chunks"}
            </p>
            {document.pagesAreEstimated && (
              <p className="mt-1 text-sm text-muted">
                Word and text files have no fixed pages, so DocLens cuts them into
                pages of about {ESTIMATED_PAGE_CHARS.toLocaleString("en-US")} characters.
              </p>
            )}
          </>
        )}

        <div
          role="tablist"
          aria-label="Document sections"
          className="mt-3 flex gap-5 overflow-x-auto"
        >
          {tabs.map((tab) => (
            <button
              key={tab.label}
              type="button"
              role="tab"
              aria-selected={tab.ready}
              disabled={!tab.ready}
              title={tab.ready ? undefined : "Coming soon"}
              className={`-mb-px whitespace-nowrap border-b-2 pb-2.5 text-sm ${
                tab.ready
                  ? "border-mark font-medium text-text"
                  : "border-transparent text-muted"
              } disabled:cursor-not-allowed`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {document && document.status === "ready" ? (
        <PageViewer key={document.id} documentId={document.id} pageCount={document.pageCount} />
      ) : (
        <div className="flex min-h-0 flex-1 items-center justify-center px-8">
          <p className="max-w-sm text-center font-serif text-[17px] leading-[1.7] text-muted">
            {document
              ? "This document isn't ready to read yet."
              : "Upload a document, or pick one from the list, to read it here."}
          </p>
        </div>
      )}
    </div>
  );
}
