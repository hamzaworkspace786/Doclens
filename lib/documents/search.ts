import "server-only";
import { embedQuery, type EmbedOptions } from "@/lib/ai/embed";
import { dot } from "@/lib/ai/vectors";
import { SEARCH_RESULT_COUNT } from "@/lib/constants";
import type { SearchHit } from "@/lib/types";
import { getChunksWithEmbeddings, getDocument } from "./store";

/** The document exists but can't be searched (yet). The message is safe to show. */
export class SearchNotReadyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SearchNotReadyError";
  }
}

/**
 * Find the passages of one document closest in meaning to the question.
 * Returns null when the document doesn't exist or isn't yours.
 *
 * This compares the question's vector with every chunk's vector in memory.
 * A document has at most a few hundred chunks, so that takes a few
 * milliseconds and needs no search index. Searching across many documents at
 * once is where a database vector index (like Atlas Vector Search) starts to pay off.
 */
export async function searchDocument(
  userId: string,
  documentId: string,
  query: string,
  embedOptions: EmbedOptions = {},
  limit: number = SEARCH_RESULT_COUNT,
): Promise<SearchHit[] | null> {
  const document = await getDocument(userId, documentId);
  if (!document) return null;

  if (!document.searchable) {
    throw new SearchNotReadyError(
      document.status === "processing"
        ? "This document is still being prepared for search."
        : document.status === "failed"
          ? "This document couldn't be prepared for search."
          : "This document was uploaded before search was added. Delete it and upload it again to search it.",
    );
  }

  const queryVector = await embedQuery(query, embedOptions);
  const chunks = await getChunksWithEmbeddings(userId, documentId);

  return chunks
    .map((chunk) => ({
      index: chunk.index,
      page: chunk.page,
      text: chunk.text,
      score: dot(queryVector, chunk.embedding),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
