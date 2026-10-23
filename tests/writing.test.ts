import { describe, expect, it } from "vitest";
import { offlineInterview } from "../lib/agents/offline";
import { agents } from "../lib/agents/schemas";
import { stagesFor } from "../lib/client/autopilot";
import { projectToRow, rowToProject } from "../lib/db/projects";
import { buildPaper, paperToText } from "../lib/paper";
import { showcaseProject } from "../lib/showcase";
import { GRADES, maxPicks, normalizeGrade } from "../lib/writing";

const labels = { abstract: "Abstract", keywords: "Keywords", intro: "Introduction", conclusion: "Conclusion", references: "References", worksCited: "Works Cited" };

describe("grade levels", () => {
  it("are school grades only", () => {
    expect(GRADES).toEqual(["4-6", "7-8", "9-10", "11-12"]);
    expect(agents.plan.input.safeParse({ topic: "Why are bees disappearing?", writingType: "essay", grade: "adult", locale: "en" }).success).toBe(false);
  });

  it("opens projects saved at the old university level as grades 11-12", () => {
    expect(normalizeGrade("adult")).toBe("11-12");
    expect(normalizeGrade("7-8")).toBe("7-8");
    const project = showcaseProject();
    const row = { ...projectToRow({ ...project, grade: "adult" as never }), updated_at: new Date().toISOString() };
    expect(rowToProject(row)?.grade).toBe("11-12");
  });
});

describe("kinds of writing", () => {
  const paper = { ...showcaseProject(), abstract: "This paper asks why bees are declining.", keywords: ["bees"] };

  it("gives only research papers an abstract", () => {
    expect(stagesFor("paper")).toContain("abstract");
    expect(stagesFor("essay")).not.toContain("abstract");
    expect(stagesFor("report")).not.toContain("abstract");
    expect(buildPaper(paper, labels, "apa").abstract).toBeTruthy();
    expect(buildPaper({ ...paper, writingType: "report" }, labels, "apa").abstract).toBeNull();
    expect(buildPaper({ ...paper, writingType: "essay" }, labels, "apa").keywords).toEqual([]);
  });

  it("lays each kind out differently", () => {
    expect(buildPaper(paper, labels, "apa").layout).toBe("journal");
    expect(buildPaper({ ...paper, writingType: "report" }, labels, "apa").layout).toBe("report");
    const essay = buildPaper({ ...paper, writingType: "essay" }, labels, "apa");
    expect(essay.layout).toBe("essay");
    // An essay flows without section headings.
    expect(paperToText(essay, labels)).not.toContain(`\n${labels.intro}\n`);
    expect(paperToText(buildPaper({ ...paper, writingType: "report" }, labels, "apa"), labels)).toContain(`${labels.intro}\n`);
  });

  it("asks offline purpose questions that fit the kind of writing", () => {
    const base = { topic: "Why are bees disappearing?", grade: "7-8", locale: "en" } as const;
    const answers = [
      { question: "Focus?", answer: "Pollination" },
      { question: "Who?", answer: "My class" },
    ];
    const essay = offlineInterview({ ...base, writingType: "essay", answers });
    const report = offlineInterview({ ...base, writingType: "report", answers });
    expect(essay.options.map((o) => o.label)).not.toContain("Explain what is known");
    expect(report.options.map((o) => o.label)).not.toContain("Argue for an answer");
    expect(essay.multi).toBe(false);
  });
});

describe("multi-select interview questions", () => {
  it("lets younger students pick fewer options", () => {
    expect(maxPicks("4-6")).toBe(2);
    expect(maxPicks("11-12")).toBe(3);
  });
});
