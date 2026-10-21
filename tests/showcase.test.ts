import { describe, expect, it } from "vitest";
import { checkGrammar, checkOriginality, verifyCitations } from "../lib/checks";
import { citedRefs } from "../lib/citations";
import { fullDraft } from "../lib/project";
import { SHOWCASE_TOPIC, showcaseProject } from "../lib/showcase";

describe("showcase project", () => {
  const p = showcaseProject(0);
  const draft = fullDraft(p);

  it("passes the app's own citation checks with every source used", () => {
    expect(verifyCitations(draft, p.sources, p.notes)).toEqual([]);
    expect(citedRefs(draft)).toEqual(p.sources.map((s) => s.ref));
  });

  it("has no grammar or style issues and reads as original", () => {
    for (const s of p.sections) expect(checkGrammar(s.draft, p.grade)).toEqual([]);
    expect(checkOriginality(draft, p.sources).score).toBe(100);
  });

  it("links every note to a real section and source", () => {
    const sectionIds = new Set(p.sections.map((s) => s.id));
    const sourceIds = new Set(p.sources.map((s) => s.id));
    for (const n of p.notes) {
      expect(sectionIds.has(n.sectionId ?? "")).toBe(true);
      if (n.sourceId !== null) expect(sourceIds.has(n.sourceId)).toBe(true);
    }
  });

  it("gets fresh ids each time, since project ids are unique across all accounts", () => {
    const other = showcaseProject(0);
    expect(other.id).not.toBe(p.id);
    expect(other.topic).toBe(SHOWCASE_TOPIC);
  });
});
