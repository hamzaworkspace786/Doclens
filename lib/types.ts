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
  createdAt: string;
}

export interface PageContent {
  page: number;
  pageCount: number;
  text: string;
}
