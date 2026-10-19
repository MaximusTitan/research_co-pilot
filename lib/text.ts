const STOPWORDS = new Set(
  (
    "a an and are as at be been but by can could do does for from had has have how i if in into is it its " +
    "of on or our so than that the their them then there these they this to was we were what when where which " +
    "who why will with would you your about also more most some such not no very just over only other many much " +
    "और का की के है हैं में से को पर यह वह भी एक कि जो तो था थी थे हो रहा रही रहे लिए क्या कैसे क्यों ने इस उस इन उन नहीं"
  ).split(" "),
);

/**
 * Splits text into lower-case words. \p{M} keeps combining marks (such as
 * Hindi vowel signs) inside the word instead of cutting the word apart.
 */
export function words(text: string): string[] {
  return text.toLowerCase().match(/[\p{L}\p{M}\p{N}']+/gu) ?? [];
}

export function keywords(text: string): string[] {
  return words(text).filter((w) => w.length > 2 && !STOPWORDS.has(w));
}

export interface Sentence {
  text: string;
  start: number;
  end: number;
}

/** Splits text into sentences, keeping their character offsets. */
export function sentences(text: string): Sentence[] {
  const out: Sentence[] = [];
  // "।" (danda) ends a sentence in Hindi.
  const re = /[^.!?।\n]+(?:[.!?।]+["'”)\]]*|\n|$)/g;
  for (const match of text.matchAll(re)) {
    const raw = match[0];
    const lead = raw.length - raw.trimStart().length;
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const start = (match.index ?? 0) + lead;
    out.push({ text: trimmed, start, end: start + trimmed.length });
  }
  return out;
}

/** Share of `a`'s keywords that also appear in `b` (0..1). */
export function keywordOverlap(a: string, b: string): number {
  const ka = new Set(keywords(a));
  if (ka.size === 0) return 0;
  const kb = new Set(keywords(b));
  let hits = 0;
  for (const k of ka) if (kb.has(k)) hits++;
  return hits / ka.size;
}

export function shingles(text: string, size: number): Set<string> {
  const w = words(text);
  const out = new Set<string>();
  for (let i = 0; i + size <= w.length; i++) out.add(w.slice(i, i + size).join(" "));
  return out;
}

export function clip(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
}

export function newId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
