import { describe, expect, it } from "vitest";
import { citedRefs, formatCitation } from "../lib/citations";
import type { Source } from "../lib/types";

const base: Source = {
  id: "s1",
  ref: 1,
  title: "How pesticides affect bees",
  url: "https://www.nationalgeographic.com/pesticides",
  publisher: "National Geographic",
  kind: "news",
  year: 2023,
  authors: ["Maria Lopez"],
  summary: "",
  keyQuote: null,
  trust: "trusted",
  trustReason: "news",
  saved: true,
  marked: false,
};

describe("formatCitation", () => {
  it("formats an APA reference with initials", () => {
    expect(formatCitation(base, "apa")).toBe(
      "Lopez, M. (2023). How pesticides affect bees. National Geographic. https://www.nationalgeographic.com/pesticides",
    );
  });

  it("formats an MLA reference with inverted first author", () => {
    expect(formatCitation(base, "mla")).toBe(
      'Lopez, Maria. "How pesticides affect bees." National Geographic, 2023, https://www.nationalgeographic.com/pesticides.',
    );
  });

  it("uses n.d. and publisher when there is no date or author", () => {
    const s = { ...base, year: null, authors: [] };
    expect(formatCitation(s, "apa")).toContain("(n.d.).");
    expect(formatCitation(s, "apa")).toContain("National Geographic");
  });
});

describe("citedRefs", () => {
  it("finds single and grouped citation numbers", () => {
    expect(citedRefs("Bees struggle [2]. Pesticides too [1, 3]. Again [2].")).toEqual([1, 2, 3]);
  });
});
