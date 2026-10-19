import { describe, expect, it } from "vitest";
import { offlineDraft, offlineFeedback, offlineFixClaim, offlineOutline } from "../lib/agents/offline";
import { draftInput } from "../lib/agents/schemas";
import { applyAllFixes, checkGrammar, fixAllGrammar } from "../lib/checks";
import { keepKnownCitations } from "../lib/citations";
import { addNote, addSection, applyOutline, createProject, fillIfEmpty, replaceInDrafts, setDraft } from "../lib/project";

const base = {
  topic: "Why are bees disappearing?",
  writingType: "report" as const,
  grade: "7-8" as const,
  introTitle: "Introduction",
  conclusionTitle: "Conclusion",
};

describe("keepKnownCitations", () => {
  it("keeps citations to saved sources and drops the rest", () => {
    const allowed = new Set([1, 2]);
    expect(keepKnownCitations("Bees need flowers [1]. Mites spread [7]. Both matter [2, 9].", allowed)).toBe(
      "Bees need flowers [1]. Mites spread. Both matter [2].",
    );
  });
});

describe("applyAllFixes", () => {
  it("applies non-overlapping fixes in one pass without shifting positions", () => {
    const text = "becouse their is a the the problem.";
    expect(applyAllFixes(text, checkGrammar(text, "adult"))).toBe("because there is a the problem.");
  });

  it("re-checks until nothing is left to fix", () => {
    expect(fixAllGrammar("becouse their is a the the problem.", "adult")).toBe("Because there is a the problem.");
  });
});

describe("applyOutline", () => {
  it("creates sections, records key points and moves known notes once", () => {
    let p = createProject(base);
    p = addNote(p, "Pesticides confuse bees.", null);
    p = addNote(p, "Mites carry viruses.", null);
    const [n1, n2] = p.notes.map((n) => n.id);
    p = applyOutline(p, [
      { title: "Pesticides", keyPoint: "Pesticides harm how bees navigate.", noteIds: [n1, "unknown-id"] },
      { title: "Disease", keyPoint: "Parasites weaken hives.", noteIds: [n2, n1] },
    ]);
    const pesticides = p.sections.find((s) => s.title === "Pesticides");
    const disease = p.sections.find((s) => s.title === "Disease");
    expect(p.sections.map((s) => s.kind)).toEqual(["intro", "body", "body", "conclusion"]);
    expect(pesticides?.keyPoint).toBe("Pesticides harm how bees navigate.");
    expect(p.notes.find((n) => n.id === n1)?.sectionId).toBe(pesticides?.id);
    expect(p.notes.find((n) => n.id === n2)?.sectionId).toBe(disease?.id);
  });

  it("reuses an existing section with the same title", () => {
    const p = applyOutline(addSection(createProject(base), "Pesticides"), [{ title: "pesticides", keyPoint: "x", noteIds: [] }]);
    expect(p.sections.filter((s) => s.kind === "body")).toHaveLength(1);
  });
});

describe("fillIfEmpty", () => {
  it("never overwrites what the student already wrote", () => {
    const p = createProject(base);
    const intro = p.sections[0].id;
    const written = setDraft(p, intro, "My own words.");
    expect(fillIfEmpty(written, intro, "AI text").sections[0].draft).toBe("My own words.");
    expect(fillIfEmpty(p, intro, "AI text").sections[0].draft).toBe("AI text");
  });
});

describe("replaceInDrafts", () => {
  it("replaces the sentence in the section that contains it", () => {
    const p = setDraft(createProject(base), createProject(base).sections[0].id, "");
    const withText = setDraft(p, p.sections[1].id, "Bees are vanishing. Farms need them.");
    const { project, replaced } = replaceInDrafts(withText, "Bees are vanishing.", "Bee colonies are shrinking [1].");
    expect(replaced).toBe(true);
    expect(project.sections[1].draft).toBe("Bee colonies are shrinking [1]. Farms need them.");
  });

  it("reports when the sentence is no longer there", () => {
    expect(replaceInDrafts(createProject(base), "Gone.", "x").replaced).toBe(false);
  });
});

describe("offline writing helpers", () => {
  const draftBase = {
    question: "Why are bees disappearing?",
    writingType: "report" as const,
    grade: "7-8" as const,
    locale: "en" as const,
    outline: ["Introduction", "Pesticides", "Disease", "Conclusion"],
    sources: [{ ref: 1, title: "EPA", summary: "Pesticides harm bees." }],
    existing: "",
  };

  it("builds a body draft only from notes, keeping their citations", () => {
    const out = offlineDraft({
      ...draftBase,
      section: { kind: "body", title: "Pesticides", keyPoint: "Pesticides harm bees" },
      notes: [
        { text: "Bees exposed to pesticides lose their way home.", ref: 1 },
        { text: "My own idea about farms", ref: null },
      ],
    });
    expect(out.text).toBe("Pesticides harm bees. Bees exposed to pesticides lose their way home [1]. My own idea about farms.");
  });

  it("returns nothing for a body section without notes", () => {
    expect(offlineDraft({ ...draftBase, section: { kind: "body", title: "X", keyPoint: null }, notes: [] }).text).toBe("");
  });

  it("frames the introduction around the question and the body sections", () => {
    const out = offlineDraft({ ...draftBase, section: { kind: "intro", title: "Introduction", keyPoint: null }, notes: [] });
    expect(out.text).toContain("Why are bees disappearing?");
    expect(out.text).toContain("pesticides and disease");
  });

  it("cites the best-matching saved source, or explains when none fits", () => {
    const sources = [{ ref: 3, title: "Pesticide study", summary: "Pesticides reduce bee foraging." }];
    const fixed = offlineFixClaim({ sentence: "Pesticides reduce bee foraging [9].", problem: "missingSource", sources, notes: [], grade: "7-8", locale: "en" });
    expect(fixed.replacement).toBe("Pesticides reduce bee foraging [3].");
    const none = offlineFixClaim({ sentence: "Penguins migrate in winter.", problem: "uncitedClaim", sources, notes: [], grade: "7-8", locale: "en" });
    expect(none.replacement).toBe("Penguins migrate in winter.");
  });

  it("groups notes into outline sections, with leftovers kept", () => {
    const out = offlineOutline({
      question: "Why are bees disappearing?",
      writingType: "report",
      grade: "7-8",
      locale: "en",
      notes: [
        { id: "a", text: "Pesticide sprays harm bees", source: null },
        { id: "b", text: "Pesticide use is rising", source: null },
        { id: "c", text: "Winters are warmer", source: null },
      ],
    });
    const used = out.sections.flatMap((s) => s.noteIds).sort();
    expect(used).toEqual(["a", "b", "c"]);
  });

  it("flags empty and uncited sections in feedback", () => {
    const out = offlineFeedback({
      question: "Why are bees disappearing?",
      writingType: "report",
      grade: "7-8",
      locale: "en",
      sections: [
        { title: "Introduction", text: "" },
        { title: "Pesticides", text: Array.from({ length: 50 }, () => "word").join(" ") },
        { title: "Conclusion", text: "Short." },
      ],
    });
    expect(out.improvements.map((i) => i.section)).toEqual(["Introduction", "Pesticides", "Conclusion"]);
  });
});

describe("draft input validation", () => {
  it("rejects a citation number below 1", () => {
    const result = draftInput.safeParse({
      question: "Why are bees disappearing?",
      writingType: "report",
      grade: "7-8",
      locale: "en",
      section: { kind: "body", title: "Pesticides", keyPoint: null },
      outline: [],
      notes: [{ text: "x", ref: 0 }],
      sources: [],
    });
    expect(result.success).toBe(false);
  });
});
