"use client";

import { useState } from "react";
import { ESTIMATED_PAGE_CHARS } from "@/lib/constants";
import { describeLength, fileTypeLabel, formatBytes } from "@/lib/format";
import type { DocumentSummary } from "@/lib/types";
import { PageViewer } from "./page-viewer";
import { SearchPanel } from "./search-panel";

type TabId = "text" | "search";

// The Summary, Key points, Names and numbers, and Action items tabs get their
// content in the analysis phase.
const comingSoonTabs = ["Summary", "Key points", "Names and numbers", "Action items"];

const tabClass = (active: boolean) =>
  `-mb-px whitespace-nowrap border-b-2 pb-2.5 text-sm disabled:cursor-not-allowed ${
    active ? "border-mark font-medium text-text" : "border-transparent text-muted"
  }`;

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center px-8">
      <p className="max-w-sm text-center font-serif text-[17px] leading-[1.7] text-muted">
        {message}
      </p>
    </div>
  );
}

function searchHint(document: DocumentSummary) {
  if (document.status === "processing") return "Available once the document is prepared";
  return "Search isn't available for this document";
}

// Keyed by document id from AnalysisPanel, so the tab and page reset when you
// pick a different document.
function DocumentView({ document }: { document: DocumentSummary }) {
  const [tab, setTab] = useState<TabId>("text");
  const [page, setPage] = useState(1);

  const legacy = document.status === "ready" && !document.searchable;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-line px-5 pt-4">
        <h2 className="truncate text-[15px] font-semibold">{document.title}</h2>
        <p className="mt-1 text-sm text-muted">
          {fileTypeLabel(document.fileType)}, {describeLength(document)},{" "}
          {formatBytes(document.fileSize)}, {document.chunkCount} text{" "}
          {document.chunkCount === 1 ? "chunk" : "chunks"}
        </p>
        {document.pagesAreEstimated && (
          <p className="mt-1 text-sm text-muted">
            Word and text files have no fixed pages, so DocLens cuts them into pages of
            about {ESTIMATED_PAGE_CHARS.toLocaleString("en-US")} characters.
          </p>
        )}

        {document.status === "processing" && (
          <p role="status" className="mt-2 text-sm text-mark">
            Preparing this document for search. You can read it while you wait.
          </p>
        )}
        {document.status === "failed" && (
          <p role="alert" className="mt-2 text-sm leading-relaxed text-danger">
            {document.errorMessage ?? "This document couldn't be prepared for search."} You
            can still read it here.
          </p>
        )}
        {legacy && (
          <p className="mt-2 text-sm leading-relaxed text-muted">
            This document was uploaded before search was added. Delete it and upload it
            again to search it.
          </p>
        )}

        <div role="tablist" aria-label="Document sections" className="mt-3 flex gap-5 overflow-x-auto">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "text"}
            onClick={() => setTab("text")}
            className={tabClass(tab === "text")}
          >
            Text
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "search"}
            disabled={!document.searchable}
            title={document.searchable ? undefined : searchHint(document)}
            onClick={() => setTab("search")}
            className={tabClass(tab === "search")}
          >
            Search
          </button>
          {comingSoonTabs.map((label) => (
            <button
              key={label}
              type="button"
              role="tab"
              aria-selected={false}
              disabled
              title="Coming soon"
              className={tabClass(false)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {tab === "text" && (
        <PageViewer
          documentId={document.id}
          pageCount={document.pageCount}
          page={page}
          onPageChange={setPage}
        />
      )}
      {tab === "search" && document.searchable && (
        <SearchPanel
          documentId={document.id}
          onOpenPage={(target) => {
            setPage(target);
            setTab("text");
          }}
        />
      )}
    </div>
  );
}

export function AnalysisPanel({ document }: { document: DocumentSummary | null }) {
  if (document) return <DocumentView key={document.id} document={document} />;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-line px-5 pt-4">
        <h2 className="truncate text-[15px] font-semibold">No document selected</h2>
        <div role="tablist" aria-label="Document sections" className="mt-3 flex gap-5 overflow-x-auto">
          {["Text", "Search", ...comingSoonTabs].map((label, i) => (
            <button
              key={label}
              type="button"
              role="tab"
              aria-selected={i === 0}
              disabled
              className={tabClass(i === 0)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <EmptyState message="Upload a document, or pick one from the list, to read it here." />
    </div>
  );
}
