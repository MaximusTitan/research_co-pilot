import { describe, expect, it } from "vitest";
import { offlineInterview } from "../lib/agents/offline";
import { briefDirections } from "../lib/client/autopilot";
import { DEFAULT_BRIEF } from "../lib/project";

const base = { topic: "Why are bees disappearing?", writingType: "report", grade: "7-8", locale: "en" } as const;

describe("offline interview", () => {
  it("asks one question at a time, each with choices", () => {
    const first = offlineInterview({ ...base, answers: [] });
    expect(first.done).toBe(false);
    expect(first.options.length).toBeGreaterThanOrEqual(3);

    const second = offlineInterview({ ...base, answers: [{ question: first.question, answer: first.options[1].label }] });
    expect(second.done).toBe(false);
    expect(second.question).not.toBe(first.question);
  });

  it("finishes with the research question of the chosen angle", () => {
    const first = offlineInterview({ ...base, answers: [] });
    const answers = [{ question: first.question, answer: first.options[0].label }];
    for (let i = 0; i < 2; i++) {
      const next = offlineInterview({ ...base, answers });
      answers.push({ question: next.question, answer: next.options[0].label });
    }
    const done = offlineInterview({ ...base, answers });
    expect(done.done).toBe(true);
    expect(done.researchQuestion).toBe(first.options[0].hint);
  });

  it("stops at the question limit", () => {
    const first = offlineInterview({ ...base, answers: [] });
    const done = offlineInterview({ ...base, answers: [{ question: first.question, answer: "Pollination" }], maxQuestions: 1 });
    expect(done.done).toBe(true);
  });
});

describe("briefDirections", () => {
  it("passes the interview answers on to the writer", () => {
    const text = briefDirections({ ...DEFAULT_BRIEF, approach: "custom", interview: [{ question: "Who is it for?", answer: "Younger students" }] });
    expect(text).toContain("Q: Who is it for? A: Younger students");
    expect(text).not.toMatch(/neutral/);
  });
});
