import { google } from "@ai-sdk/google";
import { ANALYSIS_FALLBACK_MODEL_ID, ANALYSIS_MODEL_ID } from "./config";

/**
 * The model that reads documents and writes text (the analysis now, chat
 * answers in Phase 5). Uses the same GOOGLE_GENERATIVE_AI_API_KEY as embeddings.
 */
export function getLanguageModel() {
  return google(ANALYSIS_MODEL_ID);
}

/** The backup model, or null when no backup is configured. */
export function getFallbackLanguageModel() {
  return ANALYSIS_FALLBACK_MODEL_ID ? google(ANALYSIS_FALLBACK_MODEL_ID) : null;
}
