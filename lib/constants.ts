// Shared by the browser and the server, so keep this file free of server code.

// Vercel's Hobby plan rejects request bodies over about 4.5 MB, so we stay under it.
export const MAX_FILE_BYTES = 4 * 1024 * 1024;
export const MAX_FILE_LABEL = "4 MB";

export const ACCEPTED_EXTENSIONS = [".pdf", ".docx", ".txt"] as const;
export const ACCEPT_ATTRIBUTE = ACCEPTED_EXTENSIONS.join(",");

// Per-user cap while DocLens is free. Keeps storage and AI costs predictable.
export const MAX_DOCUMENTS_PER_USER = 10;

// Limits on what we are willing to read from one file.
export const MAX_PAGES = 150;
export const MAX_CHARACTERS = 400_000;

// Word and text files have no fixed pages, so we cut them into pages of about this size.
export const ESTIMATED_PAGE_CHARS = 3000;

// Chunking for search. Chunks never cross a page, so every chunk has one page number.
export const CHUNK_MAX_CHARS = 800;
export const CHUNK_OVERLAP_CHARS = 120;

// Embeddings (turning chunks into vectors so search can match by meaning)
export const EMBED_BATCH_SIZE = 50; // chunks per request, about 10k tokens
export const PROCESSING_BUDGET_MS = 270_000; // stay inside Vercel's 300 second limit
export const STALE_PROCESSING_MS = 10 * 60 * 1000; // "processing" this long means it was interrupted

// Search
export const SEARCH_RESULT_COUNT = 5;
export const MAX_QUERY_CHARS = 500;
