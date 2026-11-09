const tabs = ["Summary", "Key points", "Names and numbers", "Action items"];

// Phase 4 fills these tabs with the structured analysis of the selected document.
export function AnalysisPanel() {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-line px-5 pt-4">
        <h2 className="text-[15px] font-semibold">No document selected</h2>
        <div role="tablist" aria-label="Analysis sections" className="mt-3 flex gap-5 overflow-x-auto">
          {tabs.map((tab, i) => (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={i === 0}
              disabled
              className={`-mb-px whitespace-nowrap border-b-2 pb-2.5 text-sm ${
                i === 0
                  ? "border-mark font-medium text-text"
                  : "border-transparent text-muted"
              } disabled:cursor-not-allowed`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 items-center justify-center px-8">
        <p className="max-w-sm text-center font-serif text-[17px] leading-[1.7] text-muted">
          Pick a document to see its summary, key points, and action items.
          The analysis appears a few seconds after you upload.
        </p>
      </div>
    </div>
  );
}
