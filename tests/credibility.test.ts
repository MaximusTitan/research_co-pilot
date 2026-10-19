import { describe, expect, it } from "vitest";
import { rateSource, safeHttpUrl } from "../lib/credibility";

describe("rateSource", () => {
  it("trusts government and university sites", () => {
    expect(rateSource({ url: "https://www.usda.gov/report" })).toMatchObject({ trust: "trusted", reasonKey: "government" });
    expect(rateSource({ url: "https://ox.ac.uk/paper" }).trust).toBe("trusted");
  });

  it("marks peer-reviewed papers as trusted", () => {
    expect(rateSource({ url: null, peerReviewed: true })).toMatchObject({ trust: "trusted", kind: "paper" });
  });

  it("is careful with blogs that list no author", () => {
    expect(rateSource({ url: "https://gardenfanblog.com/bees", authors: [] })).toMatchObject({ trust: "careful", reasonKey: "blogNoAuthor" });
  });

  it("asks the student to check unknown sites that have an author", () => {
    expect(rateSource({ url: "https://example-site.org/x", authors: ["Ana Ruiz"] }).trust).toBe("check");
  });

  it("is careful when there is no usable URL", () => {
    expect(rateSource({ url: "not a url" }).trust).toBe("careful");
  });
});

describe("safeHttpUrl", () => {
  it("keeps http and https only", () => {
    expect(safeHttpUrl("https://example.com/a")).toBe("https://example.com/a");
    expect(safeHttpUrl("javascript:alert(1)")).toBeNull();
    expect(safeHttpUrl(null)).toBeNull();
  });
});
