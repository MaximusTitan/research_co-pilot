import { describe, expect, it } from "vitest";
import { extractJson, keepGroundedSources, normalizeUrl, searchedUrlsFrom } from "../lib/agents/grounding";

describe("normalizeUrl", () => {
  it("ignores case, www, fragments and trailing slashes", () => {
    expect(normalizeUrl("https://WWW.Example.com/Path/#intro")).toBe("https://example.com/Path");
    expect(normalizeUrl("https://example.com/a/")).toBe(normalizeUrl("https://example.com/a"));
  });

  it("rejects non-web schemes and junk", () => {
    expect(normalizeUrl("javascript:alert(1)")).toBeNull();
    expect(normalizeUrl("not a url")).toBeNull();
    expect(normalizeUrl(null)).toBeNull();
  });
});

describe("searchedUrlsFrom", () => {
  it("collects URLs from web search result blocks only", () => {
    const content = [
      { type: "text" },
      {
        type: "web_search_tool_result",
        content: [
          { type: "web_search_result", url: "https://www.usda.gov/bees", title: "USDA" },
          { type: "web_search_result", url: "https://en.wikipedia.org/wiki/Bee", title: "Bee" },
        ],
      },
      { type: "web_search_tool_result", content: { type: "web_search_tool_result_error", error_code: "unavailable" } },
    ];
    expect([...searchedUrlsFrom(content)].sort()).toEqual(["https://en.wikipedia.org/wiki/Bee", "https://usda.gov/bees"]);
  });
});

describe("keepGroundedSources", () => {
  it("drops suggestions whose URL was never returned by a search", () => {
    const searched = new Set(["https://usda.gov/bees"]);
    const kept = keepGroundedSources(
      [
        { title: "Real", url: "https://www.usda.gov/bees/" },
        { title: "Invented", url: "https://made-up-journal.example/paper" },
        { title: "No link", url: null },
      ],
      searched,
    );
    expect(kept.map((s) => s.title)).toEqual(["Real"]);
  });
});

describe("extractJson", () => {
  it("reads JSON wrapped in prose or a code fence", () => {
    expect(extractJson('Here you go:\n```json\n{"sources": []}\n```')).toEqual({ sources: [] });
  });

  it("returns null when there is no valid JSON", () => {
    expect(extractJson("no json here")).toBeNull();
    expect(extractJson("{ broken")).toBeNull();
  });
});
