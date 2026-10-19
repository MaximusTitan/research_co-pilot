import { describe, expect, it } from "vitest";
import { offlineDraft, offlineFixClaim, offlinePlan } from "../lib/agents/offline";
import { planInput } from "../lib/agents/schemas";
import { verifyCitations } from "../lib/checks";
import { dictionaries } from "../lib/i18n";
import { keywordOverlap, sentences, words } from "../lib/text";

describe("Hindi text handling", () => {
  it("keeps vowel signs inside words", () => {
    expect(words("मधुमक्खियाँ कम हो रही हैं")).toEqual(["मधुमक्खियाँ", "कम", "हो", "रही", "हैं"]);
  });

  it("splits sentences on the danda", () => {
    expect(sentences("मधुमक्खियाँ ज़रूरी हैं। कीटनाशक उन्हें नुकसान पहुँचाते हैं।").map((s) => s.text)).toEqual([
      "मधुमक्खियाँ ज़रूरी हैं।",
      "कीटनाशक उन्हें नुकसान पहुँचाते हैं।",
    ]);
  });

  it("matches Hindi key words between a claim and its evidence", () => {
    expect(keywordOverlap("कीटनाशक मधुमक्खियों को नुकसान पहुँचाते", "कीटनाशक मधुमक्खियों को नुकसान पहुँचाते हैं")).toBe(1);
  });

  it("asks for a citation when a Hindi sentence cites research", () => {
    const problems = verifyCitations("शोध से पता चलता है कि मधुमक्खियाँ तेज़ी से कम हो रही हैं।", [], []);
    expect(problems.map((p) => p.kind)).toContain("uncitedClaim");
  });
});

describe("Hindi locale", () => {
  it("accepts Hindi and no longer accepts Spanish", () => {
    const base = { topic: "मधुमक्खियाँ कम क्यों हो रही हैं?", writingType: "report", grade: "7-8" };
    expect(planInput.safeParse({ ...base, locale: "hi" }).success).toBe(true);
    expect(planInput.safeParse({ ...base, locale: "es" }).success).toBe(false);
  });

  it("offers only English and Hindi dictionaries", () => {
    expect(Object.keys(dictionaries).sort()).toEqual(["en", "hi"]);
  });

  it("gives Hindi research angles offline", () => {
    const out = offlinePlan({ topic: "मधुमक्खियाँ कम क्यों हो रही हैं?", writingType: "report", grade: "7-8", locale: "hi" });
    expect(out.angles[0].title).toContain("मधुमक्खियाँ");
    expect(out.coachMessage).toMatch(/[ऀ-ॿ]/);
  });

  it("ends Hindi draft sentences with a danda and keeps citations", () => {
    const out = offlineDraft({
      question: "मधुमक्खियाँ कम क्यों हो रही हैं?",
      writingType: "report",
      grade: "7-8",
      locale: "hi",
      section: { kind: "body", title: "कीटनाशक", keyPoint: null },
      outline: ["परिचय", "कीटनाशक", "निष्कर्ष"],
      notes: [{ text: "कीटनाशक के संपर्क में आई मधुमक्खियाँ रास्ता भूल जाती हैं।", ref: 1 }],
      sources: [],
      existing: "",
    });
    expect(out.text).toBe("कीटनाशक के संपर्क में आई मधुमक्खियाँ रास्ता भूल जाती हैं [1]।");
  });

  it("explains in Hindi when no source supports a sentence", () => {
    const out = offlineFixClaim({ sentence: "पेंगुइन सर्दियों में प्रवास करते हैं।", problem: "uncitedClaim", sources: [], notes: [], grade: "7-8", locale: "hi" });
    expect(out.explanation).toMatch(/[ऀ-ॿ]/);
  });
});
