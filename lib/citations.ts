import type { Source } from "./types";

export type CitationStyle = "apa" | "mla";

interface Name {
  given: string[];
  family: string;
}

function parseName(full: string): Name {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return { given: [], family: parts[0] ?? "" };
  return { given: parts.slice(0, -1), family: parts[parts.length - 1] };
}

function initials(given: string[]): string {
  return given
    .map((g) => g.replace(/[^\p{L}-]/gu, ""))
    .filter(Boolean)
    .map((g) =>
      g
        .split("-")
        .map((part) => `${part[0].toUpperCase()}.`)
        .join("-"),
    )
    .join(" ");
}

function apaAuthor(full: string): string {
  const { given, family } = parseName(full);
  const init = initials(given);
  return init ? `${family}, ${init}` : family;
}

function apaAuthors(authors: string[]): string {
  const names = authors.slice(0, 20).map(apaAuthor);
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]}, & ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, & ${names[names.length - 1]}`;
}

function mlaAuthors(authors: string[]): string {
  const first = parseName(authors[0]);
  const inverted = first.given.length ? `${first.family}, ${first.given.join(" ")}` : first.family;
  if (authors.length === 1) return inverted;
  if (authors.length === 2) return `${inverted}, and ${authors[1].trim()}`;
  return `${inverted}, et al`;
}

function withPeriod(text: string): string {
  return /[.?!]$/.test(text) ? text : `${text}.`;
}

export function formatCitation(source: Source, style: CitationStyle): string {
  const authors = source.authors.filter((a) => a.trim());
  const url = source.url ?? "";

  if (style === "apa") {
    const who = authors.length ? apaAuthors(authors) : source.publisher;
    const year = source.year ?? "n.d.";
    const publisher = authors.length && source.publisher ? ` ${withPeriod(source.publisher)}` : "";
    return `${withPeriod(who)} (${year}). ${withPeriod(source.title)}${publisher}${url ? ` ${url}` : ""}`.trim();
  }

  const who = authors.length ? `${withPeriod(mlaAuthors(authors))} ` : "";
  const tail = [source.publisher, source.year?.toString(), url].filter(Boolean).join(", ");
  return `${who}"${withPeriod(source.title)}" ${tail ? withPeriod(tail) : ""}`.trim();
}

/**
 * Removes citation numbers that don't belong to a saved source, so AI-written
 * text can never point a reader at a reference that isn't in the bibliography.
 */
export function keepKnownCitations(text: string, allowed: ReadonlySet<number>): string {
  return text
    .replace(/\s*\[(\d+(?:\s*,\s*\d+)*)\]/g, (match, group: string) => {
      const kept = group
        .split(",")
        .map((n) => Number(n.trim()))
        .filter((n) => allowed.has(n));
      if (kept.length === 0) return "";
      const lead = match.match(/^\s*/)?.[0] ?? "";
      return `${lead}[${kept.join(", ")}]`;
    })
    .trim();
}

/** Citation numbers like [1] or [2, 3] used in the draft. */
export function citedRefs(text: string): number[] {
  const refs = new Set<number>();
  for (const match of text.matchAll(/\[(\d+(?:\s*,\s*\d+)*)\]/g)) {
    for (const n of match[1].split(",")) refs.add(Number(n.trim()));
  }
  return [...refs].sort((a, b) => a - b);
}
