import "server-only";
import { analyzeDocument, type AnalyzeOptions } from "@/lib/ai/analyze";
import { EMBEDDING_DIMENSIONS, EMBEDDING_MODEL_ID, ANALYSIS_MODEL_ID } from "@/lib/ai/config";
import { embedDocumentChunks, type EmbedOptions } from "@/lib/ai/embed";
import { analysisUserMessage, userMessage } from "@/lib/ai/errors";
import { PROCESSING_BUDGET_MS } from "@/lib/constants";
import type { Chunk } from "./chunk";
import { failAnalysis, failProcessing, finishAnalysis, finishProcessing } from "./store";

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

interface AnalyzeInput {
  userId: string;
  documentId: string;
  title: string;
  /** Text of every page in order. pages[0] is page 1. */
  pages: string[];
}

/**
 * Analyze a document and save the result: summary, key points, names and
 * numbers, and action items. Runs in the background, like embedAndStoreChunks,
 * and also never throws. The document's analysisStatus must already be
 * "processing" (createProcessingDocument and beginAnalysis both set it).
 *
 * It is independent of search: if this fails the document stays searchable,
 * and if search preparation fails the analysis can still succeed.
 */
export async function analyzeAndStoreDocument(
  input: AnalyzeInput,
  analyzeOptions: AnalyzeOptions = {},
) {
  const { userId, documentId, title, pages } = input;

  try {
    const content = await analyzeDocument(
      { title, pages },
      { deadline: Date.now() + PROCESSING_BUDGET_MS, ...analyzeOptions },
    );

    await finishAnalysis({ userId, documentId, content, model: ANALYSIS_MODEL_ID });
  } catch (error) {
    console.error(`Analyzing document ${documentId} failed:`, error);
    try {
      await failAnalysis(userId, documentId, analysisUserMessage(error));
    } catch (innerError) {
      console.error(`Could not mark analysis of ${documentId} as failed:`, innerError);
    }
  }
}
