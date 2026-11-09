import { Upload } from "lucide-react";

// Phase 2 turns the Upload button and the drop area into a real uploader
// and fills this panel with the user's documents.
export function DocRail() {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
        <h2 className="text-[15px] font-semibold">Documents</h2>
        <button
          type="button"
          disabled
          className="inline-flex items-center gap-1.5 rounded-lg bg-mark px-3 py-1.5 text-sm font-semibold text-on-mark disabled:opacity-50"
        >
          <Upload size={15} aria-hidden="true" />
          Upload
        </button>
      </div>

      <div className="flex min-h-0 flex-1 p-4">
        <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-line px-5 text-center">
          <p className="text-[15px] font-medium">No documents yet</p>
          <p className="mt-1.5 text-sm leading-relaxed text-muted">
            Drop a PDF, Word file, or text file here. Files can be up to 4 MB.
          </p>
        </div>
      </div>
    </div>
  );
}
