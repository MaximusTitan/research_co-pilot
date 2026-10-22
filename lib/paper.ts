import { formatCitation, type CitationStyle } from "./citations";
import { savedSources } from "./project";
import type { Project } from "./types";

/** The finished paper as the student hands it in: title, headed sections and a reference list. */
export interface Paper {
  title: string;
  abstract: string | null;
  keywords: string[];
  sections: { heading: string; paragraphs: string[] }[];
  referencesTitle: string;
  references: string[];
}

export interface PaperLabels {
  abstract: string;
  keywords: string;
  intro: string;
  conclusion: string;
  references: string;
}

/** Builds the paper from the written sections only; empty sections are left out. */
export function buildPaper(p: Project, labels: PaperLabels, style: CitationStyle): Paper {
  const sections = p.sections
    .filter((s) => s.draft.trim())
    .map((s) => ({
      heading: s.kind === "intro" ? labels.intro : s.kind === "conclusion" ? labels.conclusion : s.title,
      paragraphs: s.draft
        .trim()
        .split(/\n{2,}/)
        .map((para) => para.trim())
        .filter(Boolean),
    }));
  const references = savedSources(p)
    .filter((s) => s.ref !== null)
    .map((s) => `[${s.ref}] ${formatCitation(s, style)}`);
  return { title: p.topic, abstract: p.abstract?.trim() || null, keywords: p.keywords ?? [], sections, referencesTitle: labels.references, references };
}

/** Plain text for the clipboard: headings on their own lines, a blank line between paragraphs. */
export function paperToText(paper: Paper, labels: Pick<PaperLabels, "abstract" | "keywords">): string {
  const front = [
    paper.abstract ? `${labels.abstract}: ${paper.abstract}` : "",
    paper.keywords.length ? `${labels.keywords}: ${paper.keywords.join(", ")}` : "",
  ].filter(Boolean);
  const parts = [paper.title, ...(front.length ? [front.join("\n\n")] : []), ...paper.sections.map((s) => [s.heading, ...s.paragraphs].join("\n\n"))];
  if (paper.references.length) parts.push([paper.referencesTitle, ...paper.references].join("\n"));
  return parts.join("\n\n\n");
}
