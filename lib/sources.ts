import { rateSource } from "./credibility";
import { newId } from "./text";
import type { Source } from "./types";
import type { SourceDto } from "./agents/schemas";

/**
 * Turns an agent suggestion into a stored source. Trust is rated here, with the
 * same rules every time, rather than trusting the model's own label.
 */
export function toSource(dto: SourceDto): Source {
  const rating = rateSource({ url: dto.url, kind: dto.kind, authors: dto.authors });
  return {
    id: newId(),
    ref: null,
    title: dto.title,
    url: dto.url,
    publisher: dto.publisher,
    kind: rating.kind,
    year: dto.year,
    authors: dto.authors,
    summary: dto.summary,
    keyQuote: dto.keyQuote,
    trust: rating.trust,
    trustReason: rating.reasonKey,
    saved: false,
    marked: false,
  };
}

export function documentSource(title: string, summary: string): Source {
  return {
    id: newId(),
    ref: null,
    title,
    url: null,
    publisher: "",
    kind: "document",
    year: null,
    authors: [],
    summary,
    keyQuote: null,
    trust: "check",
    trustReason: "userDocument",
    saved: false,
    marked: false,
  };
}

export type SourceFilter = "all" | "trusted" | "saved";

export function filterSources(sources: Source[], filter: SourceFilter): Source[] {
  if (filter === "trusted") return sources.filter((s) => s.trust === "trusted");
  if (filter === "saved") return sources.filter((s) => s.saved);
  return sources;
}
