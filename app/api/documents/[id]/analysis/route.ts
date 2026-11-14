import { after, NextResponse } from "next/server";
import { isEmbeddingConfigured } from "@/lib/ai/embedding-model";
import { analyzeAndStoreDocument } from "@/lib/documents/process";
import {
  beginAnalysis,
  getAllPages,
  getAnalysis,
  getDocument,
} from "@/lib/documents/store";
import { getUserOrNull } from "@/lib/session";
import type { AnalysisResponse } from "@/lib/types";

// POST runs the analysis in the background after it answers.
export const maxDuration = 300;

type Context = { params: Promise<{ id: string }> };

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

/** The saved analysis of one document. */
export async function GET(_request: Request, { params }: Context) {
  const user = await getUserOrNull();
  if (!user) return errorResponse("Please sign in.", 401);

  const { id } = await params;
  const stored = await getAnalysis(user.id, id);
  if (!stored) return errorResponse("There is no analysis for this document yet.", 404);

  const body: AnalysisResponse = {
    analysis: stored.content,
    model: stored.model,
    generatedAt: stored.generatedAt.toISOString(),
  };
  return NextResponse.json(body);
}

/**
 * Start (or restart) the analysis. Used for documents uploaded before
 * analysis existed and to retry a failed one. Answers 202 straight away; the
 * page then polls the document until analysisStatus changes.
 */
export async function POST(_request: Request, { params }: Context) {
  const user = await getUserOrNull();
  if (!user) return errorResponse("Please sign in.", 401);

  const { id } = await params;
  const document = await getDocument(user.id, id);
  if (!document) return errorResponse("Document not found.", 404);

  if (!isEmbeddingConfigured()) {
    return errorResponse(
      "AI features aren't set up on this server yet. Add GOOGLE_GENERATIVE_AI_API_KEY to the environment and restart.",
      503,
    );
  }

  // Load the text first, so a failure here can't leave the document stuck on "analyzing".
  const pages = await getAllPages(user.id, id);
  if (!pages) return errorResponse("This document has no text to analyze.", 404);

  const started = await beginAnalysis(user.id, id);
  if (!started) return errorResponse("This document is already being analyzed.", 409);

  after(() =>
    analyzeAndStoreDocument({
      userId: user.id,
      documentId: id,
      title: document.title,
      pages,
    }),
  );

  const updated = await getDocument(user.id, id);
  return NextResponse.json(
    { document: updated ?? { ...document, analysisStatus: "processing" as const } },
    { status: 202 },
  );
}
