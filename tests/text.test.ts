import { describe, expect, it } from "vitest";
import { fixAllGrammar } from "../lib/checks";
import { sentences } from "../lib/text";

const split = (text: string) => sentences(text).map((s) => s.text);

describe("sentences", () => {
  it("keeps decimals inside a sentence", () => {
    expect(split("About 90.6% of teens did [1]. Most slept less.")).toEqual(["About 90.6% of teens did [1].", "Most slept less."]);
  });

  it("doesn't split on abbreviations that can't end a sentence", () => {
    expect(split("Dr. Lee found many causes, e.g. mites. Then she left.")).toEqual(["Dr. Lee found many causes, e.g. mites.", "Then she left."]);
  });

  it("ends a sentence after a.m. only when a capital follows", () => {
    expect(split("Phones were used at 2 a.m. on school nights. Sleep fell.")).toEqual(["Phones were used at 2 a.m. on school nights.", "Sleep fell."]);
    expect(split("Use peaked between midnight and 5 a.m. On weekends it was later.")).toEqual([
      "Use peaked between midnight and 5 a.m.",
      "On weekends it was later.",
    ]);
  });

  it("keeps offsets pointing at the original text", () => {
    const text = "One.  Two is 2.5 long!\nThree";
    for (const s of sentences(text)) expect(text.slice(s.start, s.end)).toBe(s.text);
    expect(split(text)).toEqual(["One.", "Two is 2.5 long!", "Three"]);
  });

  it("doesn't let the grammar fixer capitalise after an abbreviation", () => {
    expect(fixAllGrammar("Teens were online at 2 a.m. on school nights.", "adult")).toBe("Teens were online at 2 a.m. on school nights.");
  });
});
