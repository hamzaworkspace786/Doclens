import type { DocumentSummary, FileType } from "./types";

const fileTypeLabels: Record<FileType, string> = {
  pdf: "PDF",
  docx: "Word",
  txt: "Text",
};

export function fileTypeLabel(type: FileType) {
  return fileTypeLabels[type];
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function describeLength(doc: Pick<DocumentSummary, "pageCount" | "pagesAreEstimated">) {
  const unit = doc.pageCount === 1 ? "page" : "pages";
  return doc.pagesAreEstimated
    ? `about ${doc.pageCount} ${unit}`
    : `${doc.pageCount} ${unit}`;
}

/**
 * PDFs store text line by line, so a sentence can be cut in the middle of a
 * row. This glues lines back into paragraphs for reading. Short lines
 * (headings) and lines that end a sentence stay as their own paragraph.
 * It only changes how text is displayed, never what is stored or searched.
 */
export function reflowPage(text: string): string[] {
  const paragraphs: string[] = [];

  for (const block of text.split(/\n{2,}/)) {
    let current = "";
    for (const line of block.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      if (!current) {
        current = trimmed;
        continue;
      }

      const endsSentence = /[.!?:;。؟۔]$/.test(current);
      const looksLikeHeading = current.length < 45;
      if (endsSentence || looksLikeHeading) {
        paragraphs.push(current);
        current = trimmed;
      } else {
        current += ` ${trimmed}`;
      }
    }
    if (current) paragraphs.push(current);
  }

  return paragraphs;
}
