"use client";

import { useRef, useState } from "react";
import { CHAT_MAX_MESSAGE_CHARS, CHAT_PAGES_HEADER } from "./constants";

export interface ChatTurn {
  id: string;
  role: "user" | "assistant";
  content: string;
  // "streaming": words are still arriving. "done": finished (or stopped by the
  // person). "error": it failed; `content` holds whatever arrived before that.
  state: "streaming" | "done" | "error";
  error?: string;
  // The pages this answer was allowed to cite. Citations of other pages are made up.
  pages: number[];
}

const NETWORK_ERROR = "Couldn't reach DocLens. Check your connection and try again.";
const CUT_OFF_ERROR = "The answer was cut off. Ask again to get the whole thing.";

/**
 * Conversations with documents. One conversation per document, kept in memory
 * while the page is open, so switching documents or panels doesn't lose them.
 * Only one answer streams at a time.
 */
export function useDocumentChat() {
  const [chats, setChats] = useState<Record<string, ChatTurn[]>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const controller = useRef<AbortController | null>(null);
  const counter = useRef(0);

  function patch(documentId: string, turnId: string, change: Partial<ChatTurn>) {
    setChats((current) => ({
      ...current,
      [documentId]: (current[documentId] ?? []).map((turn) =>
        turn.id === turnId ? { ...turn, ...change } : turn,
      ),
    }));
  }

  async function ask(documentId: string, text: string) {
    const question = text.trim().slice(0, CHAT_MAX_MESSAGE_CHARS);
    if (!question || busyId) return;

    const userTurn: ChatTurn = {
      id: `t${++counter.current}`,
      role: "user",
      content: question,
      state: "done",
      pages: [],
    };
    const answerTurn: ChatTurn = {
      id: `t${++counter.current}`,
      role: "assistant",
      content: "",
      state: "streaming",
      pages: [],
    };

    // The model sees every finished turn plus the new question. A turn that
    // failed is left out, so a half answer never becomes part of the history.
    const history = (chats[documentId] ?? [])
      .filter((turn) => turn.state === "done" && turn.content)
      .map((turn) => ({ role: turn.role, content: turn.content }));

    setChats((current) => ({
      ...current,
      [documentId]: [...(current[documentId] ?? []), userTurn, answerTurn],
    }));
    setBusyId(documentId);

    const abort = new AbortController();
    controller.current = abort;
    let received = "";

    try {
      const response = await fetch(`/api/documents/${documentId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [...history, { role: "user", content: question }] }),
        signal: abort.signal,
      });

      if (!response.ok || !response.body) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        patch(documentId, answerTurn.id, {
          state: "error",
          error: body?.error ?? "Couldn't get an answer. Try again.",
        });
        return;
      }

      const pages = (response.headers.get(CHAT_PAGES_HEADER) ?? "")
        .split(",")
        .map(Number)
        .filter((page) => Number.isInteger(page) && page > 0);
      patch(documentId, answerTurn.id, { pages });

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        received += decoder.decode(value, { stream: true });
        patch(documentId, answerTurn.id, { content: received });
      }
      received += decoder.decode();
      patch(documentId, answerTurn.id, { content: received, state: "done" });
    } catch {
      if (abort.signal.aborted) {
        // The person pressed Stop. What has arrived is a fine (shorter) answer.
        patch(documentId, answerTurn.id, { content: received, state: "done" });
      } else {
        patch(documentId, answerTurn.id, {
          content: received,
          state: "error",
          error: received ? CUT_OFF_ERROR : NETWORK_ERROR,
        });
      }
    } finally {
      controller.current = null;
      setBusyId(null);
    }
  }

  function stop() {
    controller.current?.abort();
  }

  function clear(documentId: string) {
    if (busyId === documentId) controller.current?.abort();
    setChats((current) => {
      const next = { ...current };
      delete next[documentId];
      return next;
    });
  }

  return {
    turnsFor: (documentId: string) => chats[documentId] ?? [],
    busyId,
    ask,
    stop,
    clear,
  };
}

export type DocumentChat = ReturnType<typeof useDocumentChat>;
