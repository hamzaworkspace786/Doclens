import { NextResponse } from "next/server";
import {
  citablePages,
  formatOverview,
  parseMessages,
  retrievalQuery,
  streamAnswer,
} from "@/lib/ai/chat";
import { isEmbeddingConfigured } from "@/lib/ai/embedding-model";
import { ChatError, EmbeddingError, chatUserMessage, userMessage } from "@/lib/ai/errors";
import { CHAT_EXCERPT_COUNT, CHAT_PAGES_HEADER } from "@/lib/constants";
import { SearchNotReadyError, searchDocument } from "@/lib/documents/search";
import { getAnalysis, getDocument } from "@/lib/documents/store";
import { getUserOrNull } from "@/lib/session";

// An answer streams for up to CHAT_TOTAL_TIMEOUT_MS, plus the search before it.
export const maxDuration = 120;

type Context = { params: Promise<{ id: string }> };

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

/**
 * Ask a question about one document. The body is { messages: [...] }, the
 * conversation so far ending with the new question. The answer streams back
 * as plain text; the pages it may cite are listed in a response header.
 */
export async function POST(request: Request, { params }: Context) {
  const user = await getUserOrNull();
  if (!user) return errorResponse("Please sign in.", 401);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("The question could not be read. Try again.", 400);
  }

  const parsed = parseMessages(body);
  if ("error" in parsed) return errorResponse(parsed.error, 400);
  const { messages } = parsed;

  if (!isEmbeddingConfigured()) {
    return errorResponse(
      "AI features aren't set up on this server yet. Add GOOGLE_GENERATIVE_AI_API_KEY to the environment and restart.",
      503,
    );
  }

  const { id } = await params;

  const document = await getDocument(user.id, id);
  if (!document) return errorResponse("Document not found.", 404);

  // 1. Find the passages closest in meaning to the question.
  let hits;
  try {
    hits = await searchDocument(user.id, id, retrievalQuery(messages), {}, CHAT_EXCERPT_COUNT);
  } catch (error) {
    if (error instanceof SearchNotReadyError) return errorResponse(error.message, 409);
    console.error("Finding passages for a chat question failed:", error);
    if (error instanceof EmbeddingError) return errorResponse(userMessage(error), 503);
    return errorResponse("Something went wrong while answering. Try again.", 500);
  }
  if (hits === null) return errorResponse("Document not found.", 404);

  // 2. The earlier analysis helps with broad questions ("what is this about?").
  const stored = await getAnalysis(user.id, id);
  const excerpts = hits.map((hit) => ({ page: hit.page, text: hit.text }));
  const allowedPages = citablePages(excerpts, stored?.content ?? null);

  // 3. Start the answer. We wait for the first words before replying, so a
  //    total failure can still come back as a clean error with a status code.
  const answer = streamAnswer(
    {
      title: document.title,
      pageCount: document.pageCount,
      overview: stored ? formatOverview(stored.content) : null,
      excerpts,
      messages,
    },
    { signal: request.signal },
  );

  let first: IteratorResult<string>;
  try {
    first = await answer.next();
  } catch (error) {
    console.error("Answering a chat question failed:", error);
    if (error instanceof ChatError) {
      return errorResponse(chatUserMessage(error), error.kind === "bad_request" ? 400 : 503);
    }
    return errorResponse("Something went wrong while answering. Try again.", 500);
  }
  if (first.done) {
    // The reader went away before anything arrived. Nobody is listening.
    return new Response(null, { status: 204 });
  }

  const firstPiece = first.value;
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(firstPiece));
    },
    async pull(controller) {
      try {
        const next = await answer.next();
        if (next.done) controller.close();
        else controller.enqueue(encoder.encode(next.value));
      } catch (error) {
        // Words have already been sent, so all we can do is end the stream with
        // an error. The browser keeps what it has and says the answer was cut off.
        console.error("A chat answer was cut off:", error);
        controller.error(error);
      }
    },
    async cancel() {
      await answer.return(undefined);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      [CHAT_PAGES_HEADER]: allowedPages.join(","),
    },
  });
}
