import { NextResponse } from "next/server";
import { analysisToMarkdown, exportFileName } from "@/lib/documents/export";
import { getAnalysis, getDocument } from "@/lib/documents/store";
import { getUserOrNull } from "@/lib/session";

type Context = { params: Promise<{ id: string }> };

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

/** Download the analysis of one document as a Markdown file. */
export async function GET(_request: Request, { params }: Context) {
  const user = await getUserOrNull();
  if (!user) return errorResponse("Please sign in.", 401);

  const { id } = await params;
  const document = await getDocument(user.id, id);
  if (!document) return errorResponse("Document not found.", 404);

  const stored = await getAnalysis(user.id, id);
  if (!stored) return errorResponse("This document hasn't been analyzed yet.", 409);

  const markdown = analysisToMarkdown({
    title: document.title,
    pageCount: document.pageCount,
    pagesAreEstimated: document.pagesAreEstimated,
    analysis: stored.content,
    model: stored.model,
    generatedAt: stored.generatedAt.toISOString(),
  });

  return new Response(markdown, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${exportFileName(document.title)}"`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
