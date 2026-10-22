import { describe, expect, it } from "vitest";
import { citedRefs, formatCitation, styleCitations } from "../lib/citations";
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

describe("citation styles", () => {
  const epa: Source = { ...base, id: "s2", ref: 2, title: "EPA actions to protect pollinators", authors: [], publisher: "U.S. Environmental Protection Agency (EPA)", year: null };
  const pmcA: Source = { ...epa, id: "s3", ref: 3, title: "Neonicotinoid pesticides severely affect honey bee queens", publisher: "PubMed Central (NIH)" };
  const pmcB: Source = { ...pmcA, id: "s4", ref: 4, title: "The neurophysiological bases of the impact" };
  const all = [base, epa, pmcA, pmcB];

  it("formats an IEEE reference with initials first", () => {
    expect(formatCitation(base, "ieee")).toBe("M. Lopez, “How pesticides affect bees,” National Geographic, 2023. [Online]. Available: https://www.nationalgeographic.com/pesticides");
  });

  it("keeps [n] for IEEE", () => {
    expect(styleCitations("Bees are declining [1, 2].", "ieee", all)).toBe("Bees are declining [1, 2].");
  });

  it("writes APA author-date citations, using the publisher when there is no author", () => {
    expect(styleCitations("Bees are declining [1, 2].", "apa", all)).toBe("Bees are declining (Lopez, 2023; U.S. Environmental Protection Agency, n.d.).");
  });

  it("writes MLA author citations, using a short title when publishers would clash", () => {
    expect(styleCitations("Queens suffer [3].", "mla", all)).toBe("Queens suffer (“Neonicotinoid pesticides severely affect…”).");
  });

  it("treats an \"et al.\" author entry as more authors", () => {
    const henry: Source = { ...base, id: "s5", ref: 5, authors: ["Mickaël Henry", "et al."], year: 2012 };
    expect(styleCitations("Bees got lost [5].", "mla", [henry])).toBe("Bees got lost (Henry et al.).");
    expect(styleCitations("Bees got lost [5].", "apa", [henry])).toBe("Bees got lost (Henry et al., 2012).");
  });
});
