export type DocumentFormat = "PDF" | "EPUB" | "DOCX" | "TXT";
export type DocumentLocation =
  | {
      type: "PDF";
      pageIndex: number;
      x?: number;
      y?: number;
      width?: number;
      height?: number;
    }
  | { type: "EPUB"; cfi: string; href: string; progression?: number }
  | { type: "DOCX" | "TXT"; blockIndex: number; offset: number };
export type ReadingStatus = "reading" | "want" | "finished";
export interface ReaderDocument {
  id: string;
  title: string;
  author: string;
  format: DocumentFormat;
  cover: string;
  color: string;
  status: ReadingStatus;
  progress: number;
  page: number;
  pages: number;
  location?: DocumentLocation;
  readingPositionUpdatedAt?: string;
  collections: string[];
  addedAt: string;
  lastReadAt?: string;
  size: number;
  demo?: boolean;
  content?: string[];
  contentAsset?: string;
  filename?: string;
}
export interface Collection {
  id: string;
  name: string;
  color: string;
}
export type AnnotationKind =
  | "highlight"
  | "note"
  | "pen"
  | "rectangle"
  | "circle"
  | "arrow"
  | "clipping"
  | "text"
  | "image"
  | "underline"
  | "pencil";
export interface Point {
  x: number;
  y: number;
  pressure?: number;
}
export interface Annotation {
  id: string;
  documentId: string;
  kind: AnnotationKind;
  page: number;
  location: DocumentLocation;
  text: string;
  quote?: string;
  color: string;
  points?: Point[];
  image?: string;
  thickness?: number;
  opacity?: number;
  /** Text size relative to a page width of 1000 units. */
  fontSize?: number;
  createdAt: string;
  updatedAt: string;
}
export interface Bookmark {
  id: string;
  documentId: string;
  page: number;
  location: DocumentLocation;
  createdAt: string;
}
export interface Preferences {
  theme: "light" | "dark" | "system";
  fontSize: number;
  readerTheme: "paper" | "white" | "night";
  dailyGoal: number;
}
export interface LibraryState {
  documents: ReaderDocument[];
  collections: Collection[];
  annotations: Annotation[];
  bookmarks: Bookmark[];
  preferences: Preferences;
  readingSeconds: number;
  readingDays?: Record<string, number>;
}
