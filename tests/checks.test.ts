import { describe, expect, it } from "vitest";
import { applyFix, checkGrammar, checkOriginality, verifyCitations } from "../lib/checks";
import type { Source } from "../lib/types";

const source: Source = {
  id: "src",
  ref: 1,
  title: "Bee study",
  url: null,
  publisher: "",
  kind: "paper",
  year: 2022,
  authors: [],
  summary: "Pesticide exposure reduces the foraging success of honey bees in field trials across three regions.",
  keyQuote: null,
  trust: "trusted",
  trustReason: "peerReviewed",
  saved: true,
  marked: false,
};

describe("checkGrammar", () => {
  it("finds misspellings and offers a fix that keeps capitals", () => {
    const text = "Becouse bees matter.";
    const fix = checkGrammar(text, "7-8").find((i) => i.messageKey === "misspelling");
    expect(fix?.replacement).toBe("Because");
    expect(fix && applyFix(text, fix)).toBe("Because bees matter.");
  });

  it("flags 'their is' and lowercase 'i'", () => {
    const keys = checkGrammar("their is a problem and i know it.", "adult").map((i) => i.messageKey);
    expect(keys).toEqual(expect.arrayContaining(["theirThere", "lowercaseI"]));
  });

  it("flags long sentences for younger grades only past their limit", () => {
    const long = `${Array.from({ length: 24 }, (_, i) => `word${i}`).join(" ")}.`;
    expect(checkGrammar(long, "4-6").some((i) => i.messageKey === "longSentence")).toBe(true);
    expect(checkGrammar(long, "adult").some((i) => i.messageKey === "longSentence")).toBe(false);
  });
});

describe("checkOriginality", () => {
  it("flags sentences copied word-for-word from a source", () => {
    const copied = "Pesticide exposure reduces the foraging success of honey bees in field trials across three regions.";
    const result = checkOriginality(copied, [source], []);
    expect(result.flagged).toHaveLength(1);
    expect(result.score).toBe(0);
  });

  it("accepts quoted and cited text", () => {
    const quoted = '"Pesticide exposure reduces the foraging success of honey bees in field trials" [1].';
    expect(checkOriginality(quoted, [source], []).flagged).toHaveLength(0);
  });

  it("passes writing in the student's own words", () => {
    const own = "My grandmother noticed fewer bees in her garden last summer, which made me curious about why.";
    expect(checkOriginality(own, [source], []).score).toBe(100);
  });
});

describe("verifyCitations", () => {
  it("reports a citation that points at no saved source", () => {
    const problems = verifyCitations("Bees are very important to farms [7].", [source], []);
    expect(problems.map((p) => p.kind)).toContain("missingSource");
  });

  it("reports uncited factual-looking sentences and unused sources", () => {
    const problems = verifyCitations("Studies show that colonies fell by forty percent in recent years.", [source], []);
    const kinds = problems.map((p) => p.kind);
    expect(kinds).toContain("uncitedClaim");
    expect(kinds).toContain("unusedSource");
  });

  it("does not ask for citations on the writer's own reasoning", () => {
    const reasoning = [
      "This leads to an important research question about why bees are disappearing.",
      "These facts matter because they show that mites cause a double problem.",
      "Future research could look at how these causes affect each other over time.",
    ].join(" ");
    expect(verifyCitations(reasoning, [], []).filter((p) => p.kind === "uncitedClaim")).toHaveLength(0);
  });

  it("still asks for a citation when a finding is attributed to researchers", () => {
    const problems = verifyCitations("Researchers have found that there is not just one cause of bee loss.", [], []);
    expect(problems.map((p) => p.kind)).toContain("uncitedClaim");
  });

  it("warns when a cited sentence does not match its source", () => {
    const problems = verifyCitations("Penguins migrate across the ocean every winter [1].", [source], []);
    expect(problems.map((p) => p.kind)).toContain("weakSupport");
  });
});
