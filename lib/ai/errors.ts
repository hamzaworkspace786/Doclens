export type EmbeddingErrorKind =
  | "rate_limit" // the AI service asked us to slow down
  | "auth" // the API key was rejected
  | "not_configured" // there is no API key
  | "unavailable" // the AI service or the network is down
  | "timeout" // we ran out of time
  | "bad_request"
  | "unknown";

export class EmbeddingError extends Error {
  kind: EmbeddingErrorKind;

  constructor(kind: EmbeddingErrorKind, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "EmbeddingError";
    this.kind = kind;
  }
}

const USER_MESSAGES: Record<EmbeddingErrorKind, string> = {
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
  unknown:
    "Something went wrong while preparing this document for search. Delete it and upload it again.",
};

/** A message that is safe to show to a user. Never includes keys or raw API errors. */
export function userMessage(error: unknown): string {
  if (error instanceof EmbeddingError) return USER_MESSAGES[error.kind];
  return USER_MESSAGES.unknown;
}
