import { extractText, getDocumentProxy } from "unpdf";
import mammoth from "mammoth";
import { MAX_CHARACTERS, MAX_PAGES } from "../constants";
import type { FileType } from "../types";
import { UploadError } from "./errors";
import { paginateText } from "./paginate";
import { normalizeText } from "./text";

export interface ParsedDocument {
  pages: string[]; // one entry per page, in order (a page can be empty)
  pagesAreEstimated: boolean;
}

async function parsePdf(bytes: Uint8Array): Promise<ParsedDocument> {
  let pdf;
  try {
    // pdf.js can take ownership of the buffer, so give it a copy.
    pdf = await getDocumentProxy(new Uint8Array(bytes));
  } catch (error) {
    if (error instanceof Error && error.name === "PasswordException") {
      throw new UploadError(
        "This PDF is password-protected. Remove the password and upload it again.",
        422,
      );
    }
    throw new UploadError("DocLens couldn't read this PDF. It may be damaged.", 422);
  }

  try {
    if (pdf.numPages > MAX_PAGES) {
      throw new UploadError(
        `This PDF has ${pdf.numPages} pages. DocLens reads up to ${MAX_PAGES}.`,
        422,
      );
    }
    const { text } = await extractText(pdf, { mergePages: false });
    return { pages: text.map(normalizeText), pagesAreEstimated: false };
  } finally {
    await pdf.loadingTask.destroy();
  }
}

async function parseDocx(bytes: Uint8Array): Promise<ParsedDocument> {
  try {
    const { value } = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
    return { pages: paginateText(value), pagesAreEstimated: true };
  } catch {
    throw new UploadError(
      "DocLens couldn't read this Word file. It may be damaged.",
      422,
    );
  }
}

function parseTxt(bytes: Uint8Array): ParsedDocument {
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new UploadError(
      "This text file isn't UTF-8. Save it as UTF-8 and upload it again.",
      422,
    );
  }
  return { pages: paginateText(text.replace(/^\uFEFF/, "")), pagesAreEstimated: true };
}

/** Read a file into pages of plain text. Throws UploadError with a friendly message. */
export async function parseDocument(
  bytes: Uint8Array,
  fileType: FileType,
): Promise<ParsedDocument> {
  const parsed =
    fileType === "pdf"
      ? await parsePdf(bytes)
      : fileType === "docx"
        ? await parseDocx(bytes)
        : parseTxt(bytes);

  const characters = parsed.pages.reduce((sum, page) => sum + page.length, 0);

  if (characters < 20) {
    throw new UploadError(
      fileType === "pdf"
        ? "This PDF has no selectable text. It may be a scan, and DocLens can't read scans yet."
        : "This file has no readable text.",
      422,
    );
  }
  if (characters > MAX_CHARACTERS) {
    throw new UploadError(
      `This file has about ${Math.round(characters / 1000)}k characters. DocLens reads up to ${MAX_CHARACTERS / 1000}k.`,
      422,
    );
  }
  if (parsed.pages.length > MAX_PAGES) {
    throw new UploadError(
      `This file has ${parsed.pages.length} pages. DocLens reads up to ${MAX_PAGES}.`,
      422,
    );
  }

  return parsed;
}
