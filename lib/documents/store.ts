import "server-only";
import { Binary, ObjectId } from "mongodb";
import { EMBEDDING_DIMENSIONS, EMBEDDING_MODEL_ID } from "@/lib/ai/config";
import { STALE_PROCESSING_MS } from "@/lib/constants";
import type {
  AnalysisStatus,
  DocumentAnalysis,
  DocumentStatus,
  DocumentSummary,
  FileType,
} from "@/lib/types";
import { db } from "@/lib/mongodb";
import type { Chunk } from "./chunk";

// Collections
//   documents  one record per upload (title, status, counts)
//   pages      the text of every page, used by the page viewer
//   chunks     small overlapping pieces of text, each with its embedding vector
//   analyses   the summary, key points, names and numbers, and action items
// Every record carries userId, and every query below filters on it.
//
// A document has two independent jobs, each with its own status, so one can
// fail while the other works:
//   status          "processing" then "ready" or "failed"   (search vectors)
//   analysisStatus  "processing" then "ready" or "failed"   (the analysis)
// Documents uploaded before analysis existed have no analysisStatus at all.

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
  analysisStatus?: Exclude<AnalysisStatus, "none">;
  analysisError?: string;
  analysisStartedAt?: Date;
  analysisAt?: Date;
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

interface AnalysisRecord {
  documentId: ObjectId;
  userId: string;
  model: string;
  generatedAt: Date;
  content: DocumentAnalysis;
}

const documentsCollection = () => db.collection<DocumentRecord>("documents");
const pagesCollection = () => db.collection<PageRecord>("pages");
const chunksCollection = () => db.collection<ChunkRecord>("chunks");
const analysesCollection = () => db.collection<AnalysisRecord>("analyses");

// Create the indexes once per server process.
let indexesReady: Promise<unknown> | null = null;
function ensureIndexes() {
  indexesReady ??= Promise.all([
    documentsCollection().createIndex({ userId: 1, createdAt: -1 }),
    pagesCollection().createIndex({ documentId: 1, page: 1 }, { unique: true }),
    chunksCollection().createIndex({ documentId: 1, index: 1 }, { unique: true }),
    chunksCollection().createIndex({ userId: 1 }),
    analysesCollection().createIndex({ documentId: 1 }, { unique: true }),
    analysesCollection().createIndex({ userId: 1 }),
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
    analysisStatus: record.analysisStatus ?? "none",
    analysisError: record.analysisError,
    analysisGeneratedAt: record.analysisAt?.toISOString(),
    createdAt: record.createdAt.toISOString(),
  };
}

const INTERRUPTED_MESSAGE =
  "Preparing this document was interrupted. Delete it and upload it again.";
const ANALYSIS_INTERRUPTED_MESSAGE =
  "The analysis was interrupted. Try generating it again.";

// A background job that never finished (for example, the server restarted)
// would leave a document "processing" forever. Mark those as failed.
async function failInterruptedDocuments(userId: string) {
  const cutoff = new Date(Date.now() - STALE_PROCESSING_MS);
  await Promise.all([
    documentsCollection().updateMany(
      { userId, status: "processing", createdAt: { $lt: cutoff } },
      { $set: { status: "failed", errorMessage: INTERRUPTED_MESSAGE } },
    ),
    documentsCollection().updateMany(
      { userId, analysisStatus: "processing", analysisStartedAt: { $lt: cutoff } },
      { $set: { analysisStatus: "failed", analysisError: ANALYSIS_INTERRUPTED_MESSAGE } },
    ),
  ]);
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

/** The text of every page in order (index 0 is page 1), or null if there are none. */
export async function getAllPages(userId: string, id: string): Promise<string[] | null> {
  const documentId = toObjectId(id);
  if (!documentId) return null;
  await ensureIndexes();
  const records = await pagesCollection()
    .find({ documentId, userId })
    .sort({ page: 1 })
    .project<Pick<PageRecord, "text">>({ text: 1 })
    .toArray();
  return records.length > 0 ? records.map((record) => record.text) : null;
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
 * can start reading while vectors and the analysis are made in the background.
 */
export async function createProcessingDocument(
  input: CreateInput,
): Promise<DocumentSummary> {
  await ensureIndexes();

  const _id = new ObjectId();
  const now = new Date();
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
    analysisStatus: "processing",
    analysisStartedAt: now,
    createdAt: now,
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

// --- Analysis ---------------------------------------------------------------

/**
 * Mark a document's analysis as "processing", unless one is already running.
 * Returns false when one is already running (the caller answers 409), so
 * two clicks can never start two paid AI calls for the same document.
 */
export async function beginAnalysis(userId: string, id: string): Promise<boolean> {
  const _id = toObjectId(id);
  if (!_id) return false;
  await ensureIndexes();
  const result = await documentsCollection().updateOne(
    // $ne also matches documents that have never had an analysis status.
    { _id, userId, analysisStatus: { $ne: "processing" } },
    {
      $set: { analysisStatus: "processing", analysisStartedAt: new Date() },
      $unset: { analysisError: "" },
    },
  );
  return result.matchedCount > 0;
}

interface FinishAnalysisInput {
  userId: string;
  documentId: string;
  content: DocumentAnalysis;
  model: string;
}

/**
 * Save the analysis and mark it ready. Returns false (and saves nothing) if
 * the document was deleted while the analysis was being made.
 */
export async function finishAnalysis(input: FinishAnalysisInput): Promise<boolean> {
  const _id = toObjectId(input.documentId);
  if (!_id) throw new Error("Invalid document id.");

  const stillThere = await documentsCollection().findOne(
    { _id, userId: input.userId, analysisStatus: "processing" },
    { projection: { _id: 1 } },
  );
  if (!stillThere) return false;

  const generatedAt = new Date();
  await analysesCollection().replaceOne(
    { documentId: _id },
    {
      documentId: _id,
      userId: input.userId,
      model: input.model,
      generatedAt,
      content: input.content,
    },
    { upsert: true },
  );

  const result = await documentsCollection().updateOne(
    { _id, userId: input.userId, analysisStatus: "processing" },
    {
      $set: { analysisStatus: "ready", analysisAt: generatedAt },
      $unset: { analysisError: "" },
    },
  );

  if (result.matchedCount === 0) {
    // Deleted between the check above and now. Don't leave an orphaned analysis.
    await analysesCollection().deleteMany({ documentId: _id });
    return false;
  }
  return true;
}

/** Mark an analysis as failed, with a message that is safe to show. */
export async function failAnalysis(userId: string, documentId: string, message: string) {
  const _id = toObjectId(documentId);
  if (!_id) return;
  await documentsCollection().updateOne(
    { _id, userId, analysisStatus: "processing" },
    { $set: { analysisStatus: "failed", analysisError: message } },
  );
}

export interface StoredAnalysis {
  content: DocumentAnalysis;
  model: string;
  generatedAt: Date;
}

export async function getAnalysis(
  userId: string,
  documentId: string,
): Promise<StoredAnalysis | null> {
  const _id = toObjectId(documentId);
  if (!_id) return null;
  await ensureIndexes();
  const record = await analysesCollection().findOne({ documentId: _id, userId });
  if (!record) return null;
  return { content: record.content, model: record.model, generatedAt: record.generatedAt };
}

// --- Search -----------------------------------------------------------------

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
    analysesCollection().deleteMany({ documentId }),
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
