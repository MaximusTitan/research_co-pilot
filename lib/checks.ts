import { citedRefs } from "./citations";
import { keywordOverlap, sentences, shingles, words } from "./text";
import type { GradeBand, Note, Source } from "./types";

// ---------- Originality ----------

export interface OriginalityResult {
  /** 0..100, share of sentences written in the student's own words. */
  score: number;
  flagged: { sentence: string; sourceId: string | null }[];
  total: number;
}

const SHINGLE = 5;

/**
 * Flags sentences that reuse long word runs from a source's own wording without
 * quotation marks. Quoted text is fine as long as it is cited. Summaries and
 * notes are left out: they are the AI's or the student's words, not the
 * source's, so matching them isn't copying the source.
 */
export function checkOriginality(draft: string, sources: Source[]): OriginalityResult {
  const corpus = sources
    .filter((s) => s.keyQuote)
    .map((s) => ({ id: s.id, set: shingles(s.keyQuote ?? "", SHINGLE) }));

  const all = sentences(draft).filter((s) => words(s.text).length >= SHINGLE);
  const flagged: OriginalityResult["flagged"] = [];
  for (const s of all) {
    if (/["“].+["”]/.test(s.text) && citedRefs(s.text).length > 0) continue;
    const own = shingles(s.text, SHINGLE);
    for (const c of corpus) {
      let hits = 0;
      for (const sh of own) if (c.set.has(sh)) hits++;
      if (own.size > 0 && hits / own.size >= 0.5) {
        flagged.push({ sentence: s.text, sourceId: c.id });
        break;
      }
    }
  }
  const total = all.length;
  const score = total === 0 ? 100 : Math.round(((total - flagged.length) / total) * 100);
  return { score, flagged, total };
}

// ---------- Grammar & style ----------

export type IssueKind = "spelling" | "grammar" | "style";

export interface Issue {
  id: string;
  kind: IssueKind;
  /** Key into the i18n `issues` table. */
  messageKey: "misspelling" | "theirThere" | "repeatedWord" | "capital" | "lowercaseI" | "doubleSpace" | "longSentence";
  start: number;
  end: number;
  original: string;
  replacement: string | null;
}

const MISSPELLINGS: Record<string, string> = {
  becouse: "because",
  beacuse: "because",
  teh: "the",
  recieve: "receive",
  definately: "definitely",
  alot: "a lot",
  seperate: "separate",
  untill: "until",
  wich: "which",
  thier: "their",
  occured: "occurred",
  enviroment: "environment",
  goverment: "government",
  beleive: "believe",
  wierd: "weird",
  arguement: "argument",
  existance: "existence",
  occurence: "occurrence",
  reserch: "research",
  polution: "pollution",
  pestiside: "pesticide",
};

function longSentenceLimit(grade: GradeBand): number {
  if (grade === "4-6") return 22;
  if (grade === "7-8") return 28;
  return 35;
}

function preserveCase(original: string, replacement: string): string {
  return original[0] === original[0].toUpperCase() ? replacement[0].toUpperCase() + replacement.slice(1) : replacement;
}

export function checkGrammar(text: string, grade: GradeBand): Issue[] {
  const issues: Issue[] = [];
  const push = (issue: Omit<Issue, "id">) => issues.push({ ...issue, id: `${issue.messageKey}-${issue.start}` });

  for (const m of text.matchAll(/\b[\p{L}']+\b/gu)) {
    const fix = MISSPELLINGS[m[0].toLowerCase()];
    if (fix) {
      const start = m.index ?? 0;
      push({ kind: "spelling", messageKey: "misspelling", start, end: start + m[0].length, original: m[0], replacement: preserveCase(m[0], fix) });
    }
  }
  for (const m of text.matchAll(/\btheir (is|are|was|were)\b/gi)) {
    const start = m.index ?? 0;
    const original = m[0];
    push({ kind: "grammar", messageKey: "theirThere", start, end: start + original.length, original, replacement: preserveCase(original, `there ${m[1]}`) });
  }
  for (const m of text.matchAll(/\b([\p{L}']+)\s+\1\b/giu)) {
    const start = m.index ?? 0;
    push({ kind: "grammar", messageKey: "repeatedWord", start, end: start + m[0].length, original: m[0], replacement: m[1] });
  }
  for (const m of text.matchAll(/(?<=^|\s)i(?=\s|')/g)) {
    const start = m.index ?? 0;
    push({ kind: "grammar", messageKey: "lowercaseI", start, end: start + 1, original: "i", replacement: "I" });
  }
  for (const m of text.matchAll(/(?<=\S) {2,}(?=\S)/g)) {
    const start = m.index ?? 0;
    push({ kind: "style", messageKey: "doubleSpace", start, end: start + m[0].length, original: m[0], replacement: " " });
  }

  const limit = longSentenceLimit(grade);
  for (const s of sentences(text)) {
    const first = s.text.match(/\p{L}/u);
    if (first && first.index === 0 && first[0] !== first[0].toUpperCase()) {
      push({ kind: "grammar", messageKey: "capital", start: s.start, end: s.start + 1, original: first[0], replacement: first[0].toUpperCase() });
    }
    if (words(s.text).length > limit) {
      push({ kind: "style", messageKey: "longSentence", start: s.start, end: s.end, original: s.text, replacement: null });
    }
  }

  return issues.sort((a, b) => a.start - b.start);
}

/** Applies one fix to the text. Returns the text unchanged if it no longer matches. */
export function applyFix(text: string, issue: Issue): string {
  if (issue.replacement === null || text.slice(issue.start, issue.end) !== issue.original) return text;
  return text.slice(0, issue.start) + issue.replacement + text.slice(issue.end);
}

/**
 * Applies every fixable issue at once. Works from the end of the text back so
 * earlier positions stay valid, and skips fixes that overlap one already made.
 */
export function applyAllFixes(text: string, issues: Issue[]): string {
  let out = text;
  let limit = Infinity;
  for (const issue of [...issues].sort((a, b) => b.start - a.start)) {
    if (issue.replacement === null || issue.end > limit) continue;
    const next = applyFix(out, issue);
    if (next !== out) {
      out = next;
      limit = issue.start;
    }
  }
  return out;
}

/**
 * Fixes everything fixable, re-checking between passes because one fix can
 * reveal another (e.g. a corrected word that still needs a capital letter).
 */
export function fixAllGrammar(text: string, grade: GradeBand): string {
  let out = text;
  for (let pass = 0; pass < 3; pass++) {
    const next = applyAllFixes(out, checkGrammar(out, grade));
    if (next === out) break;
    out = next;
  }
  return out;
}

// ---------- Citation verification ----------

export type CitationProblemKind = "missingSource" | "uncitedClaim" | "unusedSource" | "weakSupport" | "carefulSource";

export interface CitationProblem {
  kind: CitationProblemKind;
  sentence: string | null;
  sourceId: string | null;
  ref: number | null;
}

// Numbers, or wording that attributes a fact to someone ("studies show", "researchers found").
// Plain words like "research" or "show" alone are not enough: "this research question" or
// "these facts show why it matters" are the writer's own reasoning, not claims needing a source.
const CLAIM_SIGNALS = new RegExp(
  [
    String.raw`\d|%`,
    String.raw`\b(studies|study|research|data|evidence|surveys?|experiments?)\s+(show|shows|showed|suggests?|found|finds|proves?|indicates?)\b`,
    String.raw`\b(scientists|researchers|experts)\s+(have\s+)?(found|discovered|says?|believe|showed|shown|reported)\b`,
    String.raw`\baccording to\b`,
    // Hindi: "according to", "studies/research/data show", "scientists found".
    String.raw`के अनुसार`,
    String.raw`(अध्ययन|अध्ययनों|शोध|आँकड़े|आंकड़े|आँकड़ों)\s*(से)?\s*(पता चलता|दिखाते|दिखाता|बताते|बताता)`,
    String.raw`(वैज्ञानिकों|शोधकर्ताओं|विशेषज्ञों)\s+(ने|का)\s+(पाया|कहना)`,
  ].join("|"),
  "i",
);

/**
 * Checks that every citation points at a saved source, that factual-looking
 * sentences carry a citation, and that cited sentences overlap with what the
 * source actually says. The overlap test is a heuristic for the student to act
 * on; the AI verification agent gives a deeper reading when available.
 */
export function verifyCitations(draft: string, sources: Source[], notes: Note[]): CitationProblem[] {
  const byRef = new Map(sources.filter((s) => s.ref !== null).map((s) => [s.ref as number, s]));
  const problems: CitationProblem[] = [];
  const used = new Set<number>();

  for (const s of sentences(draft)) {
    const refs = citedRefs(s.text);
    if (refs.length === 0) {
      if (CLAIM_SIGNALS.test(s.text) && words(s.text).length >= 6) {
        problems.push({ kind: "uncitedClaim", sentence: s.text, sourceId: null, ref: null });
      }
      continue;
    }
    for (const ref of refs) {
      used.add(ref);
      const source = byRef.get(ref);
      if (!source) {
        problems.push({ kind: "missingSource", sentence: s.text, sourceId: null, ref });
        continue;
      }
      const evidence = [source.summary, source.keyQuote ?? "", ...notes.filter((n) => n.sourceId === source.id).map((n) => n.text)].join(" ");
      if (keywordOverlap(s.text.replace(/\[[\d,\s]+\]/g, ""), evidence) < 0.2) {
        problems.push({ kind: "weakSupport", sentence: s.text, sourceId: source.id, ref });
      }
      if (source.trust === "careful") {
        problems.push({ kind: "carefulSource", sentence: s.text, sourceId: source.id, ref });
      }
    }
  }

  for (const source of sources) {
    if (source.saved && source.ref !== null && !used.has(source.ref)) {
      problems.push({ kind: "unusedSource", sentence: null, sourceId: source.id, ref: source.ref });
    }
  }
  return problems;
}
