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

// Analysis (summary, key points, names and numbers, action items)
export const ANALYSIS_ATTEMPT_TIMEOUT_MS = 150_000; // one call to the AI may take this long at most
export const ANALYSIS_MAX_OUTPUT_TOKENS = 16_384; // thinking tokens count toward this too
export const MAX_CITED_PAGES = 4; // page chips shown per item

// How long the main model gets (waiting and retrying included) before the
// backup model takes over. The backup gets whatever is left of the 270 seconds.
export const ANALYSIS_PRIMARY_BUDGET_MS = 100_000;

// The most items we keep per list. The prompt asks for fewer; this is the safety net.
export const ANALYSIS_LIMITS = {
  keyPoints: 10,
  people: 25,
  organizations: 25,
  dates: 25,
  amounts: 30,
  actionItems: 25,
} as const;

// Chat with a document
export const CHAT_EXCERPT_COUNT = 8; // passages sent to the model with each question
export const CHAT_MAX_MESSAGE_CHARS = 2000;
export const CHAT_MAX_HISTORY_MESSAGES = 10; // earlier messages the model sees
export const CHAT_MAX_OUTPUT_TOKENS = 1500;
// If the model says nothing for this long, the backup model takes over.
export const CHAT_FIRST_TOKEN_TIMEOUT_MS = 20_000;
// An answer that is still going after this long is cut off.
export const CHAT_TOTAL_TIMEOUT_MS = 90_000;
// Response header that lists the pages the model was allowed to cite.
export const CHAT_PAGES_HEADER = "X-Doclens-Pages";
// Saved messages kept per document (question and answer count separately).
// Older ones are dropped, so one chat can't grow without limit.
export const CHAT_MAX_SAVED_MESSAGES = 100;

// --- Fair use ----------------------------------------------------------------
// DocLens runs on free tiers (Google's Gemini API, MongoDB Atlas, Vercel), so
// every AI call is limited per person and for the whole site. The site limits
// stop one burst of visitors from using up the shared daily quota for everyone.
// Tune these to about 60 to 80 percent of the daily limits your Gemini key shows
// in Google AI Studio. Counting uses UTC days, hours and minutes.
export const LIMITS = {
  // Per person
  uploadsPerHour: 5,
  uploadsPerDay: 8,
  questionsPerMinute: 8,
  questionsPerDay: 60,
  reanalysesPerDay: 10, // "Analyze" and "Try again" clicks, not the automatic one at upload
  // Whole site, per day
  siteUploadsPerDay: 100,
  siteQuestionsPerDay: 600,
  siteReanalysesPerDay: 100,
} as const;

// Documents older than this are deleted by the daily cleanup (app/api/cron/cleanup),
// so a free database can't fill up. Say the same thing in the privacy page.
export const DOCUMENT_RETENTION_DAYS = 14;
