// gemini-embedding-001 is Google's stable embedding model. 768 is one of the
// sizes Google recommends, and it keeps storage small. If you change either
// value, existing documents stop being searchable until they are re-processed
// (the store compares both values before allowing search).
export const EMBEDDING_MODEL_ID = "gemini-embedding-001";
export const EMBEDDING_DIMENSIONS = 768;
