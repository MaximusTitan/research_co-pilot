import { describe, expect, it } from "vitest";
import { addDocumentSource, addNote, addSection, createProject, moveSection, removeSection, toggleSaved } from "../lib/project";
import type { Source } from "../lib/types";

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
