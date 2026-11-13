"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { reflowPage } from "@/lib/format";
import type { PageContent } from "@/lib/types";

interface PageViewerProps {
  documentId: string;
  pageCount: number;
  page: number;
  onPageChange: (page: number) => void;
}

interface PageResult {
  key: string;
  text?: string;
  error?: string;
}

const navButton =
  "inline-flex items-center gap-1 rounded-lg border border-line px-3 py-1.5 text-sm transition-colors hover:bg-raised disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent";

// The parent owns the page number, so other tabs (like Search) can jump to a page.
export function PageViewer({ documentId, pageCount, page, onPageChange }: PageViewerProps) {
  const [result, setResult] = useState<PageResult | null>(null);
  const scroller = useRef<HTMLDivElement>(null);

  const key = `${documentId}:${page}`;
  const loading = result?.key !== key;

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const response = await fetch(`/api/documents/${documentId}/pages/${page}`);
        const body = (await response.json()) as PageContent & { error?: string };
        if (!response.ok) throw new Error(body.error ?? "Could not load this page.");
        if (!cancelled) setResult({ key, text: body.text });
      } catch (error) {
        if (cancelled) return;
        setResult({
          key,
          error: error instanceof Error ? error.message : "Could not load this page.",
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [documentId, page, key]);

  function goTo(next: number) {
    onPageChange(Math.min(Math.max(next, 1), pageCount));
    scroller.current?.scrollTo({ top: 0 });
  }

  const paragraphs = result?.key === key && result.text ? reflowPage(result.text) : [];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto px-6 py-6 sm:px-10">
        <div className="mx-auto max-w-[68ch]">
          {loading && <p className="text-sm text-muted">Loading page {page}...</p>}

          {!loading && result?.error && (
            <p role="alert" className="text-sm text-danger">
              {result.error}
            </p>
          )}

          {!loading && !result?.error && paragraphs.length === 0 && (
            <p className="text-sm text-muted">This page has no text.</p>
          )}

          {paragraphs.map((paragraph, i) => (
            <p
              key={i}
              className="mb-4 font-serif text-[17px] leading-[1.75] text-text/90"
            >
              {paragraph}
            </p>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-2.5">
        <button
          type="button"
          onClick={() => goTo(page - 1)}
          disabled={page <= 1}
          className={navButton}
        >
          <ChevronLeft size={16} aria-hidden="true" />
          Previous
        </button>

        <label className="flex items-center gap-2 text-sm text-muted">
          <span className="sr-only">Go to page</span>
          <select
            value={page}
            onChange={(e) => goTo(Number(e.target.value))}
            className="rounded-lg border border-line bg-panel px-2 py-1.5 text-sm text-text"
          >
            {Array.from({ length: pageCount }, (_, i) => (
              <option key={i + 1} value={i + 1}>
                Page {i + 1}
              </option>
            ))}
          </select>
          of {pageCount}
        </label>

        <button
          type="button"
          onClick={() => goTo(page + 1)}
          disabled={page >= pageCount}
          className={navButton}
        >
          Next
          <ChevronRight size={16} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
