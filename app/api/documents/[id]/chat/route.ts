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
import {
  appendChatTurn,
  clearChat,
  getAnalysis,
  getChatMessages,
  getDocument,
} from "@/lib/documents/store";
import { getUserOrNull } from "@/lib/session";
import { limitResponse } from "@/lib/limit-response";
import { consume } from "@/lib/usage";

// An answer streams for up to CHAT_TOTAL_TIMEOUT_MS, plus the search before it.
export const maxDuration = 120;

type Context = { params: Promise<{ id: string }> };

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

/** The saved conversation about one document, oldest message first. */
export async function GET(_request: Request, { params }: Context) {
  const user = await getUserOrNull();
  if (!user) return errorResponse("Please sign in.", 401);

  const { id } = await params;
  const document = await getDocument(user.id, id);
  if (!document) return errorResponse("Document not found.", 404);

  return NextResponse.json({ messages: await getChatMessages(user.id, id) });
}

/** Forget the saved conversation about one document. */
export async function DELETE(_request: Request, { params }: Context) {
  const user = await getUserOrNull();
  if (!user) return errorResponse("Please sign in.", 401);

  const { id } = await params;
  const document = await getDocument(user.id, id);
  if (!document) return errorResponse("Document not found.", 404);

  await clearChat(user.id, id);
  return NextResponse.json({ ok: true });
}

/**
 * Ask a question about one document. The body is { messages: [...] }, the
 * conversation so far ending with the new question. The answer streams back
 * as plain text; the pages it may cite are listed in a response header.
 * Once the answer is complete, the question and answer are saved.
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
  const question = messages[messages.length - 1].content;

  if (!isEmbeddingConfigured()) {
    return errorResponse(
      "AI features aren't set up on this server yet. Add GOOGLE_GENERATIVE_AI_API_KEY to the environment and restart.",
      503,
    );
  }

  const { id } = await params;

  const document = await getDocument(user.id, id);
  if (!document) return errorResponse("Document not found.", 404);

  // The question is valid and the document is the person's. From here on it
  // costs AI calls, so it counts toward their and the site's allowance.
  const usage = await consume(user.id, "question");
  if (!usage.ok) return limitResponse(usage);

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

  const encoder = new TextEncoder();
  const userId = user.id;
  let answerText = first.value;

  // Save the question and what was answered, once. This runs when the answer
  // finishes, and also when the person presses Stop (the partial answer is kept,
  // the same as on their screen). It does not run when the answer failed.
  let finished = false;
  async function saveTurn() {
    if (finished) return;
    finished = true;
    if (!answerText.trim()) return;
    try {
      await appendChatTurn({
        userId,
        documentId: id,
        question,
        answer: answerText,
        pages: allowedPages,
      });
    } catch (error) {
      // The answer was shown; failing to save it must not turn it into an error.
      console.error("Could not save a chat turn:", error);
    }
  }

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(answerText));
    },
    async pull(controller) {
      try {
        const next = await answer.next();
        if (next.done) {
          await saveTurn();
          try {
            controller.close();
          } catch {
            // Already cancelled by the reader.
          }
        } else {
          answerText += next.value;
          controller.enqueue(encoder.encode(next.value));
        }
      } catch (error) {
        // Words have already been sent, so all we can do is end the stream with
        // an error. The browser keeps what it has and says the answer was cut off.
        // A failed answer is not saved.
        finished = true;
        console.error("A chat answer was cut off:", error);
        controller.error(error);
      }
    },
    async cancel() {
      await answer.return(undefined);
      await saveTurn();
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
