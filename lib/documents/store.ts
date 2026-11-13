import "server-only";
import { Binary, ObjectId } from "mongodb";
import { EMBEDDING_DIMENSIONS, EMBEDDING_MODEL_ID } from "@/lib/ai/config";
import { STALE_PROCESSING_MS } from "@/lib/constants";
import type { DocumentStatus, DocumentSummary, FileType } from "@/lib/types";
import { db } from "@/lib/mongodb";
import type { Chunk } from "./chunk";

// Collections
//   documents  one record per upload (title, status, counts)
//   pages      the text of every page, used by the page viewer
//   chunks     small overlapping pieces of text, each with its embedding vector
// Every record carries userId, and every query below filters on it.
//
// Life of a document: "processing" (pages saved, vectors being made) then
// "ready" (chunks saved with vectors) or "failed" (with a message for the user).

interface DocumentRecord {
  _id: ObjectId;
  userId: string;
  title: string;
  fileType: FileType;
  fileSize: number;
  status: DocumentStatus;
  errorMessage?: string;
  pageCount: number;
  pagesAreEstimated: boolean;
  chunkCount: number;
  characterCount: number;
  embeddingModel?: string;
  embeddingDimensions?: number;
  createdAt: Date;
}

interface PageRecord {
  documentId: ObjectId;
  userId: string;
  page: number;
  text: string;
}

interface ChunkRecord {
  documentId: ObjectId;
  userId: string;
  index: number;
  page: number;
  text: string;
  // Stored as a BSON float32 vector: 768 numbers in about 3 KB. Documents
  // uploaded before search existed have no embedding.
  embedding?: Binary;
}

const documentsCollection = () => db.collection<DocumentRecord>("documents");
const pagesCollection = () => db.collection<PageRecord>("pages");
const chunksCollection = () => db.collection<ChunkRecord>("chunks");

// Create the indexes once per server process.
let indexesReady: Promise<unknown> | null = null;
function ensureIndexes() {
  indexesReady ??= Promise.all([
    documentsCollection().createIndex({ userId: 1, createdAt: -1 }),
    pagesCollection().createIndex({ documentId: 1, page: 1 }, { unique: true }),
    chunksCollection().createIndex({ documentId: 1, index: 1 }, { unique: true }),
    chunksCollection().createIndex({ userId: 1 }),
  ]).catch((error) => {
    indexesReady = null; // try again on the next request
    throw error;
  });
  return indexesReady;
}

const OBJECT_ID_PATTERN = /^[a-f0-9]{24}$/i;

function toObjectId(id: string): ObjectId | null {
  return OBJECT_ID_PATTERN.test(id) ? new ObjectId(id) : null;
}

function toSummary(record: DocumentRecord): DocumentSummary {
  return {
    id: record._id.toHexString(),
    title: record.title,
    fileType: record.fileType,
    fileSize: record.fileSize,
    status: record.status,
    errorMessage: record.errorMessage,
    pageCount: record.pageCount,
    pagesAreEstimated: record.pagesAreEstimated,
    chunkCount: record.chunkCount,
    characterCount: record.characterCount,
    searchable:
      record.status === "ready" &&
      record.embeddingModel === EMBEDDING_MODEL_ID &&
      record.embeddingDimensions === EMBEDDING_DIMENSIONS,
    createdAt: record.createdAt.toISOString(),
  };
}

const INTERRUPTED_MESSAGE =
  "Preparing this document was interrupted. Delete it and upload it again.";

// A background job that never finished (for example, the server restarted)
// would leave a document "processing" forever. Mark those as failed.
async function failInterruptedDocuments(userId: string) {
  await documentsCollection().updateMany(
    {
      userId,
      status: "processing",
      createdAt: { $lt: new Date(Date.now() - STALE_PROCESSING_MS) },
    },
    { $set: { status: "failed", errorMessage: INTERRUPTED_MESSAGE } },
  );
}

export async function countUserDocuments(userId: string) {
  await ensureIndexes();
  return documentsCollection().countDocuments({ userId });
}

export async function listDocuments(userId: string): Promise<DocumentSummary[]> {
  await ensureIndexes();
  await failInterruptedDocuments(userId);
  const records = await documentsCollection()
    .find({ userId })
    .sort({ createdAt: -1 })
    .toArray();
  return records.map(toSummary);
}

export async function getDocument(
  userId: string,
  id: string,
): Promise<DocumentSummary | null> {
  const _id = toObjectId(id);
  if (!_id) return null;
  await ensureIndexes();
  await failInterruptedDocuments(userId);
  const record = await documentsCollection().findOne({ _id, userId });
  return record ? toSummary(record) : null;
}

export async function getPageText(
  userId: string,
  id: string,
  page: number,
): Promise<string | null> {
  const documentId = toObjectId(id);
  if (!documentId) return null;
  await ensureIndexes();
  const record = await pagesCollection().findOne({ documentId, userId, page });
  return record ? record.text : null;
}

interface CreateInput {
  userId: string;
  title: string;
  fileType: FileType;
  fileSize: number;
  pages: string[];
  pagesAreEstimated: boolean;
  chunkCount: number;
}

/**
 * Save a document and its pages straight away, as "processing", so the person
 * can start reading while vectors are made in the background.
 */
export async function createProcessingDocument(
  input: CreateInput,
): Promise<DocumentSummary> {
  await ensureIndexes();

  const _id = new ObjectId();
  const record: DocumentRecord = {
    _id,
    userId: input.userId,
    title: input.title,
    fileType: input.fileType,
    fileSize: input.fileSize,
    status: "processing",
    pageCount: input.pages.length,
    pagesAreEstimated: input.pagesAreEstimated,
    chunkCount: input.chunkCount,
    characterCount: input.pages.reduce((sum, page) => sum + page.length, 0),
    createdAt: new Date(),
  };

  await documentsCollection().insertOne(record);

  try {
    await pagesCollection().insertMany(
      input.pages.map((text, i) => ({
        documentId: _id,
        userId: input.userId,
        page: i + 1,
        text,
      })),
    );
  } catch (error) {
    await removeDocumentData(_id);
    throw error;
  }

  return toSummary(record);
}

interface FinishInput {
  userId: string;
  documentId: string;
  chunks: Chunk[];
  vectors: Float32Array[];
  model: string;
  dimensions: number;
}

/**
 * Save the chunks with their vectors and mark the document ready.
 * Returns false (and saves nothing) if the document was deleted while the
 * vectors were being made.
 */
export async function finishProcessing(input: FinishInput): Promise<boolean> {
  const _id = toObjectId(input.documentId);
  if (!_id) throw new Error("Invalid document id.");
  if (input.chunks.length !== input.vectors.length) {
    throw new Error("Every chunk needs exactly one vector.");
  }

  const stillThere = await documentsCollection().findOne(
    { _id, userId: input.userId, status: "processing" },
    { projection: { _id: 1 } },
  );
  if (!stillThere) return false;

  if (input.chunks.length > 0) {
    await chunksCollection().insertMany(
      input.chunks.map((chunk, i) => ({
        documentId: _id,
        userId: input.userId,
        index: chunk.index,
        page: chunk.page,
        text: chunk.text,
        embedding: Binary.fromFloat32Array(input.vectors[i]),
      })),
    );
  }

  const result = await documentsCollection().updateOne(
    { _id, userId: input.userId, status: "processing" },
    {
      $set: {
        status: "ready",
        embeddingModel: input.model,
        embeddingDimensions: input.dimensions,
      },
      $unset: { errorMessage: "" },
    },
  );

  if (result.matchedCount === 0) {
    // Deleted between the check above and now. Don't leave orphaned chunks.
    await chunksCollection().deleteMany({ documentId: _id });
    return false;
  }
  return true;
}

/** Mark a document as failed, with a message that is safe to show. */
export async function failProcessing(
  userId: string,
  documentId: string,
  message: string,
) {
  const _id = toObjectId(documentId);
  if (!_id) return;
  await documentsCollection().updateOne(
    { _id, userId, status: "processing" },
    { $set: { status: "failed", errorMessage: message } },
  );
  await chunksCollection().deleteMany({ documentId: _id });
}

export interface StoredChunk {
  index: number;
  page: number;
  text: string;
  embedding: Float32Array;
}

/** All chunks of one document that have a vector, ready for similarity search. */
export async function getChunksWithEmbeddings(
  userId: string,
  documentId: string,
): Promise<StoredChunk[]> {
  const _id = toObjectId(documentId);
  if (!_id) return [];
  await ensureIndexes();

  const records = await chunksCollection()
    .find({ documentId: _id, userId, embedding: { $exists: true } })
    .project<Required<Pick<ChunkRecord, "index" | "page" | "text" | "embedding">>>({
      index: 1,
      page: 1,
      text: 1,
      embedding: 1,
    })
    .toArray();

  return records.map((record) => ({
    index: record.index,
    page: record.page,
    text: record.text,
    embedding: record.embedding.toFloat32Array(),
  }));
}

async function removeDocumentData(documentId: ObjectId) {
  await Promise.all([
    pagesCollection().deleteMany({ documentId }),
    chunksCollection().deleteMany({ documentId }),
  ]);
  await documentsCollection().deleteOne({ _id: documentId });
}

/** Returns false when the document doesn't exist or belongs to someone else. */
export async function deleteDocument(userId: string, id: string) {
  const _id = toObjectId(id);
  if (!_id) return false;
  await ensureIndexes();
  const owned = await documentsCollection().findOne({ _id, userId });
  if (!owned) return false;
  await removeDocumentData(_id);
  return true;
}
