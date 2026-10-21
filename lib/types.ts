export type WritingType = "essay" | "report" | "paper";
export type GradeBand = "4-6" | "7-8" | "9-10" | "11-12" | "adult";
export type Trust = "trusted" | "check" | "careful";
export type SourceKind =
  | "paper"
  | "government"
  | "education"
  | "encyclopedia"
  | "news"
  | "blog"
  | "website"
  | "document";
export type TrustReasonKey =
  | "peerReviewed"
  | "government"
  | "education"
  | "encyclopedia"
  | "news"
  | "blogNoAuthor"
  | "blogWithAuthor"
  | "unknownSite"
  | "userDocument";
export type AngleTag = "lots" | "easy" | "harder" | "fewer";
export type SectionKind = "intro" | "body" | "conclusion";
export type Locale = "en" | "hi";

export interface Angle {
  id: string;
  title: string;
  emoji: string;
  tag: AngleTag;
  questions: string[];
}

export interface Source {
  id: string;
  /** Stable citation number, assigned when the source is first saved. */
  ref: number | null;
  title: string;
  url: string | null;
  publisher: string;
  kind: SourceKind;
  year: number | null;
  authors: string[];
  summary: string;
  /** A sentence copied verbatim from the source text. */
  keyQuote: string | null;
  trust: Trust;
  trustReason: TrustReasonKey;
  saved: boolean;
  marked: boolean;
}

export interface Note {
  id: string;
  text: string;
  sourceId: string | null;
  sectionId: string | null;
}

export interface Section {
  id: string;
  kind: SectionKind;
  title: string;
  draft: string;
  /** The section's one-sentence main idea, set when the outline is built. */
  keyPoint?: string;
}

export interface Gap {
  question: string;
  why: string;
}

export interface Project {
  id: string;
  createdAt: number;
  updatedAt: number;
  topic: string;
  writingType: WritingType;
  grade: GradeBand;
  coachMessage: string | null;
  angles: Angle[];
  selectedAngleId: string | null;
  question: string | null;
  /** The question the current sources were found for; a different question means it's time to search again. */
  searchedFor?: string;
  /** The step the student was last on, so reopening the project lands there. */
  lastStep?: string;
  plan: string[];
  sources: Source[];
  nextRef: number;
  notes: Note[];
  sections: Section[];
  gaps: Gap[];
}
