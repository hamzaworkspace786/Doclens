import { embed, embedMany, type EmbeddingModel } from "ai";
import { EMBED_BATCH_SIZE } from "../constants";
import { EMBEDDING_DIMENSIONS } from "./config";
import { getEmbeddingModel } from "./embedding-model";
import { EmbeddingError } from "./errors";
import { withRetry, type ErrorFactory, type RetryOptions } from "./retry";
import { normalize } from "./vectors";

export interface EmbedOptions extends RetryOptions {
  /** Defaults to the Google model from embedding-model.ts. Tests pass a mock. */
  model?: EmbeddingModel;
}

// Waiting and retrying live in retry.ts, shared with analysis.
const makeEmbeddingError: ErrorFactory = (kind, message, cause) =>
  new EmbeddingError(kind, message, { cause });

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
      makeEmbeddingError,
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
    makeEmbeddingError,
  );

  return toUnitVector(embedding);
}
