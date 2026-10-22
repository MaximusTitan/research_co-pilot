"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Paper } from "../lib/paper";

/**
 * The finished paper laid out like a journal article: US Letter pages, a title
 * block, an abstract, two justified columns and numbered pages. Text is
 * measured and split across columns and pages the way a typesetter would, at
 * full size, then the pages are scaled to fit the screen. Printing shows the
 * same pages at real size.
 */

const PAGE_W = 816; // 8.5in at 96dpi
const PAGE_H = 1056; // 11in
const MARGIN_X = 60;
const MARGIN_TOP = 72;
const MARGIN_BOTTOM = 72;
const GAP = 24;
const COL_W = (PAGE_W - 2 * MARGIN_X - GAP) / 2;
const BODY_H = PAGE_H - MARGIN_TOP - MARGIN_BOTTOM;
const MAX_SCALE = 1.25;

export interface PaperPagesMeta {
  author: string;
  affiliation: string;
  date: string;
  abstractLabel: string;
  keywordsLabel: string;
  pageLabel: (n: number, total: number) => string;
  lang: string;
}

type Kind = "abstract" | "keywords" | "heading" | "para" | "refHeading" | "ref";
interface Piece {
  kind: Kind;
  text: string;
  id?: string;
  /** Carries on from the previous column, so no first-line indent or label. */
  continued?: boolean;
  /** Breaks to the next column, so its last line is justified too. */
  split?: boolean;
  /** First paragraph after a heading: no indent, as in print. */
  first?: boolean;
}
type Page = [Piece[], Piece[]];

const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII", "XIII", "XIV", "XV", "XVI", "XVII", "XVIII", "XIX", "XX"];

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);
}

function pieceHtml(p: Piece, labels: { abstract: string; keywords: string }, withId: boolean): string {
  const cls = [`pp-${p.kind}`, p.continued || p.first ? "pp-cont" : "", p.split ? "pp-split" : ""].filter(Boolean).join(" ");
  const id = withId && p.id && !p.continued ? ` id="${p.id}"` : "";
  const text = escapeHtml(p.text);
  switch (p.kind) {
    case "abstract":
      return `<p class="${cls}">${p.continued ? "" : `<em>${escapeHtml(labels.abstract)}</em>—`}${text}</p>`;
    case "keywords":
      return `<p class="${cls}">${p.continued ? "" : `<em>${escapeHtml(labels.keywords)}</em>—`}${text}</p>`;
    case "heading":
    case "refHeading":
      return `<h3 class="${cls}"${id}>${text}</h3>`;
    default:
      return `<p class="${cls}"${id}>${text}</p>`;
  }
}

function headerHtml(paper: Paper, meta: PaperPagesMeta): string {
  return `<h1 class="pp-title">${escapeHtml(paper.title)}</h1>
<p class="pp-author">${escapeHtml(meta.author)}</p>
<p class="pp-affil">${escapeHtml(meta.affiliation)}</p>
<p class="pp-date">${escapeHtml(meta.date)}</p>`;
}

function toPieces(paper: Paper): Piece[] {
  const out: Piece[] = [];
  if (paper.abstract) out.push({ kind: "abstract", text: paper.abstract });
  if (paper.keywords.length) out.push({ kind: "keywords", text: paper.keywords.join(", ") });
  paper.sections.forEach((s, i) => {
    out.push({ kind: "heading", text: `${ROMAN[i] ?? i + 1}. ${s.heading}`, id: `paper-section-${i}` });
    s.paragraphs.forEach((text, j) => out.push({ kind: "para", text, first: j === 0 }));
  });
  if (paper.references.length) {
    out.push({ kind: "refHeading", text: paper.referencesTitle, id: "paper-references" });
    paper.references.forEach((text) => out.push({ kind: "ref", text }));
  }
  return out;
}

/**
 * Fills columns top to bottom, splitting paragraphs between words when a column
 * runs out. Columns on page `capPage` are no taller than `cap`, which is how
 * the last page gets balanced columns.
 */
function paginate(pieces: Piece[], firstHeight: number, measure: (p: Piece) => number, line: number, capPage = -1, cap = Infinity): Page[] {
  const pages: Page[] = [[[], []]];
  let col = 0;
  const heightOf = (page: number) => Math.min(page === 0 ? firstHeight : BODY_H, page === capPage ? cap : Infinity);
  let avail = heightOf(0);
  const current = () => pages[pages.length - 1][col];
  const next = () => {
    if (col === 0) col = 1;
    else {
      pages.push([[], []]);
      col = 0;
    }
    avail = heightOf(pages.length - 1);
  };
  const place = (p: Piece, h: number) => {
    current().push(p);
    avail -= h;
  };

  for (const original of pieces) {
    let piece = original;
    if (piece.kind === "heading" || piece.kind === "refHeading") {
      const h = measure(piece);
      // Keep a heading with at least two lines of what follows it.
      if (h + 2 * line > avail && current().length) next();
      place(piece, h);
      continue;
    }
    for (;;) {
      const h = measure(piece);
      if (h <= avail + 0.5) {
        place(piece, h);
        break;
      }
      const words = piece.text.split(" ");
      if (avail >= 2 * line && words.length > 1) {
        let lo = 0;
        let hi = words.length - 1;
        while (lo < hi) {
          const mid = Math.ceil((lo + hi) / 2);
          if (measure({ ...piece, text: words.slice(0, mid).join(" "), split: true }) <= avail + 0.5) lo = mid;
          else hi = mid - 1;
        }
        if (lo > 0) {
          const head = { ...piece, text: words.slice(0, lo).join(" "), split: true };
          place(head, measure(head));
          piece = { ...piece, text: words.slice(lo).join(" "), continued: true, split: false };
        }
      }
      if (!current().length) {
        // Too tall for an empty column (one enormous word): place it anyway rather than loop.
        place(piece, h);
        break;
      }
      next();
    }
  }
  return pages;
}

export function PaperPages({ paper, meta }: { paper: Paper; meta: PaperPagesMeta }) {
  const outer = useRef<HTMLDivElement>(null);
  const measurer = useRef<HTMLDivElement>(null);
  const header = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<{ pages: Page[]; headerH: number } | null>(null);
  const [scale, setScale] = useState(1);

  const labels = useMemo(() => ({ abstract: meta.abstractLabel, keywords: meta.keywordsLabel }), [meta.abstractLabel, meta.keywordsLabel]);
  const head = headerHtml(paper, meta);
  const key = JSON.stringify([paper, head, labels]);

  useLayoutEffect(() => {
    const m = measurer.current;
    const h = header.current;
    if (!m || !h) return;
    const measure = (p: Piece) => {
      m.innerHTML = pieceHtml(p, labels, false);
      return (m.firstElementChild as HTMLElement).getBoundingClientRect().height;
    };
    const line = measure({ kind: "para", text: "M", continued: true });
    const headerH = h.getBoundingClientRect().height;
    const pieces = toPieces(JSON.parse(key)[0] as Paper);
    const firstH = BODY_H - headerH;
    let pages = paginate(pieces, firstH, measure, line);
    // Balance the last page: the shortest column height that still fits everything on it.
    const last = pages.length - 1;
    let lo = line * 2;
    let hi = last === 0 ? firstH : BODY_H;
    while (hi - lo > line / 2) {
      const mid = (lo + hi) / 2;
      if (paginate(pieces, firstH, measure, line, last, mid).length === pages.length) hi = mid;
      else lo = mid;
    }
    pages = paginate(pieces, firstH, measure, line, last, hi);
    m.innerHTML = "";
    setLayout({ pages, headerH });
  }, [key, labels]);

  useLayoutEffect(() => {
    const el = outer.current;
    if (!el) return;
    const fit = () => setScale(Math.min(MAX_SCALE, el.clientWidth / PAGE_W));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const total = layout?.pages.length ?? 0;

  return (
    <div ref={outer} className="pp-stack" lang={meta.lang}>
      {/* Off-screen copies at full size, used only to measure text. */}
      <div aria-hidden className="pp-measure">
        <div ref={measurer} className="pp-col" style={{ width: COL_W }} />
        <div ref={header} className="pp-head" style={{ width: PAGE_W - 2 * MARGIN_X }} dangerouslySetInnerHTML={{ __html: head }} />
      </div>

      {layout?.pages.map((cols, i) => {
        const top = MARGIN_TOP + (i === 0 ? layout.headerH : 0);
        return (
          <div key={i} className="pp-frame" style={{ width: PAGE_W * scale, height: PAGE_H * scale }}>
            <div className="pp-page" style={{ width: PAGE_W, height: PAGE_H, transform: `scale(${scale})` }}>
              {i > 0 ? (
                <p className="pp-running" style={{ left: MARGIN_X, right: MARGIN_X, top: MARGIN_TOP / 2 - 8 }}>
                  {paper.title}
                </p>
              ) : (
                <div className="pp-head" style={{ position: "absolute", left: MARGIN_X, right: MARGIN_X, top: MARGIN_TOP }} dangerouslySetInnerHTML={{ __html: head }} />
              )}
              {cols.map((pieces, c) => (
                <div
                  key={c}
                  className="pp-col"
                  style={{ position: "absolute", top, left: MARGIN_X + c * (COL_W + GAP), width: COL_W, height: PAGE_H - top - MARGIN_BOTTOM }}
                  dangerouslySetInnerHTML={{ __html: pieces.map((p) => pieceHtml(p, labels, true)).join("") }}
                />
              ))}
              <p className="pp-folio" style={{ bottom: MARGIN_BOTTOM / 2 - 8 }}>
                {meta.pageLabel(i + 1, total)}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
