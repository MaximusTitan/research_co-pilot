import type { GradeBand, PaperLength, WritingType } from "./types";

export const GRADES: GradeBand[] = ["4-6", "7-8", "9-10", "11-12"];

/** Projects saved before the university level was removed come back as the top school level. */
export function normalizeGrade(grade: unknown): GradeBand {
  return GRADES.includes(grade as GradeBand) ? (grade as GradeBand) : "11-12";
}

/**
 * How each kind of writing differs in the app: what the finished piece looks
 * like and how much research goes into it. What the AI is told for each kind
 * lives with the prompts on the server.
 */
export interface WritingProfile {
  /** Only research papers open with an abstract and keywords. */
  abstract: boolean;
  /** journal: two columns and Roman-numeral headings; report: one column, numbered headings; essay: one column, no headings. */
  layout: "journal" | "report" | "essay";
  /** How many found sources the AI keeps, and how many pages of search it reads, for each length. */
  maxSaved: Record<PaperLength, number>;
  sourcePages: Record<PaperLength, number>;
}

export const WRITING: Record<WritingType, WritingProfile> = {
  essay: { abstract: false, layout: "essay", maxSaved: { short: 3, standard: 4, long: 5 }, sourcePages: { short: 1, standard: 1, long: 2 } },
  report: { abstract: false, layout: "report", maxSaved: { short: 4, standard: 5, long: 6 }, sourcePages: { short: 1, standard: 2, long: 2 } },
  paper: { abstract: true, layout: "journal", maxSaved: { short: 4, standard: 6, long: 8 }, sourcePages: { short: 1, standard: 2, long: 3 } },
};

/** How many options a student may pick on a multi-select interview question. */
export const maxPicks = (grade: GradeBand) => (grade === "4-6" ? 2 : 3);
