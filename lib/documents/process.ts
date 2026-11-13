import "server-only";
import { EMBEDDING_DIMENSIONS, EMBEDDING_MODEL_ID } from "@/lib/ai/config";
import { embedDocumentChunks, type EmbedOptions } from "@/lib/ai/embed";
import { userMessage } from "@/lib/ai/errors";
import { PROCESSING_BUDGET_MS } from "@/lib/constants";
import type { Chunk } from "./chunk";
import { failProcessing, finishProcessing } from "./store";

interface ProcessInput {
  userId: string;
  documentId: string;
  chunks: Chunk[];
}

/**
 * Turn a document's chunks into vectors and save them. Runs in the background
 * after the upload response has been sent. It never throws: any failure is
 * logged for you and shown to the person as a clear message on the document.
 */
export async function embedAndStoreChunks(
  input: ProcessInput,
  embedOptions: EmbedOptions = {},
) {
  const { userId, documentId, chunks } = input;

  try {
    const vectors = await embedDocumentChunks(
      chunks.map((chunk) => chunk.text),
      { deadline: Date.now() + PROCESSING_BUDGET_MS, ...embedOptions },
    );

    await finishProcessing({
      userId,
      documentId,
      chunks,
      vectors,
      model: EMBEDDING_MODEL_ID,
      dimensions: EMBEDDING_DIMENSIONS,
    });
  } catch (error) {
    console.error(`Preparing document ${documentId} failed:`, error);
    try {
      await failProcessing(userId, documentId, userMessage(error));
    } catch (innerError) {
      console.error(`Could not mark document ${documentId} as failed:`, innerError);
    }
  }
}
