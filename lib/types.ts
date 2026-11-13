// Shapes shared by the API and the UI. Dates travel as ISO strings.

export type FileType = "pdf" | "docx" | "txt";
export type DocumentStatus = "processing" | "ready" | "failed";

export interface DocumentSummary {
  id: string;
  title: string;
  fileType: FileType;
  fileSize: number;
  status: DocumentStatus;
  errorMessage?: string;
  pageCount: number;
  // True for Word and text files, where pages are estimated rather than real.
  pagesAreEstimated: boolean;
  chunkCount: number;
  characterCount: number;
  // True once the document has been prepared for search with the current model.
  searchable: boolean;
  createdAt: string;
}

export interface PageContent {
  page: number;
  pageCount: number;
  text: string;
}

export interface SearchHit {
  index: number; // chunk number within the document
  page: number;
  text: string;
  score: number; // cosine similarity, higher is closer in meaning
}
