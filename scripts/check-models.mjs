// Checks how fast each Gemini model answers on YOUR key, right now.
//
// Run from the project folder:
//   node --env-file=.env.local scripts/check-models.mjs
//
// It sends one tiny question to each model, one after another, and prints how
// long the answer took or what went wrong. A model that prints "no answer
// after 45s" is the one that hangs during analysis. Nothing is saved anywhere.

import { generateText } from "ai";
import { google } from "@ai-sdk/google";

if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
  console.error("GOOGLE_GENERATIVE_AI_API_KEY is not set. Run with --env-file=.env.local");
  process.exit(1);
}

const MODELS = [
  "gemini-3.8-flash", // the main analysis model
  "gemini-3.6-flash", // the backup
  "gemini-3.5-flash-lite",
  "gemini-4-hydrogen",
];
const TIMEOUT_MS = 45_000;

for (const id of MODELS) {
  const started = performance.now();
  const seconds = () => ((performance.now() - started) / 1000).toFixed(1);
  try {
    const { text } = await generateText({
      model: google(id),
      prompt: "Reply with one short sentence about rivers.",
      maxRetries: 0,
      abortSignal: AbortSignal.timeout(TIMEOUT_MS),
    });
    console.log(`OK      ${id.padEnd(24)} ${seconds()}s   "${text.trim().slice(0, 60)}"`);
  } catch (error) {
    const name = error?.name ?? "Error";
    if (name === "TimeoutError" || name === "AbortError") {
      console.log(`SLOW    ${id.padEnd(24)} no answer after ${seconds()}s`);
    } else {
      const status = error?.statusCode ? ` (HTTP ${error.statusCode})` : "";
      console.log(`FAILED  ${id.padEnd(24)} ${seconds()}s${status} ${String(error?.message ?? error).slice(0, 110)}`);
    }
  }
}
