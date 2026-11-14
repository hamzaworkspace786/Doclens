export type AiErrorKind =
  | "rate_limit" // the AI service asked us to slow down
  | "auth" // the API key was rejected
  | "not_configured" // there is no API key
  | "unavailable" // the AI service or the network is down
  | "timeout" // we ran out of time
  | "bad_request"
  | "bad_output" // the AI answered, but not with something we can use
  | "unknown";

// Kept under its old name so Phase 3 code reads the same.
export type EmbeddingErrorKind = AiErrorKind;

/** Base class for every failure of a call to the AI service. */
export class AiError extends Error {
  kind: AiErrorKind;

  constructor(kind: AiErrorKind, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "AiError";
    this.kind = kind;
  }
}

/** A failure while turning text into search vectors. */
export class EmbeddingError extends AiError {
  constructor(kind: AiErrorKind, message: string, options?: { cause?: unknown }) {
    super(kind, message, options);
    this.name = "EmbeddingError";
  }
}

/** A failure while analyzing a document. */
export class AnalysisError extends AiError {
  constructor(kind: AiErrorKind, message: string, options?: { cause?: unknown }) {
    super(kind, message, options);
    this.name = "AnalysisError";
  }
}

/** A failure while answering a question about a document. */
export class ChatError extends AiError {
  constructor(kind: AiErrorKind, message: string, options?: { cause?: unknown }) {
    super(kind, message, options);
    this.name = "ChatError";
  }
}

const EMBEDDING_MESSAGES: Record<AiErrorKind, string> = {
  rate_limit:
    "The AI service is busy right now. Wait a minute, then delete this document and upload it again.",
  auth: "Search isn't set up correctly on this server yet.",
  not_configured: "Search isn't set up on this server yet.",
  unavailable:
    "The AI service isn't responding. Try again in a few minutes.",
  timeout:
    "Preparing this document took too long. Try again, or upload a smaller file.",
  bad_request:
    "The AI service couldn't process this document. Try a different file.",
  bad_output:
    "The AI service returned something we couldn't use. Delete this document and upload it again.",
  unknown:
    "Something went wrong while preparing this document for search. Delete it and upload it again.",
};

const ANALYSIS_MESSAGES: Record<AiErrorKind, string> = {
  rate_limit: "The AI service is busy right now. Wait a minute, then try again.",
  auth: "The analysis isn't set up correctly on this server yet.",
  not_configured: "The analysis isn't set up on this server yet.",
  unavailable: "The AI service isn't responding. Try again in a few minutes.",
  timeout: "The analysis took too long. Try again, or use a smaller document.",
  bad_request:
    "The AI service couldn't analyze this document. Try again, or use a different file.",
  bad_output: "The AI service returned an analysis we couldn't read. Try again.",
  unknown: "Something went wrong while analyzing this document. Try again.",
};

const CHAT_MESSAGES: Record<AiErrorKind, string> = {
  rate_limit: "The AI service is busy right now. Wait a minute, then ask again.",
  auth: "Chat isn't set up correctly on this server yet.",
  not_configured: "Chat isn't set up on this server yet.",
  unavailable: "The AI service isn't responding. Try again in a few minutes.",
  timeout: "The answer took too long. Try asking again.",
  bad_request: "The AI service couldn't answer that. Try rephrasing your question.",
  bad_output: "The AI service didn't give an answer. Try asking again.",
  unknown: "Something went wrong while answering. Try again.",
};

/** A message that is safe to show to a user. Never includes keys or raw API errors. */
export function userMessage(error: unknown): string {
  if (error instanceof EmbeddingError) return EMBEDDING_MESSAGES[error.kind];
  return EMBEDDING_MESSAGES.unknown;
}

/** Same idea for analysis failures. */
export function analysisUserMessage(error: unknown): string {
  if (error instanceof AiError) return ANALYSIS_MESSAGES[error.kind];
  return ANALYSIS_MESSAGES.unknown;
}

/** Same idea for chat failures. */
export function chatUserMessage(error: unknown): string {
  if (error instanceof AiError) return CHAT_MESSAGES[error.kind];
  return CHAT_MESSAGES.unknown;
}
