"use client";

import { useRef, useState } from "react";
import { Button, Card, LinkButton, Notice, PageTitle, Spinner } from "../../components/ui";
import { RequireProject } from "../../components/shell";
import { callAgent } from "../../lib/client/agent";
import { useLocale, useT } from "../../lib/i18n";
import { fillIfEmpty, notesFor, saveNoteSources, savedSources, setDraft } from "../../lib/project";
import { projectStore, useSaveStatus } from "../../lib/store";
import type { Project, Section, Source } from "../../lib/types";

type Suggestion = { id: string; original: string; replacement: string; why: string };
type Preview = { sectionId: string; text: string; offline: boolean };
type BulkDraft = { sectionId: string; text: string };

export default function WritePage() {
  return <RequireProject>{(project) => <Write project={project} />}</RequireProject>;
}

function Write({ project }: { project: Project }) {
  const t = useT();
  const locale = useLocale();
  const [activeId, setActiveId] = useState<string>(project.sections[0]?.id ?? "");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [improving, setImproving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const editor = useRef<HTMLTextAreaElement>(null);
  const [drafting, setDrafting] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [bulk, setBulk] = useState<{ done: number; total: number } | null>(null);
  const [bulkOffline, setBulkOffline] = useState(false);
  const [bulkDrafts, setBulkDrafts] = useState<BulkDraft[]>([]);
  const saveStatus = useSaveStatus();

  const section = project.sections.find((s) => s.id === activeId) ?? project.sections[0];
  const sources = savedSources(project);
  const saveLabel = saveStatus === "error" ? `⚠ ${t.common.notSaved}` : saveStatus === "saving" ? t.common.saving : `${t.common.saved} ✓`;
  const words = section ? section.draft.trim().split(/\s+/).filter(Boolean).length : 0;

  function insertAtCursor(text: string) {
    if (!section) return;
    const el = editor.current;
    const pos = el?.selectionStart ?? section.draft.length;
    const before = section.draft.slice(0, pos);
    const after = section.draft.slice(pos);
    const spacer = before && !/\s$/.test(before) ? " " : "";
    const next = `${before}${spacer}${text}${after}`;
    projectStore.update((p) => setDraft(p, section.id, next));
    window.requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(next.length - after.length, next.length - after.length);
    });
  }

  /** Saves any source a note came from, so the draft can cite it, and returns the project to draft from. */
  function withNoteSources(): Project {
    const ready = saveNoteSources(project);
    if (ready !== project) projectStore.update(saveNoteSources);
    return ready;
  }

  /** Everything the Writing Partner needs for one section: its notes, saved sources and the outline. */
  function draftRequest(project: Project, target: Section) {
    const sources = savedSources(project);
    const refOf = (sourceId: string | null) => sources.find((s) => s.id === sourceId)?.ref ?? null;
    return {
      question: (project.question ?? project.topic).slice(0, 500),
      writingType: project.writingType,
      grade: project.grade,
      locale,
      section: { kind: target.kind, title: sectionName(target, t).slice(0, 120), keyPoint: target.keyPoint?.slice(0, 500) ?? null },
      outline: project.sections.slice(0, 20).map((s) => sectionName(s, t).slice(0, 120)),
      notes: notesFor(project, target.id)
        .slice(0, 40)
        .map((n) => ({ text: n.text.slice(0, 1000), ref: refOf(n.sourceId) })),
      sources: sources.slice(0, 30).flatMap((s) => (s.ref === null ? [] : [{ ref: s.ref, title: s.title.slice(0, 300), summary: s.summary.slice(0, 1500) }])),
      existing: target.draft.slice(0, 8000),
    };
  }

  const canDraft = (target: Section) => target.kind !== "body" || notesFor(project, target.id).length > 0;

  async function draftSection() {
    if (!section) return;
    setError(null);
    setMessage(null);
    setPreview(null);
    if (!canDraft(section)) {
      setMessage(t.write.needNotesDraft);
      return;
    }
    setDrafting(true);
    const result = await callAgent("draft", draftRequest(withNoteSources(), section));
    setDrafting(false);
    if (!result.ok) {
      setError(t.common.agentError);
      return;
    }
    if (!result.data.text.trim()) {
      setMessage(t.write.needNotesDraft);
      return;
    }
    setPreview({ sectionId: section.id, text: result.data.text.trim(), offline: result.mode === "offline" });
  }

  function applyPreview(mode: "replace" | "append") {
    if (!preview) return;
    const target = project.sections.find((s) => s.id === preview.sectionId);
    if (!target) return;
    const next = mode === "append" && target.draft.trim() ? `${target.draft.trimEnd()}

${preview.text}` : preview.text;
    projectStore.update((p) => setDraft(p, target.id, next));
    setPreview(null);
  }

  /** Drafts every empty section into a preview; nothing goes into the paper until the student picks it. */
  async function draftAllEmpty() {
    setError(null);
    setMessage(null);
    setPreview(null);
    setBulkOffline(false);
    setBulkDrafts([]);
    const targets = project.sections.filter((s) => !s.draft.trim() && canDraft(s));
    if (targets.length === 0) {
      setMessage(t.write.nothingToDraft);
      return;
    }
    const ready = withNoteSources();
    let drafted = 0;
    for (const [i, target] of targets.entries()) {
      setBulk({ done: i + 1, total: targets.length });
      const result = await callAgent("draft", draftRequest(ready, target));
      const text = result.ok ? result.data.text.trim() : "";
      if (!result.ok || !text) continue;
      if (result.mode === "offline") setBulkOffline(true);
      setBulkDrafts((list) => [...list, { sectionId: target.id, text }]);
      drafted++;
    }
    setBulk(null);
    if (drafted === 0) setMessage(t.write.draftAllNone);
  }

  /** Puts one bulk draft in place. If the student has written there since, it goes after their text. */
  function applyBulkDraft(item: BulkDraft) {
    projectStore.update((p) => {
      const target = p.sections.find((s) => s.id === item.sectionId);
      if (!target) return p;
      return target.draft.trim() ? setDraft(p, target.id, `${target.draft.trimEnd()}\n\n${item.text}`) : fillIfEmpty(p, target.id, item.text);
    });
    setBulkDrafts((list) => list.filter((x) => x.sectionId !== item.sectionId));
  }

  function applyAllBulkDrafts() {
    bulkDrafts.forEach(applyBulkDraft);
    setMessage(t.write.draftAllDone(bulkDrafts.length));
  }

  async function improve() {
    if (!section) return;
    setImproving(true);
    setError(null);
    setMessage(null);
    const result = await callAgent("improve", { paragraph: section.draft, grade: project.grade, locale });
    setImproving(false);
    if (!result.ok) {
      setError(t.common.agentError);
      return;
    }
    const found = result.data.suggestions.map((s, i) => ({ id: `${Date.now()}-${i}`, ...s }));
    if (found.length === 0) setMessage(t.write.noImprovements);
    setSuggestions(found);
  }

  function applySuggestion(s: Suggestion) {
    if (!section || !section.draft.includes(s.original)) {
      setSuggestions((list) => list.filter((x) => x.id !== s.id));
      return;
    }
    const next = section.draft.replace(s.original, s.replacement);
    projectStore.update((p) => setDraft(p, section.id, next));
    setSuggestions((list) => list.filter((x) => x.id !== s.id));
  }

  if (!section) return null;
  const guide = section.kind === "intro" ? t.write.guideIntro : section.kind === "conclusion" ? t.write.guideConclusion : t.write.guideBody;

  return (
    <div className="flex flex-col gap-6">
      <PageTitle
        actions={
          <>
            <span className={`self-center text-sm ${saveStatus === "error" ? "text-[var(--danger-ink)]" : "text-[var(--ink-muted)]"}`} aria-live="polite">{saveLabel}</span>
            <Button onClick={draftAllEmpty} disabled={bulk !== null || drafting || bulkDrafts.length > 0}>
              {bulk ? <Spinner label={t.write.draftingAll(bulk.done, bulk.total)} /> : `✨ ${t.write.draftAll}`}
            </Button>
            <LinkButton href="/review">{t.write.review} →</LinkButton>
          </>
        }
      >
        {project.topic}
      </PageTitle>

      {bulkDrafts.length > 0 ? (
        <Card as="section" label={t.write.draftAllTitle} className="border-2 border-[var(--accent)]">
          <h2 className="font-semibold">✨ {t.write.draftAllTitle}</h2>
          <p className="mb-3 text-sm text-[var(--ink-muted)]">{t.write.draftWarning}</p>
          {bulkOffline ? <div className="mb-3"><Notice tone="warn">{t.common.offlineHint}</Notice></div> : null}
          <ul className="flex flex-col gap-3">
            {bulkDrafts.map((item) => {
              const target = project.sections.find((s) => s.id === item.sectionId);
              if (!target) return null;
              return (
                <li key={item.sectionId} className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-3">
                  <p className="font-semibold">{sectionName(target, t)}</p>
                  <p className="mt-1 whitespace-pre-wrap leading-relaxed">{item.text}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button variant="primary" className="min-h-9" onClick={() => applyBulkDraft(item)}>
                      {target.draft.trim() ? t.write.addToEnd : t.write.useDraft}
                    </Button>
                    <Button variant="ghost" className="min-h-9" onClick={() => setBulkDrafts((list) => list.filter((x) => x.sectionId !== item.sectionId))}>
                      {t.write.discard}
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="primary" onClick={applyAllBulkDrafts}>{t.write.useAll}</Button>
            <Button variant="ghost" onClick={() => setBulkDrafts([])}>{t.write.discardAll}</Button>
          </div>
        </Card>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2.4fr)_minmax(0,1.4fr)]">
        <nav aria-label={t.write.sections} className="min-w-0 lg:sticky lg:top-4 lg:self-start">
          <p className="mb-2 font-semibold">{t.write.sections}</p>
          <ul className="flex max-w-full flex-row gap-2 overflow-x-auto lg:flex-col">
            {project.sections.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  aria-current={s.id === section.id ? "true" : undefined}
                  onClick={() => {
                    setActiveId(s.id);
                    setSuggestions([]);
                    setPreview(null);
                    setMessage(null);
                  }}
                  className={`min-h-11 whitespace-nowrap rounded-lg px-3 py-2 text-left ${
                    s.id === section.id ? "bg-[var(--accent)] font-semibold text-[var(--accent-fg)]" : "bg-[var(--surface)] hover:bg-[var(--surface-2)]"
                  }`}
                >
                  {sectionName(s, t)}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <section aria-label={t.write.editorLabel(section.title)} className="flex min-w-0 flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="mr-auto text-lg font-bold">{sectionName(section, t)}</h2>
            <Button variant="primary" onClick={draftSection} disabled={drafting || bulk !== null}>
              {drafting ? <Spinner label={t.write.drafting} /> : `✨ ${t.write.draftAi}`}
            </Button>
            <CitePicker sources={sources} onPick={(ref) => insertAtCursor(`[${ref}]`)} />
            <Button onClick={improve} disabled={improving || section.draft.trim().length < 10}>
              {improving ? <Spinner label={t.write.improving} /> : `✨ ${t.write.improve}`}
            </Button>
          </div>
          <label htmlFor="draft" className="sr-only">{t.write.editorLabel(section.title)}</label>
          <textarea
            id="draft"
            ref={editor}
            key={section.id}
            value={section.draft}
            onChange={(e) => {
              const value = e.target.value;
              projectStore.update((p) => setDraft(p, section.id, value));
            }}
            placeholder={t.write.placeholder}
            className="min-h-[24rem] w-full rounded-xl border border-[var(--line-strong)] bg-[var(--surface)] p-4 text-lg leading-relaxed focus-visible:outline-3 focus-visible:outline-offset-1 focus-visible:outline-[var(--focus)]"
          />
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-[var(--ink-muted)]">
            <span>{t.write.wordCount(words)}</span>
            <span>{t.write.footer}</span>
          </div>
          {preview && preview.sectionId === section.id ? (
            <Card as="section" label={t.write.draftTitle} className="border-2 border-[var(--accent)]">
              <p className="font-semibold">✨ {t.write.draftTitle}</p>
              <p className="mb-3 text-sm text-[var(--ink-muted)]">{t.write.draftWarning}</p>
              {preview.offline ? <div className="mb-3"><Notice tone="warn">{t.common.offlineHint}</Notice></div> : null}
              <p className="whitespace-pre-wrap leading-relaxed">{preview.text}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {section.draft.trim() ? (
                  <>
                    <Button variant="primary" onClick={() => applyPreview("replace")}>{t.write.replaceText}</Button>
                    <Button onClick={() => applyPreview("append")}>{t.write.addToEnd}</Button>
                  </>
                ) : (
                  <Button variant="primary" onClick={() => applyPreview("replace")}>{t.write.useDraft}</Button>
                )}
                <Button onClick={draftSection} disabled={drafting}>{t.common.tryAgain}</Button>
                <Button variant="ghost" onClick={() => setPreview(null)}>{t.write.discard}</Button>
              </div>
            </Card>
          ) : null}
          {message ? <Notice>{message}</Notice> : null}
          {error ? <Notice tone="error">{error}</Notice> : null}
          {suggestions.length > 0 ? (
            <ul className="flex flex-col gap-3" aria-label={t.write.improve}>
              {suggestions.map((s) => (
                <li key={s.id}>
                  <Card>
                    <p className="text-sm text-[var(--ink-muted)]">{t.write.improveThis}</p>
                    <p className="mt-1">
                      <s>{s.original}</s> → <strong>{s.replacement}</strong>
                    </p>
                    <p className="mt-1 text-sm">{s.why}</p>
                    <div className="mt-3 flex gap-2">
                      <Button variant="primary" className="min-h-9" onClick={() => applySuggestion(s)}>{t.write.useIt}</Button>
                      <Button className="min-h-9" onClick={() => setSuggestions((list) => list.filter((x) => x.id !== s.id))}>{t.write.skip}</Button>
                    </div>
                  </Card>
                </li>
              ))}
            </ul>
          ) : null}
        </section>

        <aside className="flex min-w-0 flex-col gap-4">
          <Card as="section" label={t.write.guide(section.title)} className="bg-[var(--accent-soft)]">
            <p className="mb-2 font-semibold">{t.write.guide(section.title)}</p>
            {section.keyPoint ? (
              <p className="mb-2 text-sm">
                <span className="font-semibold">{t.outline.keyPoint}:</span> {section.keyPoint}
              </p>
            ) : null}
            <ul className="list-disc space-y-1 pl-5">
              {guide.map((g) => (
                <li key={g}>{g}</li>
              ))}
            </ul>
          </Card>

          <Card as="section" label={t.write.yourNotes}>
            <p className="mb-2 font-semibold">{t.write.yourNotes}</p>
            {notesFor(project, section.id).length === 0 ? (
              <p className="text-sm text-[var(--ink-muted)]">{t.notes.empty}</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {notesFor(project, section.id).map((n) => (
                  <li key={n.id} className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-3">
                    <p className="text-sm">{n.text}</p>
                    <Button className="mt-2 min-h-9 px-3 text-sm" onClick={() => insertAtCursor(n.text)}>
                      {t.write.useNote}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </aside>
      </div>
    </div>
  );
}

function sectionName(s: Section, t: ReturnType<typeof useT>) {
  if (s.kind === "intro") return t.outline.intro;
  if (s.kind === "conclusion") return t.outline.conclusion;
  return s.title;
}

function CitePicker({ sources, onPick }: { sources: Source[]; onPick: (ref: number) => void }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const numbered = sources.flatMap((s) => (s.ref === null ? [] : [{ id: s.id, ref: s.ref, title: s.title }]));
  if (numbered.length === 0) return <span className="text-sm text-[var(--ink-muted)]">{t.write.noSaved}</span>;
  return (
    <div className="relative">
      <Button aria-expanded={open} aria-haspopup="listbox" onClick={() => setOpen((o) => !o)}>
        📎 {t.write.cite}
      </Button>
      {open ? (
        <ul role="listbox" aria-label={t.write.insertCitation} className="absolute z-10 mt-1 w-72 max-w-[85vw] rounded-lg border border-[var(--line-strong)] bg-[var(--surface)] p-1 shadow-lg">
          {numbered.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                role="option"
                aria-selected={false}
                onClick={() => {
                  onPick(s.ref);
                  setOpen(false);
                }}
                className="w-full rounded-md px-3 py-2 text-left hover:bg-[var(--surface-2)]"
              >
                [{s.ref}] {s.title}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
