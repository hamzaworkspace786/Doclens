"use client";

import { useCallback, useRef, useState } from "react";
import { CHAT_MAX_MESSAGE_CHARS, CHAT_PAGES_HEADER } from "./constants";
import type { SavedChatMessage } from "./types";

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

export type HistoryState = "loading" | "loaded" | "failed";

const NETWORK_ERROR = "Couldn't reach DocLens. Check your connection and try again.";
const CUT_OFF_ERROR = "The answer was cut off. Ask again to get the whole thing.";

/**
 * Conversations with documents. One conversation per document. Each finished
 * answer is saved on the server, and the saved conversation is loaded the first
 * time a document is opened, so it survives a refresh. Only one answer streams
 * at a time.
 */
export function useDocumentChat() {
  const [chats, setChats] = useState<Record<string, ChatTurn[]>>({});
  const [history, setHistory] = useState<Record<string, "loaded" | "failed">>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const controller = useRef<AbortController | null>(null);
  const counter = useRef(0);
  const requested = useRef(new Set<string>());

  /**
   * Load the saved conversation of a document. Safe to call on every render:
   * it asks the server once per document, and again only after a failure.
   */
  const load = useCallback(async (documentId: string) => {
    if (requested.current.has(documentId)) return;
    requested.current.add(documentId);

    try {
      const response = await fetch(`/api/documents/${documentId}/chat`);
      const body = (await response.json().catch(() => null)) as {
        messages?: SavedChatMessage[];
      } | null;
      if (!response.ok || !body?.messages) throw new Error("Could not load the conversation.");

      const saved: ChatTurn[] = body.messages.map((message) => ({
        id: `saved-${message.id}`,
        role: message.role,
        content: message.content,
        state: "done",
        pages: message.pages,
      }));
      // If the person has already started a conversation, keep that one.
      setChats((current) =>
        current[documentId]?.length ? current : { ...current, [documentId]: saved },
      );
      setHistory((current) => ({ ...current, [documentId]: "loaded" }));
    } catch {
      requested.current.delete(documentId); // so "Try again" can ask again
      setHistory((current) => ({ ...current, [documentId]: "failed" }));
    }
  }, []);

  function historyFor(documentId: string): HistoryState {
    return history[documentId] ?? "loading";
  }

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
    if (!question || busyId || historyFor(documentId) === "loading") return;

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

    // The model sees every question that has a finished answer, with that
    // answer. A question whose answer failed is left out with it, so a half
    // answer never becomes part of the history.
    const turns = chats[documentId] ?? [];
    const earlier: { role: "user" | "assistant"; content: string }[] = [];
    for (let i = 0; i < turns.length - 1; i++) {
      const asked = turns[i];
      const answered = turns[i + 1];
      if (
        asked.role === "user" &&
        answered.role === "assistant" &&
        answered.state === "done" &&
        answered.content
      ) {
        earlier.push(
          { role: "user", content: asked.content },
          { role: "assistant", content: answered.content },
        );
      }
    }

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
        body: JSON.stringify({ messages: [...earlier, { role: "user", content: question }] }),
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

  /**
   * Delete a document's conversation here and on the server. Resolves with null
   * when it worked, or a message to show when it could not.
   */
  async function clear(documentId: string): Promise<string | null> {
    try {
      const response = await fetch(`/api/documents/${documentId}/chat`, { method: "DELETE" });
      if (!response.ok) return "Couldn't clear this conversation. Try again.";
    } catch {
      return "Couldn't clear this conversation. Check your connection and try again.";
    }
    setChats((current) => {
      const next = { ...current };
      delete next[documentId];
      return next;
    });
    return null;
  }

  return {
    turnsFor: (documentId: string) => chats[documentId] ?? [],
    historyFor,
    load,
    busyId,
    ask,
    stop,
    clear,
  };
}

export type DocumentChat = ReturnType<typeof useDocumentChat>;
