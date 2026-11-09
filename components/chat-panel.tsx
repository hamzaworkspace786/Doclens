import { SendHorizontal } from "lucide-react";

// Phase 5 streams real answers here, with clickable page citations.
export function ChatPanel() {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-line px-4 py-3">
        <h2 className="text-[15px] font-semibold">Ask this document</h2>
      </div>

      <div className="flex min-h-0 flex-1 items-center justify-center px-6">
        <p className="text-center text-sm leading-relaxed text-muted">
          Answers point to the page they came from, so you can check them.
        </p>
      </div>

      <div className="border-t border-line p-3">
        <div className="flex items-center gap-2 rounded-xl border border-line bg-ink px-3 py-2">
          <label htmlFor="question" className="sr-only">
            Question
          </label>
          <input
            id="question"
            type="text"
            disabled
            placeholder="Select a document to start asking"
            className="min-w-0 flex-1 bg-transparent text-sm placeholder:text-muted/70 focus:outline-none disabled:cursor-not-allowed"
          />
          <button
            type="button"
            disabled
            aria-label="Send question"
            className="grid h-8 w-8 place-items-center rounded-lg bg-mark text-on-mark disabled:opacity-40"
          >
            <SendHorizontal size={16} aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}
