"use client";

import { LoaderCircle, RotateCw, Sparkles } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import type { AnalysisResponse, DocumentAnalysis, DocumentSummary, Entity } from "@/lib/types";

export type AnalysisTabId = "summary" | "keypoints" | "names" | "actions";

interface Props {
  document: DocumentSummary;
  tab: AnalysisTabId;
  onOpenPage: (page: number) => void;
  /** Starts or retries the analysis. Resolves with a message if it could not start. */
  onAnalyze: (id: string) => Promise<string | null>;
}

const buttonClass =
  "inline-flex items-center gap-1.5 rounded-lg bg-mark px-4 py-2.5 text-sm font-semibold text-on-mark transition-opacity hover:opacity-90 disabled:opacity-50";

// --- Loading the saved analysis ---------------------------------------------

type Loaded =
  | { state: "idle" }
  | { state: "loading" }
  | { state: "error"; message: string; reload: () => void }
  | { state: "ready"; analysis: DocumentAnalysis };

/**
 * Fetches the saved analysis once the document says it is ready. The result is
 * stored together with the key it was fetched for, so a stale result is never
 * shown after the analysis is regenerated (generatedAt changes).
 */
function useAnalysis(
  documentId: string,
  status: DocumentSummary["analysisStatus"],
  generatedAt: string | undefined,
): Loaded {
  const [reloads, setReloads] = useState(0);
  const [result, setResult] = useState<{
    key: string;
    analysis?: DocumentAnalysis;
    error?: string;
  } | null>(null);

  const key = status === "ready" ? `${documentId}:${generatedAt ?? ""}:${reloads}` : null;

  useEffect(() => {
    if (!key) return;
    let cancelled = false;

    (async () => {
      try {
        const response = await fetch(`/api/documents/${documentId}/analysis`);
        const body = (await response.json().catch(() => null)) as
          | (Partial<AnalysisResponse> & { error?: string })
          | null;
        if (cancelled) return;
        if (!response.ok || !body?.analysis) {
          setResult({ key, error: body?.error ?? "Could not load the analysis." });
          return;
        }
        setResult({ key, analysis: body.analysis });
      } catch {
        if (!cancelled) setResult({ key, error: "Could not load the analysis." });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [key, documentId]);

  if (!key) return { state: "idle" };
  if (!result || result.key !== key) return { state: "loading" };
  if (result.analysis) return { state: "ready", analysis: result.analysis };
  return {
    state: "error",
    message: result.error ?? "Could not load the analysis.",
    reload: () => setReloads((count) => count + 1),
  };
}

// --- Small pieces -------------------------------------------------------------

function Centered({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 px-8 text-center">
      {children}
    </div>
  );
}

function PageChips({
  pages,
  onOpenPage,
}: {
  pages: number[];
  onOpenPage: (page: number) => void;
}) {
  if (pages.length === 0) return null;
  return (
    <span className="inline-flex flex-wrap gap-1.5">
      {pages.map((page) => (
        <button
          key={page}
          type="button"
          onClick={() => onOpenPage(page)}
          aria-label={`Open page ${page}`}
          className="rounded-[4px] bg-mark px-1.5 py-px text-xs font-semibold text-on-mark transition-opacity hover:opacity-80"
        >
          p.{page}
        </button>
      ))}
    </span>
  );
}

function Body({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
      {children}
      <p className="mt-6 text-xs leading-relaxed text-muted">
        Written by AI from the document&rsquo;s text. Check anything important against the
        cited pages.
      </p>
    </div>
  );
}

function Empty({ message }: { message: string }) {
  return <p className="font-serif text-[17px] leading-[1.7] text-muted">{message}</p>;
}

const itemClass = "rounded-xl border border-line bg-ink p-3.5";

// --- The four tabs ------------------------------------------------------------

function SummaryView({
  analysis,
  onOpenPage,
}: {
  analysis: DocumentAnalysis;
  onOpenPage: (page: number) => void;
}) {
  const { summary } = analysis;
  return (
    <>
      <span className="inline-block rounded-full border border-line px-2.5 py-0.5 text-xs font-medium uppercase tracking-wide text-muted">
        {summary.documentType}
      </span>
      <p className="mt-3 font-serif text-[17px] leading-[1.75]">{summary.overview}</p>
      {summary.pages.length > 0 && (
        <p className="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted">
          Mostly from <PageChips pages={summary.pages} onOpenPage={onOpenPage} />
        </p>
      )}
    </>
  );
}

function KeyPointsView({
  analysis,
  onOpenPage,
}: {
  analysis: DocumentAnalysis;
  onOpenPage: (page: number) => void;
}) {
  if (analysis.keyPoints.length === 0) {
    return <Empty message="No key points were found in this document." />;
  }
  return (
    <ol className="space-y-3">
      {analysis.keyPoints.map((item, i) => (
        <li key={i} className={`${itemClass} flex gap-3`}>
          <span aria-hidden className="mt-0.5 w-5 shrink-0 text-sm font-semibold text-muted">
            {i + 1}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-medium leading-relaxed">{item.point}</p>
            {item.detail && (
              <p className="mt-1 font-serif text-[16px] leading-[1.7] text-muted">
                {item.detail}
              </p>
            )}
            <div className="mt-2">
              <PageChips pages={item.pages} onOpenPage={onOpenPage} />
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}

const nameSections = [
  { key: "people", label: "People" },
  { key: "organizations", label: "Organizations" },
  { key: "dates", label: "Dates" },
  { key: "amounts", label: "Amounts" },
] as const satisfies readonly { key: keyof DocumentAnalysis; label: string }[];

function EntityItem({
  item,
  onOpenPage,
}: {
  item: Entity;
  onOpenPage: (page: number) => void;
}) {
  return (
    <li className={itemClass}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className="text-[15px] font-medium">{item.text}</span>
        <PageChips pages={item.pages} onOpenPage={onOpenPage} />
      </div>
      {item.detail && (
        <p className="mt-1 text-sm leading-relaxed text-muted">{item.detail}</p>
      )}
      {!item.verified && (
        <p className="mt-1.5 text-xs leading-relaxed text-muted">
          Couldn&rsquo;t find this exact wording in the text. Check the cited page.
        </p>
      )}
    </li>
  );
}

function NamesView({
  analysis,
  onOpenPage,
}: {
  analysis: DocumentAnalysis;
  onOpenPage: (page: number) => void;
}) {
  const filled = nameSections.filter((section) => analysis[section.key].length > 0);
  if (filled.length === 0) {
    return <Empty message="No names, dates, or amounts were found in this document." />;
  }
  return (
    <div className="space-y-6">
      {filled.map((section) => (
        <section key={section.key} aria-label={section.label}>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
            {section.label} ({analysis[section.key].length})
          </h3>
          <ul className="space-y-2">
            {analysis[section.key].map((item, i) => (
              <EntityItem key={i} item={item} onOpenPage={onOpenPage} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function ActionsView({
  analysis,
  onOpenPage,
}: {
  analysis: DocumentAnalysis;
  onOpenPage: (page: number) => void;
}) {
  if (analysis.actionItems.length === 0) {
    return <Empty message="No action items were found in this document." />;
  }
  return (
    <ul className="space-y-2">
      {analysis.actionItems.map((item, i) => (
        <li key={i} className={`${itemClass} flex gap-3`}>
          <span
            aria-hidden
            className="mt-1 h-4 w-4 shrink-0 rounded-[4px] border border-line"
          />
          <div className="min-w-0 flex-1">
            <p className="text-[15px] leading-relaxed">{item.task}</p>
            {(item.owner || item.due) && (
              <p className="mt-1 text-sm text-muted">
                {item.owner && `Owner: ${item.owner}`}
                {item.owner && item.due && " \u00b7 "}
                {item.due && `Due: ${item.due}`}
              </p>
            )}
            <div className="mt-2">
              <PageChips pages={item.pages} onOpenPage={onOpenPage} />
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

// --- The panel ----------------------------------------------------------------

export function AnalysisContent({ document, tab, onOpenPage, onAnalyze }: Props) {
  const loaded = useAnalysis(document.id, document.analysisStatus, document.analysisGeneratedAt);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState("");

  async function start() {
    setStarting(true);
    setStartError("");
    const problem = await onAnalyze(document.id);
    if (problem) setStartError(problem);
    setStarting(false);
  }

  if (document.analysisStatus === "processing") {
    return (
      <Centered>
        <LoaderCircle aria-hidden className="h-6 w-6 animate-spin text-mark" />
        <p role="status" className="max-w-xs text-sm leading-relaxed text-muted">
          Analyzing this document. This usually takes under a minute. You can read it or
          search it meanwhile.
        </p>
      </Centered>
    );
  }

  if (document.analysisStatus === "failed") {
    return (
      <Centered>
        <p role="alert" className="max-w-xs text-sm leading-relaxed text-danger">
          {document.analysisError ?? "The analysis didn't finish."}
        </p>
        {startError && (
          <p role="alert" className="max-w-xs text-sm leading-relaxed text-danger">
            {startError}
          </p>
        )}
        <button type="button" onClick={start} disabled={starting} className={buttonClass}>
          <RotateCw aria-hidden className="h-4 w-4" />
          Try again
        </button>
      </Centered>
    );
  }

  if (document.analysisStatus === "none") {
    return (
      <Centered>
        <p className="max-w-xs text-sm leading-relaxed text-muted">
          This document hasn&rsquo;t been analyzed yet. DocLens can summarize it and pull
          out the key points, names, numbers, and action items.
        </p>
        {startError && (
          <p role="alert" className="max-w-xs text-sm leading-relaxed text-danger">
            {startError}
          </p>
        )}
        <button type="button" onClick={start} disabled={starting} className={buttonClass}>
          <Sparkles aria-hidden className="h-4 w-4" />
          Analyze this document
        </button>
      </Centered>
    );
  }

  // analysisStatus === "ready"
  if (loaded.state === "error") {
    return (
      <Centered>
        <p role="alert" className="max-w-xs text-sm leading-relaxed text-danger">
          {loaded.message}
        </p>
        <button type="button" onClick={loaded.reload} className={buttonClass}>
          <RotateCw aria-hidden className="h-4 w-4" />
          Try again
        </button>
      </Centered>
    );
  }

  if (loaded.state !== "ready") {
    return (
      <Centered>
        <LoaderCircle aria-hidden className="h-6 w-6 animate-spin text-mark" />
        <p role="status" className="text-sm text-muted">
          Loading the analysis
        </p>
      </Centered>
    );
  }

  return (
    <Body>
      {tab === "summary" && <SummaryView analysis={loaded.analysis} onOpenPage={onOpenPage} />}
      {tab === "keypoints" && (
        <KeyPointsView analysis={loaded.analysis} onOpenPage={onOpenPage} />
      )}
      {tab === "names" && <NamesView analysis={loaded.analysis} onOpenPage={onOpenPage} />}
      {tab === "actions" && <ActionsView analysis={loaded.analysis} onOpenPage={onOpenPage} />}
    </Body>
  );
}
