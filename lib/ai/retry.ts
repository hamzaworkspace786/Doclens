import {
  APICallError,
  NoObjectGeneratedError,
  NoOutputGeneratedError,
} from "ai";
import { LoadAPIKeyError } from "@ai-sdk/provider";
import { AiError, type AiErrorKind } from "./errors";

// Waiting and retrying around calls to the AI service. Shared by embeddings
// (lib/ai/embed.ts) and analysis (lib/ai/analyze.ts) so both behave the same.

export interface RetryOptions {
  /** Epoch milliseconds. We stop waiting and retrying after this moment. */
  deadline?: number;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
}

/** Builds the error to throw, so each caller can throw its own error class. */
export type ErrorFactory = (kind: AiErrorKind, message: string, cause: unknown) => AiError;

const realSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

// How many attempts each kind of failure gets, and how long to wait between them.
// Anything not listed here is not retried.
const POLICY: Partial<
  Record<AiErrorKind, { attempts: number; baseMs: number; maxMs: number }>
> = {
  // Free-tier limits reset every minute, so we wait up to a minute.
  rate_limit: { attempts: 8, baseMs: 15_000, maxMs: 60_000 },
  // "High demand" 503s from Google can last a minute or more, so waits are
  // 5s, 10s, 20s, 40s (75 seconds in total) before giving up.
  unavailable: { attempts: 5, baseMs: 5_000, maxMs: 60_000 },
  // The AI answered with something unreadable. One more try is often enough.
  bad_output: { attempts: 2, baseMs: 500, maxMs: 500 },
};

interface Classified {
  kind: AiErrorKind;
  retryAfterMs?: number;
}

function unwrap(error: unknown): unknown {
  // The AI SDK wraps repeated failures in a RetryError that keeps the last one.
  if (error && typeof error === "object" && "lastError" in error && error.lastError) {
    return error.lastError;
  }
  return error;
}

export function classify(raw: unknown): Classified {
  const error = unwrap(raw);

  if (LoadAPIKeyError.isInstance(error)) return { kind: "not_configured" };

  // Errors we threw ourselves already know what kind they are.
  if (error instanceof AiError) return { kind: error.kind };

  if (NoObjectGeneratedError.isInstance(error) || NoOutputGeneratedError.isInstance(error)) {
    return { kind: "bad_output" };
  }

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

  // A call we cancelled because it took too long (AbortSignal.timeout).
  if (
    error &&
    typeof error === "object" &&
    "name" in error &&
    (error.name === "TimeoutError" || error.name === "AbortError")
  ) {
    return { kind: "timeout" };
  }

  // fetch() throws a TypeError when the network is down.
  if (error instanceof TypeError) return { kind: "unavailable" };
  return { kind: "unknown" };
}

/**
 * Run one call to the AI service. Waits and retries when the service is
 * rate limiting or briefly down, and stops with a clear error otherwise.
 */
export async function withRetry<T>(
  call: () => Promise<T>,
  options: RetryOptions,
  makeError: ErrorFactory,
): Promise<T> {
  const sleep = options.sleep ?? realSleep;
  const now = options.now ?? Date.now;

  for (let attempt = 0; ; attempt++) {
    try {
      return await call();
    } catch (error) {
      const { kind, retryAfterMs } = classify(error);
      const policy = POLICY[kind];

      if (!policy || attempt + 1 >= policy.attempts) {
        throw makeError(kind, `The AI request failed (${kind}).`, error);
      }

      const backoff = Math.min(policy.maxMs, policy.baseMs * 2 ** attempt);
      const wait = retryAfterMs ?? backoff;

      if (options.deadline !== undefined && now() + wait > options.deadline) {
        throw makeError("timeout", "Ran out of time while waiting to retry.", error);
      }
      await sleep(wait);
    }
  }
}
