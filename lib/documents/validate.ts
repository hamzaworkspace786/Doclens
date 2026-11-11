import {
  ACCEPTED_EXTENSIONS,
  MAX_FILE_BYTES,
  MAX_FILE_LABEL,
} from "../constants";
import type { FileType } from "../types";
import { UploadError } from "./errors";

const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46, 0x2d]; // "%PDF-"
const ZIP_MAGIC = [0x50, 0x4b, 0x03, 0x04]; // "PK\x03\x04", the start of every .docx

function startsWith(bytes: Uint8Array, signature: number[]) {
  return signature.every((byte, i) => bytes[i] === byte);
}

function containsNullByte(bytes: Uint8Array) {
  const limit = Math.min(bytes.length, 8000);
  for (let i = 0; i < limit; i++) {
    if (bytes[i] === 0) return true;
  }
  return false;
}

/** A readable title from the original file name. */
export function cleanTitle(fileName: string): string {
  const base = fileName.split(/[\\/]/).pop() ?? fileName;
  const cleaned = base.replace(/[\u0000-\u001f\u007f]/g, "").trim();
  return (cleaned || "Untitled document").slice(0, 120);
}

/**
 * Check the file name, size and real content. We look at the first bytes
 * instead of trusting the extension or the browser's MIME type, which anyone
 * can fake.
 */
export function validateUpload(fileName: string, bytes: Uint8Array): FileType {
  const lower = fileName.toLowerCase();
  const extension = ACCEPTED_EXTENSIONS.find((ext) => lower.endsWith(ext));

  if (!extension) {
    throw new UploadError(
      "DocLens reads PDF, Word (.docx), and text (.txt) files.",
      415,
    );
  }
  if (bytes.length === 0) {
    throw new UploadError("This file is empty.", 400);
  }
  if (bytes.length > MAX_FILE_BYTES) {
    throw new UploadError(
      `This file is larger than ${MAX_FILE_LABEL}. Try a smaller one.`,
      413,
    );
  }

  const fileType = extension.slice(1) as FileType;

  if (fileType === "pdf" && !startsWith(bytes, PDF_MAGIC)) {
    throw new UploadError("This file looks like it isn't really a PDF.", 415);
  }
  if (fileType === "docx" && !startsWith(bytes, ZIP_MAGIC)) {
    throw new UploadError(
      "This file isn't a .docx. Older .doc files need to be saved as .docx first.",
      415,
    );
  }
  if (fileType === "txt" && containsNullByte(bytes)) {
    throw new UploadError("This file looks like it isn't plain text.", 415);
  }

  return fileType;
}
