"use client";

import { useState } from "react";
import { LoaderCircle, Search } from "lucide-react";
import { MAX_QUERY_CHARS } from "@/lib/constants";
import type { SearchHit } from "@/lib/types";

interface SearchPanelProps {
  documentId: string;
  onOpenPage: (page: number) => void;
}

type SearchState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "done"; query: string; hits: SearchHit[] };

const EXCERPT_CHARS = 420;

// Render this with key={documentId} so results don't carry over between documents.
export function SearchPanel({ documentId, onOpenPage }: SearchPanelProps) {
  const [query, setQuery] = useState("");
  const [state, setState] = useState<SearchState>({ status: "idle" });

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;

    setState({ status: "loading" });
    try {
      const response = await fetch(`/api/documents/${documentId}/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: trimmed }),
      });
      const body = (await response.json().catch(() => null)) as {
        results?: SearchHit[];
        error?: string;
      } | null;

      if (!response.ok || !body?.results) {
        setState({ status: "error", message: body?.error ?? "The search failed. Try again." });
        return;
      }
      setState({ status: "done", query: trimmed, hits: body.results });
    } catch {
      setState({
        status: "error",
        message: "The search failed. Check your connection and try again.",
      });
    }
  }

  const loading = state.status === "loading";

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <form onSubmit={handleSubmit} className="border-b border-line p-4">
        <label htmlFor="document-search" className="sr-only">
          Search this document
        </label>
        <div className="flex gap-2">
          <input
            id="document-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            maxLength={MAX_QUERY_CHARS}
            placeholder="Ask about something in this document"
            disabled={loading}
            className="min-w-0 flex-1 rounded-lg border border-line bg-ink px-3.5 py-2.5 text-[15px] placeholder:text-muted/70 focus:border-mark focus:outline-none disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-mark px-4 py-2.5 text-sm font-semibold text-on-mark transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {loading ? (
              <LoaderCircle size={16} className="animate-spin" aria-hidden="true" />
            ) : (
              <Search size={16} aria-hidden="true" />
            )}
            Search
          </button>
        </div>
        <p className="mt-2 text-sm text-muted">
          Finds passages by meaning, so you don&rsquo;t need the exact words.
        </p>
      </form>

      <div className="min-h-0 flex-1 overflow-y-auto p-4" aria-live="polite">
        {state.status === "idle" && (
          <p className="mx-auto mt-6 max-w-sm text-center font-serif text-[17px] leading-[1.7] text-muted">
            Try a question like &ldquo;what are the payment terms?&rdquo; and the
            closest passages appear here.
          </p>
        )}

        {state.status === "loading" && <p className="text-sm text-muted">Searching...</p>}

        {state.status === "error" && (
          <p role="alert" className="text-sm leading-relaxed text-danger">
            {state.message}
          </p>
        )}

        {state.status === "done" && (
          <>
            <p className="mb-3 text-sm text-muted">
              Closest passages to &ldquo;{state.query}&rdquo;
            </p>
            <ul className="space-y-3">
              {state.hits.map((hit) => (
                <li key={hit.index}>
                  <button
                    type="button"
                    onClick={() => onOpenPage(hit.page)}
                    className="block w-full rounded-xl border border-line bg-ink p-4 text-left transition-colors hover:border-mark"
                  >
                    <span className="inline-block rounded-[4px] bg-mark px-1.5 py-px text-xs font-semibold text-on-mark">
                      Page {hit.page}
                    </span>
                    <span className="mt-2 block font-serif text-[16px] leading-[1.7] text-text/90">
                      {hit.text.length > EXCERPT_CHARS
                        ? `${hit.text.slice(0, EXCERPT_CHARS).trimEnd()}...`
                        : hit.text}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
