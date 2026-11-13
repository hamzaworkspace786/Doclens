import { google } from "@ai-sdk/google";
import { EMBEDDING_MODEL_ID } from "./config";

/** True when the Google API key is present. Get a free key at aistudio.google.com/apikey */
export function isEmbeddingConfigured() {
  return Boolean(process.env.GOOGLE_GENERATIVE_AI_API_KEY);
}

export function getEmbeddingModel() {
  // Reads GOOGLE_GENERATIVE_AI_API_KEY from the environment.
  return google.textEmbedding(EMBEDDING_MODEL_ID);
}
