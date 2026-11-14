"use client";

import { SendHorizontal, Square, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cleanAnswerText, splitCitations, validPages } from "@/lib/citations";
import { CHAT_MAX_MESSAGE_CHARS } from "@/lib/constants";
import type { DocumentChat, ChatTurn } from "@/lib/use-chat";
import type { DocumentSummary } from "@/lib/types";

interface ChatPanelProps {
  document: DocumentSummary | null;
  chat: DocumentChat;
  /** Opens a page of the selected document in the Text tab. */
  onOpenPage: (page: number) => void;
}

const STARTERS = [
  "What is this document about?",
  "What are the most important dates and amounts?",
  "What am I expected to do?",
];

function CitationChip({ page, onOpenPage }: { page: number; onOpenPage: (page: number) => void }) {
  return (
    <button
      type="button"
      onClick={() => onOpenPage(page)}
      aria-label={`Open page ${page}`}
      className="mx-0.5 rounded-[4px] bg-mark px-1.5 py-px align-baseline text-xs font-semibold text-on-mark transition-opacity hover:opacity-80"
    >
      p.{page}
    </button>
  );
}

// One line of an answer, with its [p.8] markers turned into page chips.
function AnswerLine({
  text,
  turn,
  onOpenPage,
}: {
  text: string;
  turn: ChatTurn;
  onOpenPage: (page: number) => void;
}) {
  const streaming = turn.state === "streaming";
  return (
    <>
      {splitCitations(text, streaming).map((segment, i) => {
        if (segment.type === "text") return <span key={i}>{segment.text}</span>;
        // A page the model was never shown is made up, so it gets no chip.
        return validPages(segment.pages, turn.pages).map((page) => (
          <CitationChip key={`${i}-${page}`} page={page} onOpenPage={onOpenPage} />
        ));
      })}
    </>
  );
}

function AnswerText({ turn, onOpenPage }: { turn: ChatTurn; onOpenPage: (page: number) => void }) {
  const lines = cleanAnswerText(turn.content).split("\n");
  return (
    <div className="space-y-2 text-[15px] leading-[1.7]">
      {lines.map((line, i) => {
        if (!line.trim()) return null;
        if (line.startsWith("- ")) {
          return (
            <div key={i} className="flex gap-2">
              <span aria-hidden className="text-muted">
                &bull;
              </span>
              <p className="min-w-0 flex-1">
                <AnswerLine text={line.slice(2)} turn={turn} onOpenPage={onOpenPage} />
              </p>
            </div>
          );
        }
        return (
          <p key={i}>
            <AnswerLine text={line} turn={turn} onOpenPage={onOpenPage} />
          </p>
        );
      })}
    </div>
  );
}

function Turn({ turn, onOpenPage }: { turn: ChatTurn; onOpenPage: (page: number) => void }) {
  if (turn.role === "user") {
    return (
      <div className="flex justify-end">
        <p className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-raised px-3.5 py-2.5 text-[15px] leading-relaxed">
          {turn.content}
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-[95%]">
      {turn.content ? (
        <AnswerText turn={turn} onOpenPage={onOpenPage} />
      ) : (
        turn.state === "streaming" && (
          <p role="status" className="text-sm text-muted">
            Reading the document...
          </p>
        )
      )}
      {turn.state === "error" && (
        <p role="alert" className="mt-2 text-sm leading-relaxed text-danger">
          {turn.error}
        </p>
      )}
    </div>
  );
}

function notReadyMessage(document: DocumentSummary) {
  if (document.status === "processing") {
    return "This document is still being prepared for search. You can ask questions as soon as it's ready.";
  }
  if (document.status === "failed") {
    return "This document couldn't be prepared for search, so it can't be asked questions. You can still read it.";
  }
  return "This document was uploaded before search was added. Delete it and upload it again to ask it questions.";
}

export function ChatPanel({ document, chat, onOpenPage }: ChatPanelProps) {
  const [draft, setDraft] = useState("");
  const scroller = useRef<HTMLDivElement>(null);

  const turns = document ? chat.turnsFor(document.id) : [];
  const busy = chat.busyId !== null;
  const busyHere = document !== null && chat.busyId === document.id;
  const ready = document !== null && document.searchable;
  const lastContent = turns[turns.length - 1]?.content;

  // Keep the newest words in view while an answer streams.
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [turns.length, lastContent]);

  function submit(text: string) {
    if (!document || !ready || busy) return;
    const question = text.trim();
    if (!question) return;
    setDraft("");
    void chat.ask(document.id, question);
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold">Ask this document</h2>
          {document && <p className="mt-0.5 truncate text-xs text-muted">{document.title}</p>}
        </div>
        {turns.length > 0 && document && (
          <button
            type="button"
            onClick={() => chat.clear(document.id)}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-xs text-muted transition-colors hover:bg-raised hover:text-text"
          >
            <Trash2 size={14} aria-hidden="true" />
            Clear
          </button>
        )}
      </div>

      <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto px-4 py-4" aria-live="polite">
        {!document && (
          <p className="mx-auto mt-10 max-w-xs text-center text-sm leading-relaxed text-muted">
            Select a document to ask it questions. Answers point to the page they came from,
            so you can check them.
          </p>
        )}

        {document && !ready && (
          <p className="mx-auto mt-10 max-w-xs text-center text-sm leading-relaxed text-muted">
            {notReadyMessage(document)}
          </p>
        )}

        {ready && turns.length === 0 && (
          <div className="mx-auto mt-6 max-w-sm">
            <p className="text-center font-serif text-[17px] leading-[1.7] text-muted">
              Ask anything about this document. Answers point to the page they came from.
            </p>
            <ul className="mt-5 space-y-2">
              {STARTERS.map((starter) => (
                <li key={starter}>
                  <button
                    type="button"
                    onClick={() => submit(starter)}
                    disabled={busy}
                    className="w-full rounded-xl border border-line bg-ink px-3.5 py-2.5 text-left text-sm transition-colors hover:border-mark disabled:opacity-50"
                  >
                    {starter}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {turns.length > 0 && (
          <div className="space-y-5">
            {turns.map((turn) => (
              <Turn key={turn.id} turn={turn} onOpenPage={onOpenPage} />
            ))}
            <p className="pt-1 text-xs leading-relaxed text-muted">
              Written by AI from the document&rsquo;s text. Check anything important against
              the cited pages.
            </p>
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(draft);
        }}
        className="border-t border-line p-3"
      >
        <div className="flex items-end gap-2 rounded-xl border border-line bg-ink px-3 py-2 focus-within:border-mark">
          <label htmlFor="question" className="sr-only">
            Question
          </label>
          <textarea
            id="question"
            rows={1}
            value={draft}
            maxLength={CHAT_MAX_MESSAGE_CHARS}
            disabled={!ready}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              // Enter sends, Shift+Enter adds a line. Don't send mid-composition (IME).
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                submit(draft);
              }
            }}
            placeholder={ready ? "Ask a question" : "Select a ready document to start asking"}
            className="max-h-32 min-h-6 min-w-0 flex-1 resize-none bg-transparent py-1 text-sm [field-sizing:content] placeholder:text-muted/70 focus:outline-none disabled:cursor-not-allowed"
          />
          {busyHere ? (
            <button
              type="button"
              onClick={chat.stop}
              aria-label="Stop answering"
              className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-line text-text transition-colors hover:bg-raised"
            >
              <Square size={14} aria-hidden="true" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!ready || busy || !draft.trim()}
              aria-label="Send question"
              className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-mark text-on-mark transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              <SendHorizontal size={16} aria-hidden="true" />
            </button>
          )}
        </div>
        {busy && !busyHere && (
          <p className="mt-2 text-xs text-muted">
            Another document is still answering. Wait for it to finish.
          </p>
        )}
      </form>
    </div>
  );
}
