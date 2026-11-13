import { after, NextResponse } from "next/server";
import { isEmbeddingConfigured } from "@/lib/ai/embedding-model";
import { MAX_DOCUMENTS_PER_USER, MAX_FILE_BYTES } from "@/lib/constants";
import { chunkPages } from "@/lib/documents/chunk";
import { UploadError } from "@/lib/documents/errors";
import { parseDocument } from "@/lib/documents/parse";
import { embedAndStoreChunks } from "@/lib/documents/process";
import {
  countUserDocuments,
  listDocuments,
  createProcessingDocument,
} from "@/lib/documents/store";
import { cleanTitle, validateUpload } from "@/lib/documents/validate";
import { getUserOrNull } from "@/lib/session";

// Vectors are made in the background after the response is sent. This is the
// longest a single invocation may run on any Vercel plan.
export const maxDuration = 300;

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET() {
  const user = await getUserOrNull();
  if (!user) return errorResponse("Please sign in.", 401);

  const documents = await listDocuments(user.id);
  return NextResponse.json({ documents });
}

export async function POST(request: Request) {
  const user = await getUserOrNull();
  if (!user) return errorResponse("Please sign in.", 401);

  // Refuse oversized uploads before reading them. The extra room covers the
  // multipart envelope around the file.
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_FILE_BYTES + 100_000) {
    return errorResponse("This file is too large. Try a smaller one.", 413);
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return errorResponse("The upload could not be read. Try again.", 400);
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return errorResponse("No file was received.", 400);
  }

  if (!isEmbeddingConfigured()) {
    return errorResponse(
      "Search isn't set up on this server yet. Add GOOGLE_GENERATIVE_AI_API_KEY to the environment and restart.",
      503,
    );
  }

  if ((await countUserDocuments(user.id)) >= MAX_DOCUMENTS_PER_USER) {
    return errorResponse(
      `You can keep up to ${MAX_DOCUMENTS_PER_USER} documents. Delete one to upload another.`,
      403,
    );
  }

  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const fileType = validateUpload(file.name, bytes);
    const { pages, pagesAreEstimated } = await parseDocument(bytes, fileType);
    const chunks = chunkPages(pages);

    const document = await createProcessingDocument({
      userId: user.id,
      title: cleanTitle(file.name),
      fileType,
      fileSize: bytes.length,
      pages,
      pagesAreEstimated,
      chunkCount: chunks.length,
    });

    // Answer now, make the vectors after. The person can read the pages
    // while the document shows "preparing for search".
    after(() =>
      embedAndStoreChunks({ userId: user.id, documentId: document.id, chunks }),
    );

    return NextResponse.json({ document }, { status: 201 });
  } catch (error) {
    if (error instanceof UploadError) {
      return errorResponse(error.message, error.status);
    }
    console.error("Document upload failed:", error);
    return errorResponse(
      "Something went wrong while reading your file. Try again.",
      500,
    );
  }
}
