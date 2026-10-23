"use client";

import { callAgent } from "./agent";
import { fixAllGrammar } from "../checks";
import { addNote, addSourceNote, addSources, applyOutline, fillIfEmpty, needsSearch, notesFor, saveNoteSources, savedSources, setQuestion } from "../project";
import { projectStore } from "../store";
import { toSource } from "../sources";
import type { Approach, Brief, Locale, Project, Section, Source, SourceMix, WritingType } from "../types";
import { WRITING } from "../writing";

export const AUTOPILOT_STAGES = ["plan", "sources", "notes", "outline", "draft", "polish", "abstract"] as const;
export type AutopilotStage = (typeof AUTOPILOT_STAGES)[number];

/** The steps the autopilot runs for this kind of writing; only research papers get an abstract. */
export const stagesFor = (type: WritingType): AutopilotStage[] => AUTOPILOT_STAGES.filter((s) => s !== "abstract" || WRITING[type].abstract);

export interface SectionLabels {
  intro: string;
  conclusion: string;
}

export interface AutopilotProgress {
  stage: AutopilotStage;
  /** Section drafting progress, while on the "draft" stage. */
  done?: number;
  total?: number;
}

export interface AutopilotResult {
  /** Some step fell back to the offline helper, or found no sources. */
  limited: boolean;
}

const DRAFT_CONCURRENCY = 3;

// Prompt text for the Start answers. These go to the AI, so they stay in English whatever the app language.
const APPROACH_PROMPT: Record<Exclude<Approach, "custom">, string> = {
  facts: "Explain the facts clearly and neutrally.",
  bothSides: "Compare the different sides fairly and weigh the evidence for each.",
  argue: "Take a clear position that answers the question, and back it with the evidence.",
};
const SOURCES_PROMPT: Record<Exclude<SourceMix, "custom">, string> = {
  studies: "mostly peer-reviewed scientific studies",
  official: "mostly government and university websites",
  mix: "a balanced mix of scientific studies, official sites and reputable news",
};

/** The student's directions as one note for the writing agents. */
export function briefDirections(brief: Brief | undefined): string {
  if (!brief) return "";
  const approach = brief.approach === "custom" ? brief.approachText.trim() : APPROACH_PROMPT[brief.approach];
  const extra = brief.extra.trim() ? `Make sure the paper covers: ${brief.extra.trim()}` : "";
  const interview = (brief.interview ?? []).map((a) => `Q: ${a.question} A: ${a.answer}`).join("\n");
  return [interview && `What the student chose:\n${interview}`, approach, extra].filter(Boolean).join("\n").slice(0, 1500);
}

function sourcePreference(brief: Brief | undefined): string {
  if (!brief) return "";
  return (brief.sources === "custom" ? brief.sourcesText.trim() : SOURCES_PROMPT[brief.sources]).slice(0, 400);
}
const TRUST_ORDER: Record<Source["trust"], number> = { trusted: 0, check: 1, careful: 2 };

export function sectionName(s: Section, labels: SectionLabels): string {
  if (s.kind === "intro") return labels.intro;
  if (s.kind === "conclusion") return labels.conclusion;
  return s.title;
}

/** Everything the Writing Partner needs for one section: its notes, saved sources and the outline. */
export function draftRequest(project: Project, target: Section, locale: Locale, labels: SectionLabels) {
  const sources = savedSources(project);
  const refOf = (sourceId: string | null) => sources.find((s) => s.id === sourceId)?.ref ?? null;
  return {
    question: (project.question ?? project.topic).slice(0, 500),
    writingType: project.writingType,
    grade: project.grade,
    locale,
    length: project.brief?.length ?? "standard",
    directions: briefDirections(project.brief),
    section: { kind: target.kind, title: sectionName(target, labels).slice(0, 120), keyPoint: target.keyPoint?.slice(0, 500) ?? null },
    outline: project.sections.slice(0, 20).map((s) => sectionName(s, labels).slice(0, 120)),
    notes: notesFor(project, target.id)
      .slice(0, 40)
      .map((n) => ({ text: n.text.slice(0, 1000), ref: refOf(n.sourceId) })),
    sources: sources.slice(0, 30).flatMap((s) => (s.ref === null ? [] : [{ ref: s.ref, title: s.title.slice(0, 300), summary: s.summary.slice(0, 1500) }])),
    existing: target.draft.slice(0, 8000),
  };
}

/** What the Editor needs to write the abstract: every written section, in order. */
export function abstractRequest(project: Project, locale: Locale, labels: SectionLabels) {
  return {
    question: (project.question ?? project.topic).slice(0, 500),
    writingType: project.writingType,
    grade: project.grade,
    locale,
    sections: project.sections
      .filter((s) => s.draft.trim())
      .slice(0, 20)
      .map((s) => ({ title: sectionName(s, labels).slice(0, 120), text: s.draft.slice(0, 8000) })),
  };
}

/**
 * Turns the answers from the Start screen into a finished first draft: picks a
 * research question, finds and saves sources, takes notes, builds the outline
 * and writes every section. Each step skips itself when its work is already
 * there, so running it again (after a reload, say) carries on where it stopped.
 */
export async function runAutopilot(
  projectId: string,
  locale: Locale,
  labels: SectionLabels,
  onProgress: (progress: AutopilotProgress) => void,
): Promise<AutopilotResult> {
  const current = (): Project | null => projectStore.snapshot()?.projects[projectId] ?? null;
  // Only ever touch this project, even if another one gets opened meanwhile.
  const update = (fn: (p: Project) => Project) => projectStore.update((p) => (p.id === projectId ? fn(p) : p));
  let limited = false;

  // 1. Pick the angle and research question.
  onProgress({ stage: "plan" });
  let p = current();
  if (!p) throw new Error("no_project");
  if (p.angles.length === 0) {
    const result = await callAgent("plan", { topic: p.topic, writingType: p.writingType, grade: p.grade, locale, exclude: [] });
    if (!result.ok) throw new Error("plan_failed");
    if (result.mode === "offline") limited = true;
    update((x) => ({
      ...x,
      coachMessage: result.data.coachMessage,
      angles: result.data.angles.map((a, i) => ({ id: `${x.id}-a${i}`, ...a })),
      plan: result.data.plan,
    }));
  }
  p = current();
  if (p && !p.question) {
    const angle = p.angles.find((a) => a.questions.length > 0);
    update((x) => setQuestion(x, angle?.questions[0] ?? x.topic, angle?.id ?? null));
  }

  // 2. Find sources.
  onProgress({ stage: "sources" });
  p = current();
  const length = p?.brief?.length ?? "standard";
  if (p && needsSearch(p)) {
    const question = p.question ?? p.topic;
    const preference = sourcePreference(p.brief);
    for (let page = 1; page <= WRITING[p.writingType].sourcePages[length]; page++) {
      const result = await callAgent("sources", { question, topic: p.topic, grade: p.grade, locale, page, preference });
      if (!result.ok) {
        if (page === 1) throw new Error("sources_failed");
        break;
      }
      if (result.mode === "offline") limited = true;
      const found = result.data.sources.map(toSource);
      update((x) => ({ ...addSources(x, found), searchedFor: question }));
      if (found.length === 0) break;
    }
  }

  // 3. Keep the most trustworthy sources and take notes from them.
  onProgress({ stage: "notes" });
  p = current();
  if (p && p.notes.length === 0) {
    // "Be careful" sources are left for the student to judge; the paper is built on the others.
    const picks = p.sources
      .filter((s) => s.trust !== "careful")
      .sort((a, b) => TRUST_ORDER[a.trust] - TRUST_ORDER[b.trust])
      .slice(0, WRITING[p.writingType].maxSaved[length]);
    if (picks.length === 0) limited = true;
    update((x) =>
      picks.reduce((next, s) => {
        const withQuote = addSourceNote(next, s);
        // The quote and the summary give the outline two pieces of evidence to work with.
        return s.keyQuote && s.summary ? addNote(withQuote, s.summary, s.id) : withQuote;
      }, x),
    );
  }

  // 4. Build the outline.
  onProgress({ stage: "outline" });
  p = current();
  if (p && p.notes.length > 0 && !p.sections.some((s) => s.kind === "body")) {
    const snapshot = p;
    const result = await callAgent("outline", {
      question: snapshot.question ?? snapshot.topic,
      writingType: snapshot.writingType,
      grade: snapshot.grade,
      locale,
      length,
      directions: briefDirections(snapshot.brief),
      notes: snapshot.notes.slice(0, 80).map((n) => ({
        id: n.id,
        text: n.text.slice(0, 1000),
        source: snapshot.sources.find((s) => s.id === n.sourceId)?.title.slice(0, 300) ?? null,
      })),
    });
    if (!result.ok) throw new Error("outline_failed");
    if (result.mode === "offline") limited = true;
    update((x) => applyOutline(x, result.data.sections));
  }

  // 5. Write every section that's still empty.
  update(saveNoteSources);
  p = current();
  if (p) {
    const ready = p;
    const targets = ready.sections.filter((s) => !s.draft.trim() && (s.kind !== "body" || notesFor(ready, s.id).length > 0));
    // Sections are drafted from the same outline and notes, so a few can be written at once.
    let next = 0;
    let done = 0;
    onProgress({ stage: "draft", done, total: targets.length });
    const worker = async () => {
      while (next < targets.length) {
        const target = targets[next++];
        const result = await callAgent("draft", draftRequest(ready, target, locale, labels));
        onProgress({ stage: "draft", done: ++done, total: targets.length });
        if (!result.ok) continue;
        if (result.mode === "offline") limited = true;
        update((x) => fillIfEmpty(x, target.id, result.data.text));
      }
    };
    await Promise.all(Array.from({ length: Math.min(DRAFT_CONCURRENCY, targets.length) }, worker));
  }

  // 6. Tidy spelling and grammar.
  onProgress({ stage: "polish" });
  update((x) => ({ ...x, sections: x.sections.map((s) => ({ ...s, draft: fixAllGrammar(s.draft, x.grade) })) }));

  // 7. Research papers get an abstract and keywords from the finished sections.
  p = current();
  if (p && WRITING[p.writingType].abstract) onProgress({ stage: "abstract" });
  if (p && WRITING[p.writingType].abstract && !p.abstract && p.sections.some((s) => s.draft.trim())) {
    const result = await callAgent("abstract", abstractRequest(p, locale, labels));
    if (result.ok) {
      if (result.mode === "offline") limited = true;
      update((x) => ({ ...x, abstract: result.data.abstract, keywords: result.data.keywords }));
    }
  }

  return { limited };
}
