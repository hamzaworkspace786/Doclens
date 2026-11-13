import { APICallError, embed, embedMany, type EmbeddingModel } from "ai";
import { LoadAPIKeyError } from "@ai-sdk/provider";
import { EMBED_BATCH_SIZE } from "../constants";
import { EMBEDDING_DIMENSIONS } from "./config";
import { getEmbeddingModel } from "./embedding-model";
import { EmbeddingError, type EmbeddingErrorKind } from "./errors";
import { normalize } from "./vectors";

export interface EmbedOptions {
  /** Defaults to the Google model from embedding-model.ts. Tests pass a mock. */
  model?: EmbeddingModel;
  /** Epoch milliseconds. We stop waiting and retrying after this moment. */
  deadline?: number;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
}

const realSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

// How long to wait before the next attempt, and how many attempts to allow.
const RATE_LIMIT_ATTEMPTS = 8;
const RATE_LIMIT_BASE_MS = 15_000;
const RATE_LIMIT_MAX_MS = 60_000; // free-tier limits reset every minute
const UNAVAILABLE_ATTEMPTS = 4;
const UNAVAILABLE_BASE_MS = 1_000;
const UNAVAILABLE_MAX_MS = 8_000;

interface Classified {
  kind: EmbeddingErrorKind;
  retryAfterMs?: number;
}

function unwrap(error: unknown): unknown {
  // The AI SDK wraps repeated failures in a RetryError that keeps the last one.
  if (error && typeof error === "object" && "lastError" in error && error.lastError) {
    return error.lastError;
  }
  return error;
}

function classify(raw: unknown): Classified {
  const error = unwrap(raw);

  if (LoadAPIKeyError.isInstance(error)) return { kind: "not_configured" };

  if (APICallError.isInstance(error)) {
    const status = error.statusCode;
    const message = error.message ?? "";

    if (status === 429 || /quota|rate.?limit|resource.?exhausted/i.test(message)) {
      const header = error.responseHeaders?.["retry-after"];
      const seconds = header ? Number(header) : NaN;
      return {
        kind: "rate_limit",
        retryAfterMs: Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : undefined,
      };
    }
    if (status === 401 || status === 403 || /api key/i.test(message)) {
      return { kind: "auth" };
    }
    if ((status !== undefined && status >= 500) || error.isRetryable) {
      return { kind: "unavailable" };
    }
    if (status === 400) return { kind: "bad_request" };
    return { kind: "unknown" };
  }

  // fetch() throws a TypeError when the network is down.
  if (error instanceof TypeError) return { kind: "unavailable" };
  return { kind: "unknown" };
}

/**
 * Run one call to the AI service. Waits and retries when the service is
 * rate limiting or briefly down, and stops with a clear error otherwise.
 */
async function withRetry<T>(call: () => Promise<T>, options: EmbedOptions): Promise<T> {
  const sleep = options.sleep ?? realSleep;
  const now = options.now ?? Date.now;

  for (let attempt = 0; ; attempt++) {
    try {
      return await call();
    } catch (error) {
      const { kind, retryAfterMs } = classify(error);
      const attemptsAllowed =
        kind === "rate_limit"
          ? RATE_LIMIT_ATTEMPTS
          : kind === "unavailable"
            ? UNAVAILABLE_ATTEMPTS
            : 0;

      if (attempt + 1 >= attemptsAllowed) {
        throw new EmbeddingError(kind, `Embedding failed (${kind}).`, { cause: error });
      }

      const backoff =
        kind === "rate_limit"
          ? Math.min(RATE_LIMIT_MAX_MS, RATE_LIMIT_BASE_MS * 2 ** attempt)
          : Math.min(UNAVAILABLE_MAX_MS, UNAVAILABLE_BASE_MS * 2 ** attempt);
      const wait = retryAfterMs ?? backoff;

      if (options.deadline !== undefined && now() + wait > options.deadline) {
        throw new EmbeddingError("timeout", "Ran out of time while waiting to retry.", {
          cause: error,
        });
      }
      await sleep(wait);
    }
  }
}

function toUnitVector(values: number[]): Float32Array {
  if (values.length !== EMBEDDING_DIMENSIONS) {
    throw new EmbeddingError(
      "unknown",
      `Expected ${EMBEDDING_DIMENSIONS} numbers per vector but got ${values.length}.`,
    );
  }
  // Google only pre-normalizes the full 3072-number vectors, so we do it ourselves.
  return normalize(values);
}

/** Embed document chunks, in order, in small batches. */
export async function embedDocumentChunks(
  texts: string[],
  options: EmbedOptions = {},
): Promise<Float32Array[]> {
  const model = options.model ?? getEmbeddingModel();
  const vectors: Float32Array[] = [];

  for (let start = 0; start < texts.length; start += EMBED_BATCH_SIZE) {
    const batch = texts.slice(start, start + EMBED_BATCH_SIZE);

    const { embeddings } = await withRetry(
      () =>
        embedMany({
          model,
          values: batch,
          maxRetries: 0, // withRetry does the waiting, so we control it
          providerOptions: {
            google: {
              outputDimensionality: EMBEDDING_DIMENSIONS,
              taskType: "RETRIEVAL_DOCUMENT",
            },
          },
        }),
      options,
    );

    if (embeddings.length !== batch.length) {
      throw new EmbeddingError(
        "unknown",
        `Sent ${batch.length} texts but received ${embeddings.length} vectors.`,
      );
    }
    for (const values of embeddings) vectors.push(toUnitVector(values));
  }

  return vectors;
}

/** Embed a search question. Uses the query task type, which pairs with document vectors. */
export async function embedQuery(
  text: string,
  options: EmbedOptions = {},
): Promise<Float32Array> {
  const model = options.model ?? getEmbeddingModel();
  const now = options.now ?? Date.now;

  // Someone is waiting on this one, so give up sooner than a background job would.
  const deadline = options.deadline ?? now() + 15_000;

  const { embedding } = await withRetry(
    () =>
      embed({
        model,
        value: text,
        maxRetries: 0,
        providerOptions: {
          google: {
            outputDimensionality: EMBEDDING_DIMENSIONS,
            taskType: "RETRIEVAL_QUERY",
          },
        },
      }),
    { ...options, deadline },
  );

  return toUnitVector(embedding);
}
