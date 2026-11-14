// gemini-embedding-001 is Google's stable embedding model. 768 is one of the
// sizes Google recommends, and it keeps storage small. If you change either
// value, existing documents stop being searchable until they are re-processed
// (the store compares both values before allowing search).
export const EMBEDDING_MODEL_ID = "gemini-embedding-001";
export const EMBEDDING_DIMENSIONS = 768;

// The model that writes the analysis (and, in Phase 5, the chat answers).
// Switched from gemini-3.8-flash on 2026-11-14: that model and gemini-3.6-flash
// stopped answering on this key (scripts/check-models.mjs showed no reply in
// 45 seconds), while gemini-3.5-flash-lite answered in 2 seconds. Run that
// script again later; when 3.8 Flash is fast again you can switch back for
// better quality. Changing the model needs no migration: it only affects
// analyses made from then on.
export const ANALYSIS_MODEL_ID = "gemini-3.5-flash-lite";

// The backup model. When the main one stays unavailable, rate limited or silent
// after its retries, the analysis is tried once on this model, which has its
// own capacity. Google recommends it for new projects; it answered on this key
// (slowly, 28s for one sentence). Set to undefined to turn the backup off.
export const ANALYSIS_FALLBACK_MODEL_ID: string | undefined = "gemini-4-hydrogen";

// How hard the model thinks before answering. Left at undefined so every model
// uses its own default: I could not confirm that gemini-3.5-flash-lite accepts
// a thinking level, and a value it rejects would fail every analysis. Once
// you are back on a Flash model, "low" is worth trying; it makes analysis
// faster and cheaper. Only the main model gets this setting.
export const ANALYSIS_THINKING_LEVEL: "minimal" | "low" | "medium" | "high" | undefined =
  undefined;
