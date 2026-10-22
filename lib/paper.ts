import { formatCitation, styleCitations, type CitationStyle } from "./citations";
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
  worksCited: string;
}

/**
 * Builds the paper from the written sections only; empty sections are left out.
 * In-text citations and the reference list follow the citation style: IEEE is
 * numbered in citation order, APA and MLA are alphabetical without numbers.
 */
export function buildPaper(p: Project, labels: PaperLabels, style: CitationStyle): Paper {
  const saved = savedSources(p).filter((s) => s.ref !== null);
  const sections = p.sections
    .filter((s) => s.draft.trim())
    .map((s) => ({
      heading: s.kind === "intro" ? labels.intro : s.kind === "conclusion" ? labels.conclusion : s.title,
      paragraphs: s.draft
        .trim()
        .split(/\n{2,}/)
        .map((para) => styleCitations(para.trim(), style, saved))
        .filter(Boolean),
    }));
  const references =
    style === "ieee"
      ? saved.map((s) => `[${s.ref}] ${formatCitation(s, style)}`)
      : saved.map((s) => formatCitation(s, style)).sort((a, b) => a.localeCompare(b));
  return { title: p.topic, abstract: p.abstract?.trim() || null, keywords: p.keywords ?? [], sections, referencesTitle: style === "mla" ? labels.worksCited : labels.references, references };
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
