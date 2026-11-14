// Shapes shared by the API and the UI. Dates travel as ISO strings.

export type FileType = "pdf" | "docx" | "txt";
export type DocumentStatus = "processing" | "ready" | "failed";

// "none" means the document was uploaded before analysis existed and has never
// been analyzed. The panel then offers an "Analyze this document" button.
export type AnalysisStatus = "none" | "processing" | "ready" | "failed";

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
  // The analysis has its own status, separate from search, so one can fail
  // while the other works.
  analysisStatus: AnalysisStatus;
  analysisError?: string;
  // Changes every time an analysis is (re)generated. Used to refresh the view.
  analysisGeneratedAt?: string;
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

// A person, organization, date or amount found in the document.
export interface Entity {
  text: string; // exactly as the document writes it
  detail: string; // who or what it is, or what it refers to
  pages: number[];
  // False when the wording could not be found on the cited pages. The UI asks
  // the reader to check it, because the model may have changed or invented it.
  verified: boolean;
}

export interface DocumentAnalysis {
  summary: { documentType: string; overview: string; pages: number[] };
  keyPoints: { point: string; detail: string; pages: number[] }[];
  people: Entity[];
  organizations: Entity[];
  dates: Entity[];
  amounts: Entity[];
  actionItems: {
    task: string;
    owner: string | null;
    due: string | null;
    pages: number[];
  }[];
}

export interface AnalysisResponse {
  analysis: DocumentAnalysis;
  model: string;
  generatedAt: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

// "Open this page of this document", sent from one panel (like the chat) to
// another (the page viewer). The nonce changes on every request, so asking for
// the same page twice still counts.
export interface PageRequest {
  documentId: string;
  page: number;
  nonce: number;
}
