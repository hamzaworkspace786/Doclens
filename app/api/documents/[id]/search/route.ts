import { NextResponse } from "next/server";
import { EmbeddingError, userMessage } from "@/lib/ai/errors";
import { MAX_QUERY_CHARS } from "@/lib/constants";
import { SearchNotReadyError, searchDocument } from "@/lib/documents/search";
import { getUserOrNull } from "@/lib/session";

type Context = { params: Promise<{ id: string }> };

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: Request, { params }: Context) {
  const user = await getUserOrNull();
  if (!user) return errorResponse("Please sign in.", 401);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("The search could not be read. Try again.", 400);
  }

  const raw = (body as { query?: unknown } | null)?.query;
  const query = typeof raw === "string" ? raw.trim() : "";
  if (!query) return errorResponse("Type something to search for.", 400);
  if (query.length > MAX_QUERY_CHARS) {
    return errorResponse(`Keep your search under ${MAX_QUERY_CHARS} characters.`, 400);
  }

  const { id } = await params;

  try {
    const results = await searchDocument(user.id, id, query);
    if (results === null) return errorResponse("Document not found.", 404);
    return NextResponse.json({ results });
  } catch (error) {
    if (error instanceof SearchNotReadyError) {
      return errorResponse(error.message, 409);
    }
    console.error("Document search failed:", error);
    if (error instanceof EmbeddingError) {
      return errorResponse(userMessage(error), 503);
    }
    return errorResponse("Something went wrong while searching. Try again.", 500);
  }
}
