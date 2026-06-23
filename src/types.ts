export interface DocumentFile {
  id: string; // Google Drive File ID or local ID
  name: string;
  size: number;
  uploadDate: string;
  status: 'processing' | 'indexed' | 'error';
  statusProgress: number; // 0 to 100
  type: string; // 'pdf' | 'docx' | 'xlsx' | 'txt' | 'csv' etc.
  numChunks?: number;
  errorMessage?: string;
  driveUrl?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  content: string;
  timestamp: string;
  references?: CitationSource[];
}

export interface CitationSource {
  fileName: string;
  docId: string;
  textSnippet: string;
  page?: string;
  section?: string;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  isPinned: boolean;
  createdAt: string;
}
