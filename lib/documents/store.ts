import "server-only";
import { ObjectId } from "mongodb";
import { db } from "@/lib/mongodb";
import type { DocumentStatus, DocumentSummary, FileType } from "@/lib/types";
import type { Chunk } from "./chunk";

// Collections
//   documents  one record per upload (title, status, counts)
//   pages      the text of every page, used by the page viewer
//   chunks     small overlapping pieces of text, used for search in the next phase
// Every record carries userId, and every query below filters on it.

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
    createdAt: record.createdAt.toISOString(),
  };
}

export async function countUserDocuments(userId: string) {
  await ensureIndexes();
  return documentsCollection().countDocuments({ userId });
}

export async function listDocuments(userId: string): Promise<DocumentSummary[]> {
  await ensureIndexes();
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

interface SaveInput {
  userId: string;
  title: string;
  fileType: FileType;
  fileSize: number;
  pages: string[];
  pagesAreEstimated: boolean;
  chunks: Chunk[];
}

/**
 * Store a parsed document. The record starts as "processing" and only becomes
 * "ready" once its pages and chunks are saved. If anything fails, everything
 * written so far is removed, so a half-saved document never shows up.
 */
export async function saveProcessedDocument(
  input: SaveInput,
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
    chunkCount: input.chunks.length,
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
    await chunksCollection().insertMany(
      input.chunks.map((chunk) => ({
        documentId: _id,
        userId: input.userId,
        index: chunk.index,
        page: chunk.page,
        text: chunk.text,
      })),
    );
    await documentsCollection().updateOne({ _id }, { $set: { status: "ready" } });
  } catch (error) {
    await removeDocumentData(_id);
    throw error;
  }

  return toSummary({ ...record, status: "ready" });
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
