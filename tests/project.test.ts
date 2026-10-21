import { describe, expect, it } from "vitest";
import {
  addDocumentSource,
  addNote,
  addSection,
  addSourceNote,
  applySort,
  arrangementOf,
  createProject,
  moveSection,
  needsSearch,
  removeSection,
  restoreArrangement,
  resumePath,
  saveNoteSources,
  setDraft,
  setQuestion,
  toggleSaved,
} from "../lib/project";
import type { Project, Source } from "../lib/types";

const input = {
  topic: "Why are bees disappearing?",
  writingType: "report" as const,
  grade: "7-8" as const,
  introTitle: "Introduction",
  conclusionTitle: "Conclusion",
};

function src(id: string, title: string): Source {
  return {
    id,
    ref: null,
    title,
    url: `https://example.com/${id}`,
    publisher: "",
    kind: "website",
    year: null,
    authors: [],
    summary: "",
    keyQuote: null,
    trust: "check",
    trustReason: "unknownSite",
    saved: false,
    marked: false,
  };
}

describe("notes from sources", () => {
  it("saves the source when one of its facts is added to notes, so drafts can cite it", () => {
    let p = createProject(input);
    p = { ...p, sources: [{ ...src("a", "A"), summary: "Bees pollinate crops." }] };
    p = addSourceNote(p, p.sources[0]);
    expect(p.notes[0]).toMatchObject({ text: "Bees pollinate crops.", sourceId: "a" });
    expect(p.sources[0]).toMatchObject({ saved: true, ref: 1 });
  });

  it("saves sources behind older notes before drafting", () => {
    let p = createProject(input);
    p = addNote({ ...p, sources: [src("a", "A")] }, "Fact", "a");
    expect(saveNoteSources(p).sources[0].ref).toBe(1);
    const saved = saveNoteSources(p);
    expect(saveNoteSources(saved)).toBe(saved);
  });
});

describe("changing the question", () => {
  it("asks for a new search and drops sources the student never used", () => {
    let p: Project = { ...createProject(input), question: "Old?", searchedFor: "Old?" };
    p = { ...p, sources: [src("unused", "U"), { ...src("kept", "K"), saved: true, ref: 1 }, src("noted", "N")] };
    p = addNote(p, "Fact", "noted");
    expect(needsSearch(p)).toBe(false);
    const next = setQuestion(p, "New?", null);
    expect(needsSearch(next)).toBe(true);
    expect(next.sources.map((s) => s.id)).toEqual(["kept", "noted"]);
    expect(needsSearch({ ...next, searchedFor: "New?" })).toBe(false);
  });

  it("keeps everything when the same question is picked again", () => {
    const p = { ...createProject(input), question: "Same?", sources: [src("a", "A")] };
    expect(setQuestion(p, "Same?", null).sources).toHaveLength(1);
    expect(needsSearch(setQuestion(p, "Same?", null))).toBe(false);
  });

  it("searches again for older projects that never recorded what they searched for", () => {
    const p = { ...createProject(input), question: "Old?", sources: [src("a", "A")] };
    expect(needsSearch(p)).toBe(false);
    expect(needsSearch(setQuestion(p, "New?", null))).toBe(true);
  });
});

describe("undoing an AI sort", () => {
  it("restores sections and note placement but keeps writing done since", () => {
    let p = addNote(createProject(input), "Fact", null);
    const before = arrangementOf(p);
    p = applySort(p, [{ noteId: p.notes[0].id, section: "Habitat" }]);
    expect(p.sections).toHaveLength(3);
    p = setDraft(p, p.sections[0].id, "My intro");
    p = addNote(p, "Later note", null);
    const undone = restoreArrangement(p, before);
    expect(undone.sections.map((s) => s.kind)).toEqual(["intro", "conclusion"]);
    expect(undone.sections[0].draft).toBe("My intro");
    expect(undone.notes.map((n) => n.sectionId)).toEqual([null, null]);
  });
});

describe("resuming a project", () => {
  it("opens on the last step, or Refine if none is known", () => {
    const p = createProject(input);
    expect(resumePath(p)).toBe("/refine");
    expect(resumePath({ ...p, lastStep: "/write" })).toBe("/write");
    expect(resumePath({ ...p, lastStep: "/elsewhere" })).toBe("/refine");
  });
});

describe("project model", () => {
  it("starts with an intro and a conclusion", () => {
    const p = createProject(input);
    expect(p.sections.map((s) => s.kind)).toEqual(["intro", "conclusion"]);
  });

  it("keeps citation numbers stable when a source is unsaved and saved again", () => {
    let p = createProject(input);
    p = { ...p, sources: [src("a", "A"), src("b", "B")] };
    p = toggleSaved(p, "a");
    p = toggleSaved(p, "b");
    expect(p.sources.find((s) => s.id === "a")?.ref).toBe(1);
    p = toggleSaved(p, "a");
    p = toggleSaved(p, "a");
    expect(p.sources.find((s) => s.id === "a")?.ref).toBe(1);
    expect(p.sources.find((s) => s.id === "b")?.ref).toBe(2);
  });

  it("inserts new body sections before the conclusion", () => {
    const p = addSection(createProject(input), "Pesticides");
    expect(p.sections.map((s) => s.title)).toEqual(["Introduction", "Pesticides", "Conclusion"]);
  });

  it("never moves a body section above the introduction or below the conclusion", () => {
    let p = addSection(createProject(input), "Pesticides");
    p = addSection(p, "Habitat");
    const pesticides = p.sections[1].id;
    expect(moveSection(p, pesticides, 0).sections[0].kind).toBe("intro");
    expect(moveSection(p, pesticides, 99).sections.at(-1)?.kind).toBe("conclusion");
  });

  it("returns notes to 'not sorted' when their section is removed", () => {
    let p = addSection(createProject(input), "Pesticides");
    const sectionId = p.sections[1].id;
    p = addNote(p, "Bees eat pesticide nectar.", null);
    p = { ...p, notes: p.notes.map((n) => ({ ...n, sectionId })) };
    p = removeSection(p, sectionId);
    expect(p.notes[0].sectionId).toBeNull();
  });

  it("does not remove the conclusion", () => {
    const p = createProject(input);
    expect(removeSection(p, p.sections[1].id).sections).toHaveLength(2);
  });

  it("stores an uploaded document as a saved source with its findings as notes", () => {
    const doc = { ...src("doc", "My file"), kind: "document" as const };
    const p = addDocumentSource(createProject(input), doc, ["Finding one", "  "]);
    expect(p.sources[0]).toMatchObject({ saved: true, ref: 1 });
    expect(p.nextRef).toBe(2);
    expect(p.notes.map((n) => n.text)).toEqual(["Finding one"]);
  });
});
