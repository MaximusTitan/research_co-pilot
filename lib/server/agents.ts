import "server-only";

import { agents, type AgentInput, type AgentName, type AgentOutput } from "../agents/schemas";
import * as offline from "../agents/offline";
import { aiEnabled, askClaude, askClaudeWithSearch, LANGUAGE, READING_LEVEL, tagSafe } from "./claude";
import { extractJson, keepGroundedSources } from "../agents/grounding";
import { keepKnownCitations } from "../citations";

type Run<A extends AgentName> = (input: AgentInput<A>) => Promise<AgentOutput<A> | null>;

const level = (grade: string) => READING_LEVEL[grade] ?? READING_LEVEL.adult;
const lang = (locale: string) => LANGUAGE[locale] ?? "English";

const SOURCE_RULES = `Role: Source Discovery Agent. Use the web_search tool to find real pages that help answer the research question.
Only suggest pages that your searches returned. Copy each URL exactly as the search gave it.
Prefer peer-reviewed papers, government and university sites, and established encyclopedias or news.
Base title, publisher, year and summary only on what the search results show. Leave keyQuote null.
Reply with only a JSON object: {"sources":[{"title","url","publisher","kind","year","authors","summary","keyQuote","trust","trustReason"}]}.
kind is one of paper, government, education, encyclopedia, news, blog, website. trust is one of trusted, check, careful. trustReason is one of peerReviewed, government, education, encyclopedia, news, blogNoAuthor, blogWithAuthor, unknownSite.`;

const runners: { [A in AgentName]: Run<A> } = {
  plan: async (input) => {
    const ai = await askClaude<typeof agents.plan.output>(
      `Role: Research Planner. Turn the student's idea into research angles, specific questions and a short step-by-step plan.
Write for ${level(input.grade)}. Answer in ${lang(input.locale)}.
Give 3 or 4 angles. Each has 2-3 questions that can be researched with published sources. Tags: "lots" (many sources exist), "easy" (simple to research), "harder" (contested or technical), "fewer" (thin evidence).
The student is writing a ${input.writingType}. Keep the plan to 4-6 short steps.`,
      `Student idea: <document>${tagSafe(input.topic)}</document>\nAvoid these angles: ${tagSafe((input.exclude ?? []).join("; ") || "none")}`,
      agents.plan.output,
    );
    return ai;
  },

  sources: async (input) => {
    const result = await askClaudeWithSearch(
      `${SOURCE_RULES}\nReturn up to 4 sources for search page ${input.page}. Write for ${level(input.grade)}. Answer in ${lang(input.locale)}.`,
      `Topic: <document>${tagSafe(input.topic)}</document>\nResearch question: <document>${tagSafe(input.question)}</document>`,
    );
    if (!result) return null;
    const parsed = agents.sources.output.safeParse(extractJson(result.text));
    if (!parsed.success) return null;
    // Only links that a search actually returned survive; anything else is dropped.
    return { sources: keepGroundedSources(parsed.data.sources, result.searched) };
  },

  analyze: async (input) => {
    const ai = await askClaude<typeof agents.analyze.output>(
      `Role: Document Analysis Agent. Read the document and pull out the findings that help answer the research question.
Use only what the document says. Write for ${level(input.grade)}. Answer in ${lang(input.locale)}.`,
      `Research question: <note>${tagSafe(input.question)}</note>\nDocument title: <note>${tagSafe(input.title)}</note>\n<document>${tagSafe(input.text)}</document>`,
      agents.analyze.output,
    );
    return ai;
  },

  synthesize: async (input) => {
    const ai = await askClaude<typeof agents.synthesize.output>(
      `Role: Evidence Synthesis Agent. Assign each note to the most fitting section title from the list given. Point out notes that directly contradict each other, quoting their ids. Do not write new facts. Answer in ${lang(input.locale)}.`,
      `Research question: <note>${tagSafe(input.question)}</note>\nSections: ${input.sections.map((s) => `<note>${tagSafe(s)}</note>`).join(" ")}\nNotes:\n${input.notes
        .map((n) => `<note id="${n.id}" source="${tagSafe(n.source ?? "")}">${tagSafe(n.text)}</note>`)
        .join("\n")}`,
      agents.synthesize.output,
    );
    return ai;
  },

  gaps: async (input) => {
    const ai = await askClaude<typeof agents.gaps.output>(
      `Role: Research Gap Agent. Suggest up to 3 questions that the student's current notes do not answer yet. Each has a short reason. Write for ${level(input.grade)}. Answer in ${lang(input.locale)}.`,
      `Research question: <note>${tagSafe(input.question)}</note>\n${input.sections
        .map((s) => `Section <note>${tagSafe(s.title)}</note>:\n${s.notes.map((n) => `- <note>${tagSafe(n)}</note>`).join("\n")}`)
        .join("\n")}`,
      agents.gaps.output,
    );
    return ai;
  },

  verify: async (input) => {
    const ai = await askClaude<typeof agents.verify.output>(
      `Role: Verification Agent. For each claim, decide whether the evidence supports it: "supported", "partial" or "unsupported". Judge only from the evidence text given. Answer in ${lang(input.locale)}.`,
      input.claims
        .map((c) => `<claim id="${c.id}"><note>${tagSafe(c.sentence)}</note><evidence>${tagSafe(c.evidence)}</evidence></claim>`)
        .join("\n"),
      agents.verify.output,
    );
    return ai;
  },

  improve: async (input) => {
    const ai = await askClaude<typeof agents.improve.output>(
      `Role: Writing coach. Suggest up to 3 small wording improvements in the student's own voice. Never rewrite the whole paragraph or add facts. Explain each in one short sentence for ${level(input.grade)}. Answer in ${lang(input.locale)}.`,
      `<document>${tagSafe(input.paragraph)}</document>`,
      agents.improve.output,
    );
    return ai;
  },

  outline: async (input) => {
    const ai = await askClaude<typeof agents.outline.output>(
      `Role: Outline Builder. Group the student's notes into 2-5 body sections for a ${input.writingType} that answers the research question.
For each section give a short title (at most 6 words), a one-sentence keyPoint stating its main idea, and the ids of the notes that belong in it.
Use only the note ids given, and use each note at most once. Leave out the introduction and conclusion; the app adds those.
Write for ${level(input.grade)}. Answer in ${lang(input.locale)}.`,
      `Research question: <note>${tagSafe(input.question)}</note>\nNotes:\n${input.notes
        .map((n) => `<note id="${n.id}" source="${tagSafe(n.source ?? "")}">${tagSafe(n.text)}</note>`)
        .join("\n")}`,
      agents.outline.output,
      "medium",
    );
    if (!ai) return null;
    const ids = new Set(input.notes.map((n) => n.id));
    return { sections: ai.sections.map((s) => ({ ...s, noteIds: s.noteIds.filter((id) => ids.has(id)) })) };
  },

  draft: async (input) => {
    const shape = {
      intro: "Open with a hook, state the research question, and say what the paper covers. Keep it to one paragraph.",
      body: "Start with the section's main idea, give 2-3 facts from the material each followed by its citation, then explain why they matter.",
      conclusion: "Answer the research question, sum up the main sections, and suggest one thing future research could look at.",
    }[input.section.kind];
    const ai = await askClaude<typeof agents.draft.output>(
      `Role: Writing Partner. Draft one section of the student's ${input.writingType} so they have a strong starting point to read, check and make their own.
${shape}
Use only facts that appear in the notes and source summaries given. After each fact, cite its source as [n], using only the numbers listed. Never add facts, numbers, names or quotations that are not in the material.
If the student already wrote something for this section, keep their ideas and wording where possible and build on it.
Write about ${input.grade === "4-6" ? "60-110" : "100-200"} words of plain paragraphs: no headings, lists or markdown.
Write for ${level(input.grade)}. Answer in ${lang(input.locale)}.`,
      `Research question: <note>${tagSafe(input.question)}</note>
Paper outline: ${input.outline.map((t) => `<note>${tagSafe(t)}</note>`).join(" ")}
Section to draft: <note>${tagSafe(input.section.title)}</note>${input.section.keyPoint ? `\nMain idea: <note>${tagSafe(input.section.keyPoint)}</note>` : ""}
Notes for this section:\n${input.notes.map((n) => `<note${n.ref ? ` cite="[${n.ref}]"` : ""}>${tagSafe(n.text)}</note>`).join("\n") || "none"}
Saved sources:\n${input.sources.map((s) => `[${s.ref}] <note>${tagSafe(s.title)}: ${tagSafe(s.summary)}</note>`).join("\n") || "none"}
Student's current text: <document>${tagSafe(input.existing ?? "")}</document>`,
      agents.draft.output,
      "medium",
    );
    if (!ai) return null;
    return { text: keepKnownCitations(ai.text, new Set(input.sources.map((s) => s.ref))) };
  },

  fixClaim: async (input) => {
    const problem = {
      uncitedClaim: "It states a fact but has no citation.",
      weakSupport: "The cited source does not clearly say this.",
      carefulSource: "It relies on a source rated 'be careful'.",
      missingSource: "It cites a number that matches no saved source.",
    }[input.problem];
    const ai = await askClaude<typeof agents.fixClaim.output>(
      `Role: Verification Agent. Help the student fix one sentence. Problem: ${problem}
Rewrite it so every fact is backed by one of the saved sources and cited as [n] with a number from the list. If no source supports it, soften it to what the sources do support; never invent support.
Keep the student's voice and keep it to one or two sentences. Explain the change in one short sentence for ${level(input.grade)}. Answer in ${lang(input.locale)}.`,
      `Sentence: <document>${tagSafe(input.sentence)}</document>
Saved sources:\n${input.sources.map((s) => `[${s.ref}] <note>${tagSafe(s.title)}: ${tagSafe(s.summary)}</note>`).join("\n") || "none"}
Student notes:\n${input.notes.map((n) => `<note>${tagSafe(n)}</note>`).join("\n") || "none"}`,
      agents.fixClaim.output,
    );
    if (!ai) return null;
    return { ...ai, replacement: keepKnownCitations(ai.replacement, new Set(input.sources.map((s) => s.ref))) };
  },

  feedback: async (input) => {
    const ai = await askClaude<typeof agents.feedback.output>(
      `Role: Reviewer. Give the student kind, specific feedback on their ${input.writingType} draft, like a good teacher would.
overall: 2-3 sentences on how well it answers the research question. strengths: up to 3. improvements: up to 5, each tied to one section title and saying exactly what to do next.
Do not rewrite the paper. Write for ${level(input.grade)}. Answer in ${lang(input.locale)}.`,
      `Research question: <note>${tagSafe(input.question)}</note>\n${input.sections
        .map((s) => `Section <note>${tagSafe(s.title)}</note>:\n<document>${tagSafe(s.text) || "(empty)"}</document>`)
        .join("\n")}`,
      agents.feedback.output,
      "medium",
    );
    return ai;
  },

  abstract: async (input) => {
    const ai = await askClaude<typeof agents.abstract.output>(
      `Role: Editor. Write the abstract for the student's finished ${input.writingType}, as it would appear at the top of a published research paper.
In one paragraph of ${input.grade === "4-6" ? "60-90" : "120-180"} words, say what question the paper asks, how it was researched (from published sources), the main findings and the conclusion.
Use only what the paper says: no new facts, numbers or claims, and no citations, headings or markdown. Also give 4-6 short keywords.
Write for ${level(input.grade)}. Answer in ${lang(input.locale)}.`,
      `Research question: <note>${tagSafe(input.question)}</note>\n${input.sections
        .map((s) => `Section <note>${tagSafe(s.title)}</note>:\n<document>${tagSafe(s.text)}</document>`)
        .join("\n")}`,
      agents.abstract.output,
    );
    if (!ai) return null;
    return { abstract: stripCitations(ai.abstract), keywords: ai.keywords.map((k) => k.trim()).filter(Boolean).slice(0, 6) };
  },
};

const stripCitations = (text: string) => text.replace(/\s*\[[\d,\s]+\]/g, "").trim();

const offlineRunners: { [A in AgentName]: (input: AgentInput<A>) => AgentOutput<A> } = {
  plan: offline.offlinePlan,
  sources: () => ({ sources: [] }),
  analyze: offline.offlineAnalyze,
  synthesize: offline.offlineSynthesize,
  gaps: offline.offlineGaps,
  verify: offline.offlineVerify,
  improve: offline.offlineImprove,
  outline: offline.offlineOutline,
  draft: offline.offlineDraft,
  fixClaim: offline.offlineFixClaim,
  feedback: offline.offlineFeedback,
  abstract: offline.offlineAbstract,
};

export type AgentResult<A extends AgentName> = { mode: "ai" | "offline"; data: AgentOutput<A> } | { error: string };

/**
 * Runs one agent. Input is validated first; if Claude is unavailable or
 * refuses, the offline helper answers instead, so the student is never stuck.
 * `sources` has no offline version: it returns an empty list and the UI says so.
 */
export async function runAgent<A extends AgentName>(name: A, raw: unknown): Promise<AgentResult<A>> {
  const parsed = agents[name].input.safeParse(raw);
  if (!parsed.success) return { error: "invalid_input" };
  const input = parsed.data as AgentInput<A>;

  if (aiEnabled()) {
    try {
      const data = await (runners[name] as Run<A>)(input);
      if (data) return { mode: "ai", data };
    } catch (err) {
      console.error(`[agent:${name}]`, err instanceof Error ? err.name : "unknown");
    }
  }
  return { mode: "offline", data: offlineRunners[name](input) };
}
