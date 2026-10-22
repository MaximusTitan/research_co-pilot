import type { Source } from "./types";

export type CitationStyle = "apa" | "mla" | "ieee";
export const CITATION_STYLES: CitationStyle[] = ["apa", "mla", "ieee"];

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

function ieeeAuthors(authors: string[]): string {
  const names = authors.map((a) => {
    const { given, family } = parseName(a);
    const init = initials(given);
    return init ? `${init} ${family}` : family;
  });
  if (names.length <= 2) return names.join(" and ");
  if (names.length > 6) return `${names[0]} et al.`;
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
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

  if (style === "ieee") {
    const who = authors.length ? `${ieeeAuthors(authors)}, ` : "";
    const where = [source.publisher, source.year?.toString()].filter(Boolean).join(", ");
    return `${who}“${source.title.replace(/[.,]$/, "")},” ${where ? withPeriod(where) : ""}${url ? ` [Online]. Available: ${url}` : ""}`.trim();
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

/** Drops a trailing "(…)" from a publisher name: "PubMed Central (NIH)" → "PubMed Central". */
function shortPublisher(publisher: string): string {
  return publisher.replace(/\s*\([^)]*\)\s*$/, "").trim();
}

/**
 * The name a source goes by in the text: family names for authored works,
 * otherwise the publisher, or a short quoted title when two sources would
 * otherwise share a publisher name.
 */
export function inTextName(source: Source, all: Source[], style: "apa" | "mla"): string {
  // Sources sometimes list "et al." as if it were an author; it means "and more".
  const named = source.authors.filter((a) => a.trim());
  const listed = named.filter((a) => !/^et\.?\s*al\.?$/i.test(a.trim()));
  const families = listed.map((a) => parseName(a).family);
  if (families.length >= 1 && listed.length < named.length) return `${families[0]} et al.`;
  if (families.length === 1) return families[0];
  if (families.length === 2) return style === "apa" ? `${families[0]} & ${families[1]}` : `${families[0]} and ${families[1]}`;
  if (families.length > 2) return `${families[0]} et al.`;
  const publisher = shortPublisher(source.publisher);
  const shared = all.filter((s) => s.authors.length === 0 && shortPublisher(s.publisher) === publisher).length > 1;
  if (publisher && !shared) return publisher;
  const words = source.title.split(/\s+/);
  return `“${words.slice(0, 4).join(" ")}${words.length > 4 ? "…" : ""}”`;
}

/**
 * Rewrites the stored [n] markers for the chosen style: APA "(Smith, 2020)",
 * MLA "(Smith)", IEEE keeps "[n]". Drafts always store [n], so switching style
 * never changes what the student wrote.
 */
export function styleCitations(text: string, style: CitationStyle, sources: Source[]): string {
  if (style === "ieee") return text;
  return text.replace(/\[(\d+(?:\s*,\s*\d+)*)\]/g, (match, group: string) => {
    const cited = group
      .split(",")
      .map((n) => sources.find((s) => s.ref === Number(n.trim())))
      .filter((s): s is Source => Boolean(s));
    if (cited.length === 0) return match;
    const parts = cited.map((s) => {
      const name = inTextName(s, sources, style);
      return style === "apa" ? `${name}, ${s.year ?? "n.d."}` : name;
    });
    return `(${parts.join("; ")})`;
  });
}

/** Citation numbers like [1] or [2, 3] used in the draft. */
export function citedRefs(text: string): number[] {
  const refs = new Set<number>();
  for (const match of text.matchAll(/\[(\d+(?:\s*,\s*\d+)*)\]/g)) {
    for (const n of match[1].split(",")) refs.add(Number(n.trim()));
  }
  return [...refs].sort((a, b) => a - b);
}
