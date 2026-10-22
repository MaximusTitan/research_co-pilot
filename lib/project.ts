import { newId } from "./text";
import type { Brief, GradeBand, Note, Project, Section, SectionKind, Source, WritingType } from "./types";

export interface NewProjectInput {
  topic: string;
  writingType: WritingType;
  grade: GradeBand;
  introTitle: string;
  conclusionTitle: string;
}

/** Directions for projects started before the Start questions existed. */
export const DEFAULT_BRIEF: Brief = { length: "standard", approach: "facts", approachText: "", sources: "mix", sourcesText: "", style: "apa", extra: "" };

export function createProject(input: NewProjectInput, now = Date.now()): Project {
  return {
    id: newId(),
    createdAt: now,
    updatedAt: now,
    topic: input.topic.trim(),
    writingType: input.writingType,
    grade: input.grade,
    coachMessage: null,
    angles: [],
    selectedAngleId: null,
    question: null,
    plan: [],
    sources: [],
    nextRef: 1,
    notes: [],
    sections: [makeSection("intro", input.introTitle), makeSection("conclusion", input.conclusionTitle)],
    gaps: [],
  };
}

function makeSection(kind: SectionKind, title: string): Section {
  return { id: newId(), kind, title, draft: "" };
}

// ---------- Sources ----------

function sourceKey(s: Pick<Source, "url" | "title">): string {
  return (s.url ?? s.title).toLowerCase();
}

/** Adds newly found sources, skipping ones already in the project. */
export function addSources(p: Project, found: Source[]): Project {
  const seen = new Set(p.sources.map(sourceKey));
  const fresh = found.filter((s) => !seen.has(sourceKey(s)));
  return { ...p, sources: [...p.sources, ...fresh] };
}

/** Stores a document the student uploaded: saved at once, with its key findings as notes. */
export function addDocumentSource(p: Project, source: Source, findings: string[]): Project {
  const saved: Source = { ...source, saved: true, ref: p.nextRef };
  const notes: Note[] = findings
    .map((text) => text.trim())
    .filter(Boolean)
    .map((text) => ({ id: newId(), text, sourceId: saved.id, sectionId: null }));
  return { ...p, nextRef: p.nextRef + 1, sources: [...p.sources, saved], notes: [...p.notes, ...notes] };
}

/** Saves a source if it isn't already, giving it a citation number. */
export function saveSource(p: Project, sourceId: string): Project {
  const source = p.sources.find((s) => s.id === sourceId);
  return !source || source.saved ? p : toggleSaved(p, sourceId);
}

/** Every source a note came from must be saved, or drafts written from those notes can't cite it. */
export function saveNoteSources(p: Project): Project {
  return p.notes.reduce((next, n) => (n.sourceId ? saveSource(next, n.sourceId) : next), p);
}

/** Drops the sources found for the old question that the student never used, so a new search can replace them. */
export function setQuestion(p: Project, question: string, angleId: string | null): Project {
  if (question === p.question) return { ...p, selectedAngleId: angleId };
  const used = new Set(p.notes.map((n) => n.sourceId));
  return {
    ...p,
    selectedAngleId: angleId,
    question,
    searchedFor: p.searchedFor ?? p.question ?? p.topic,
    sources: p.sources.filter((s) => s.saved || s.marked || used.has(s.id)),
  };
}

/** True when there are no sources yet, or they were found for a different question. */
export function needsSearch(p: Project): boolean {
  if (p.sources.length === 0) return true;
  return p.searchedFor !== undefined && p.searchedFor !== (p.question ?? p.topic);
}

export function toggleSaved(p: Project, sourceId: string): Project {
  let nextRef = p.nextRef;
  const sources = p.sources.map((s) => {
    if (s.id !== sourceId) return s;
    if (s.saved) return { ...s, saved: false };
    // A source keeps its citation number for life so [n] in the draft never shifts.
    const ref = s.ref ?? nextRef++;
    return { ...s, saved: true, ref };
  });
  return { ...p, sources, nextRef };
}

export function toggleMarked(p: Project, sourceId: string): Project {
  return { ...p, sources: p.sources.map((s) => (s.id === sourceId ? { ...s, marked: !s.marked } : s)) };
}

export function savedSources(p: Project): Source[] {
  return p.sources.filter((s) => s.saved).sort((a, b) => (a.ref ?? 0) - (b.ref ?? 0));
}

// ---------- Notes ----------

export function addNote(p: Project, text: string, sourceId: string | null, sectionId: string | null = null): Project {
  const note: Note = { id: newId(), text: text.trim(), sourceId, sectionId };
  if (!note.text) return p;
  return { ...p, notes: [...p.notes, note] };
}

/** Takes a note from a source and saves that source, so the note can be cited later. */
export function addSourceNote(p: Project, source: Source): Project {
  const next = addNote(p, source.keyQuote ?? source.summary, source.id);
  return next === p ? p : saveSource(next, source.id);
}

export function updateNote(p: Project, noteId: string, text: string): Project {
  return { ...p, notes: p.notes.map((n) => (n.id === noteId ? { ...n, text } : n)) };
}

export function deleteNote(p: Project, noteId: string): Project {
  return { ...p, notes: p.notes.filter((n) => n.id !== noteId) };
}

export function moveNote(p: Project, noteId: string, sectionId: string | null): Project {
  if (sectionId !== null && !p.sections.some((s) => s.id === sectionId)) return p;
  return { ...p, notes: p.notes.map((n) => (n.id === noteId ? { ...n, sectionId } : n)) };
}

export function notesFor(p: Project, sectionId: string | null): Note[] {
  return p.notes.filter((n) => n.sectionId === sectionId);
}

// ---------- Sections ----------

/** Inserts a body section just before the conclusion. */
export function addSection(p: Project, title: string): Project {
  const section = makeSection("body", title.trim());
  if (!section.title) return p;
  const end = p.sections.findIndex((s) => s.kind === "conclusion");
  const at = end === -1 ? p.sections.length : end;
  return { ...p, sections: [...p.sections.slice(0, at), section, ...p.sections.slice(at)] };
}

/** Finds a body section by title (case-insensitive), creating it if needed. */
export function ensureSection(p: Project, title: string): { project: Project; sectionId: string } {
  const existing = p.sections.find((s) => s.title.toLowerCase() === title.trim().toLowerCase());
  if (existing) return { project: p, sectionId: existing.id };
  const next = addSection(p, title);
  const created = next.sections.find((s) => s.kind === "body" && s.title === title.trim());
  return created ? { project: next, sectionId: created.id } : { project: p, sectionId: "" };
}

export function renameSection(p: Project, sectionId: string, title: string): Project {
  return { ...p, sections: p.sections.map((s) => (s.id === sectionId ? { ...s, title } : s)) };
}

/** Removes a body section; its notes go back to "not sorted". */
export function removeSection(p: Project, sectionId: string): Project {
  const target = p.sections.find((s) => s.id === sectionId);
  if (!target || target.kind !== "body") return p;
  return {
    ...p,
    sections: p.sections.filter((s) => s.id !== sectionId),
    notes: p.notes.map((n) => (n.sectionId === sectionId ? { ...n, sectionId: null } : n)),
  };
}

/** Moves a body section to a new index, keeping intro first and conclusion last. */
export function moveSection(p: Project, sectionId: string, toIndex: number): Project {
  const from = p.sections.findIndex((s) => s.id === sectionId);
  if (from === -1 || p.sections[from].kind !== "body") return p;
  const firstBody = p.sections.findIndex((s) => s.kind === "body");
  const lastBody = p.sections.length - 1 - [...p.sections].reverse().findIndex((s) => s.kind === "body");
  const to = Math.min(Math.max(toIndex, firstBody), lastBody);
  const sections = [...p.sections];
  const [moved] = sections.splice(from, 1);
  sections.splice(to, 0, moved);
  return { ...p, sections };
}

export function setDraft(p: Project, sectionId: string, draft: string): Project {
  return { ...p, sections: p.sections.map((s) => (s.id === sectionId ? { ...s, draft } : s)) };
}

export interface OutlineSuggestion {
  title: string;
  keyPoint: string;
  noteIds: string[];
}

/**
 * Applies an AI outline: creates or reuses each body section, records its key
 * point and moves the listed notes into it. Unknown note ids are ignored, and
 * a note is only moved once even if it is listed twice.
 */
export function applyOutline(p: Project, suggestions: OutlineSuggestion[]): Project {
  let next = p;
  const moved = new Set<string>();
  for (const s of suggestions) {
    const title = s.title.trim();
    if (!title) continue;
    const ensured = ensureSection(next, title);
    if (!ensured.sectionId) continue;
    next = {
      ...ensured.project,
      sections: ensured.project.sections.map((sec) => (sec.id === ensured.sectionId ? { ...sec, keyPoint: s.keyPoint.trim() || undefined } : sec)),
    };
    for (const noteId of s.noteIds) {
      if (moved.has(noteId) || !next.notes.some((n) => n.id === noteId)) continue;
      moved.add(noteId);
      next = moveNote(next, noteId, ensured.sectionId);
    }
  }
  return next;
}

/** Applies the note sorter's suggestions: each note goes into the named section, created if needed. */
export function applySort(p: Project, assignments: { noteId: string; section: string }[]): Project {
  let next = p;
  for (const a of assignments) {
    if (!p.notes.some((n) => n.id === a.noteId)) continue;
    const ensured = ensureSection(next, a.section);
    next = moveNote(ensured.project, a.noteId, ensured.sectionId || null);
  }
  return next;
}

/** How notes and sections are laid out, kept so an AI sort or outline can be undone. */
export type Arrangement = Pick<Project, "sections" | "notes">;

export function arrangementOf(p: Project): Arrangement {
  return { sections: p.sections, notes: p.notes };
}

/**
 * Puts sections and note placement back the way they were. Writing done since
 * is kept: drafts carry over by section id and new or edited notes stay.
 */
export function restoreArrangement(p: Project, before: Arrangement): Project {
  const drafts = new Map(p.sections.map((s) => [s.id, s.draft]));
  const placed = new Map(before.notes.map((n) => [n.id, n.sectionId]));
  const sections = before.sections.map((s) => ({ ...s, draft: drafts.get(s.id) ?? s.draft }));
  const ids = new Set(sections.map((s) => s.id));
  const notes = p.notes.map((n) => {
    const sectionId = placed.has(n.id) ? (placed.get(n.id) ?? null) : n.sectionId;
    return { ...n, sectionId: sectionId && ids.has(sectionId) ? sectionId : null };
  });
  return { ...p, sections, notes };
}

export const STEP_PATHS = ["/generate", "/refine", "/sources", "/notes", "/outline", "/write", "/review"] as const;

/** Whether a step already has the student's work in it, for the progress marks in the step bar. */
export function stepHasWork(p: Project, step: (typeof STEP_PATHS)[number]): boolean {
  switch (step) {
    case "/refine":
      return Boolean(p.question);
    case "/sources":
      return p.sources.some((s) => s.saved);
    case "/notes":
      return p.notes.length > 0;
    case "/outline":
      return p.sections.some((s) => s.kind === "body");
    case "/write":
      return p.sections.some((s) => s.draft.trim());
    default:
      return false;
  }
}

/** Where to send the student when they reopen a project: the step they left, or the AI writer for a new one. */
export function resumePath(p: Project): string {
  return STEP_PATHS.find((s) => s === p.lastStep) ?? "/generate";
}

/** Replaces the first occurrence of a sentence in whichever section contains it. */
export function replaceInDrafts(p: Project, original: string, replacement: string): { project: Project; replaced: boolean } {
  const target = p.sections.find((s) => s.draft.includes(original));
  if (!target || !original) return { project: p, replaced: false };
  return { project: setDraft(p, target.id, target.draft.replace(original, replacement)), replaced: true };
}

/** Puts the section's text in place only if the student hasn't written anything there yet. */
export function fillIfEmpty(p: Project, sectionId: string, draft: string): Project {
  const target = p.sections.find((s) => s.id === sectionId);
  if (!target || target.draft.trim() || !draft.trim()) return p;
  return setDraft(p, sectionId, draft.trim());
}

export function fullDraft(p: Project): string {
  return p.sections.map((s) => s.draft.trim()).filter(Boolean).join("\n\n");
}
