import { describe, expect, it } from "vitest";
import { corePhrase, offlineGaps, offlinePlan, offlineSynthesize, offlineVerify } from "../lib/agents/offline";
import { planInput, verifyInput } from "../lib/agents/schemas";

describe("input validation", () => {
  it("rejects a topic that is too short", () => {
    expect(planInput.safeParse({ topic: "bee", writingType: "essay", grade: "7-8", locale: "en" }).success).toBe(false);
  });

  it("rejects unknown locales and oversized claim lists", () => {
    expect(planInput.safeParse({ topic: "Why are bees disappearing?", writingType: "essay", grade: "7-8", locale: "fr" }).success).toBe(false);
    const claims = Array.from({ length: 41 }, (_, i) => ({ id: String(i), sentence: "x", evidence: "" }));
    expect(verifyInput.safeParse({ claims, locale: "en" }).success).toBe(false);
  });
});

describe("offline helper", () => {
  it("strips question words from the topic", () => {
    expect(corePhrase("Why are bees disappearing?")).toBe("bees disappearing");
  });

  it("builds up to four angles with three questions each", () => {
    const out = offlinePlan({ topic: "Why are bees disappearing?", writingType: "report", grade: "7-8", locale: "en" });
    expect(out.angles.length).toBeGreaterThan(0);
    expect(out.angles.length).toBeLessThanOrEqual(4);
    expect(out.angles.every((a) => a.questions.length === 3)).toBe(true);
    expect(out.plan.length).toBeGreaterThan(0);
  });

  it("drops angles the student asked to skip", () => {
    const all = offlinePlan({ topic: "Bees", writingType: "essay", grade: "11-12", locale: "en" });
    const skipped = offlinePlan({ topic: "Bees", writingType: "essay", grade: "11-12", locale: "en", exclude: [all.angles[0].title] });
    expect(skipped.angles.map((a) => a.title)).not.toContain(all.angles[0].title);
  });

  it("assigns notes to the section sharing the most words", () => {
    const out = offlineSynthesize({
      question: "Why are bees disappearing?",
      notes: [{ id: "n1", text: "Pesticide sprays harm bees", source: null }],
      sections: ["Pesticides harm bees", "Climate"],
      locale: "en",
    });
    expect(out.assignments).toEqual([{ noteId: "n1", section: "Pesticides harm bees" }]);
  });

  it("gives a supported verdict only when most key words overlap", () => {
    const out = offlineVerify({
      claims: [
        { id: "a", sentence: "Pesticide exposure reduces foraging success", evidence: "Pesticide exposure reduces foraging success in field trials" },
        { id: "b", sentence: "Penguins migrate every winter", evidence: "Pesticide exposure reduces foraging success" },
      ],
      locale: "en",
    });
    expect(out.results.find((r) => r.id === "a")?.verdict).toBe("supported");
    expect(out.results.find((r) => r.id === "b")?.verdict).toBe("unsupported");
  });

  it("suggests gaps only when the notes do not already cover them", () => {
    const out = offlineGaps({
      question: "Bees",
      sections: [{ title: "Experts disagree", notes: ["Experts disagree about pesticides"] }],
      grade: "11-12",
      locale: "en",
    });
    expect(out.gaps.length).toBeGreaterThan(0);
  });
});

describe("source suggestions", () => {
  it("accepts null authors from the model as an empty list", async () => {
    const { sourceDto } = await import("../lib/agents/schemas");
    const parsed = sourceDto.parse({
      title: "T", url: "https://epa.gov/x", publisher: "EPA", kind: "government", year: null,
      authors: null, summary: "s", keyQuote: null, trust: "trusted", trustReason: "government",
    });
    expect(parsed.authors).toEqual([]);
  });
});
