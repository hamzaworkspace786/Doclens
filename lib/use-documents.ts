"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ACCEPTED_EXTENSIONS,
  MAX_FILE_BYTES,
  MAX_FILE_LABEL,
} from "./constants";
import type { DocumentSummary } from "./types";

interface ApiError {
  error?: string;
}

async function readError(response: Response, fallback: string) {
  const body = (await response.json().catch(() => null)) as ApiError | null;
  return body?.error ?? fallback;
}

/** Checks we can do before sending anything. The server repeats them all. */
function checkFile(file: File): string | null {
  const lower = file.name.toLowerCase();
  if (!ACCEPTED_EXTENSIONS.some((ext) => lower.endsWith(ext))) {
    return `${file.name}: DocLens reads PDF, Word (.docx), and text (.txt) files.`;
  }
  if (file.size > MAX_FILE_BYTES) {
    return `${file.name} is larger than ${MAX_FILE_LABEL}. Try a smaller one.`;
  }
  if (file.size === 0) {
    return `${file.name} is empty.`;
  }
  return null;
}

export function useDocuments() {
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [uploadingNames, setUploadingNames] = useState<string[]>([]);
  const [uploadError, setUploadError] = useState("");

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const response = await fetch("/api/documents");
        if (!response.ok) {
          throw new Error(await readError(response, "Could not load your documents."));
        }
        const body = (await response.json()) as { documents: DocumentSummary[] };
        if (cancelled) return;
        setDocuments(body.documents);
        setSelectedId((current) => current ?? body.documents[0]?.id ?? null);
        setLoadError("");
      } catch (error) {
        if (cancelled) return;
        setLoadError(
          error instanceof Error ? error.message : "Could not load your documents.",
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // While a document is being prepared for search or analyzed, check on it
  // every few seconds. We only update documents we already show, so a
  // document you just deleted can never reappear.
  const processingKey = documents
    .filter((doc) => doc.status === "processing" || doc.analysisStatus === "processing")
    .map((doc) => doc.id)
    .join(",");

  useEffect(() => {
    if (!processingKey) return;
    let cancelled = false;

    const timer = setInterval(async () => {
      for (const id of processingKey.split(",")) {
        try {
          const response = await fetch(`/api/documents/${id}`);
          if (!response.ok) continue;
          const body = (await response.json()) as { document: DocumentSummary };
          if (cancelled) return;
          setDocuments((current) =>
            current.map((doc) => (doc.id === id ? body.document : doc)),
          );
        } catch {
          // Network hiccup: we'll try again on the next tick.
        }
      }
    }, 2500);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [processingKey]);

  /** Uploads files one after another. Resolves with the documents that were created. */
  const uploadFiles = useCallback(async (files: File[]) => {
    setUploadError("");
    const created: DocumentSummary[] = [];
    const problems: string[] = [];

    for (const file of files) {
      const problem = checkFile(file);
      if (problem) {
        problems.push(problem);
        continue;
      }

      setUploadingNames((names) => [...names, file.name]);
      try {
        const form = new FormData();
        form.append("file", file);
        const response = await fetch("/api/documents", { method: "POST", body: form });

        if (!response.ok) {
          problems.push(
            `${file.name}: ${await readError(response, "The upload failed. Try again.")}`,
          );
          continue;
        }

        const body = (await response.json()) as { document: DocumentSummary };
        created.push(body.document);
        setDocuments((current) => [body.document, ...current]);
        setSelectedId(body.document.id);
      } catch {
        problems.push(`${file.name}: the upload failed. Check your connection and try again.`);
      } finally {
        setUploadingNames((names) => {
          const index = names.indexOf(file.name);
          return index === -1 ? names : names.filter((_, i) => i !== index);
        });
      }
    }

    setUploadError(problems.join("\n"));
    return created;
  }, []);

  const deleteDocument = useCallback(
    async (id: string) => {
      setUploadError("");
      const response = await fetch(`/api/documents/${id}`, { method: "DELETE" });
      if (!response.ok) {
        setUploadError(await readError(response, "Could not delete this document."));
        return;
      }
      const remaining = documents.filter((doc) => doc.id !== id);
      setDocuments(remaining);
      if (selectedId === id) setSelectedId(remaining[0]?.id ?? null);
    },
    [documents, selectedId],
  );

  /**
   * Start (or retry) the analysis of a document. Resolves with null when it
   * started, or with a message to show the person when it could not.
   * Progress then arrives through the polling above.
   */
  const analyzeDocument = useCallback(async (id: string): Promise<string | null> => {
    try {
      const response = await fetch(`/api/documents/${id}/analysis`, { method: "POST" });
      if (!response.ok) {
        return await readError(response, "Could not start the analysis. Try again.");
      }
      const body = (await response.json()) as { document?: DocumentSummary };
      const updated = body.document;
      if (updated) {
        setDocuments((current) => current.map((doc) => (doc.id === id ? updated : doc)));
      }
      return null;
    } catch {
      return "Could not start the analysis. Check your connection and try again.";
    }
  }, []);

  return {
    documents,
    loading,
    loadError,
    selectedId,
    selectDocument: setSelectedId,
    uploadingNames,
    uploadError,
    uploadFiles,
    deleteDocument,
    analyzeDocument,
  };
}
