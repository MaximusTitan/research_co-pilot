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

/** Abbreviations that never end a sentence ("Dr. Lee", "e.g. bees"). */
const NEVER_ENDS = new Set(["dr", "mr", "mrs", "ms", "prof", "st", "vs", "e.g", "i.e", "cf", "fig", "no", "approx"]);

/**
 * Whether the full stop at `dot` ends the sentence. Dotted abbreviations such
 * as "a.m." or "U.S." end it only when a capital letter comes next.
 */
function endsAtDot(text: string, from: number, dot: number, after: number): boolean {
  const token = (text.slice(from, dot).match(/[\p{L}\p{N}.]+$/u)?.[0] ?? "").toLowerCase();
  if (NEVER_ENDS.has(token)) return false;
  if (!token.includes(".")) return true;
  return /^\s*\p{Lu}/u.test(text.slice(after));
}

/** Splits text into sentences, keeping their character offsets. Decimals ("90.6") and abbreviations don't split. */
export function sentences(text: string): Sentence[] {
  const out: Sentence[] = [];
  const push = (from: number, to: number) => {
    const raw = text.slice(from, to);
    const trimmed = raw.trim();
    if (!trimmed) return;
    const start = from + raw.length - raw.trimStart().length;
    out.push({ text: trimmed, start, end: start + trimmed.length });
  };
  // "।" (danda) ends a sentence in Hindi. Punctuation only ends one when a space or the end of the text follows.
  const re = /[.!?।]+["'”)\]]*(?=\s|$)|\n/g;
  let from = 0;
  for (const match of text.matchAll(re)) {
    const at = match.index ?? 0;
    const after = at + match[0].length;
    if (/^\.["'”)\]]*$/.test(match[0]) && !endsAtDot(text, from, at, after)) continue;
    push(from, after);
    from = after;
  }
  push(from, text.length);
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
