"use client";

import { useState } from "react";
import { Button, Card, Field, LinkButton, Notice, PageTitle, Spinner, inputClass } from "../../components/ui";
import { RequireProject } from "../../components/shell";
import { ReadAloud } from "../../components/read-aloud";
import { ArrangementPreview, UndoArrangement, useArrangement } from "../../components/arrangement-preview";
import { callAgent } from "../../lib/client/agent";
import { useLocale, useT } from "../../lib/i18n";
import { addNote, addSection, applySort, deleteNote, moveNote, notesFor, removeSection } from "../../lib/project";
import { projectStore } from "../../lib/store";
import type { Note, Project } from "../../lib/types";

export default function NotesPage() {
  return <RequireProject>{(project) => <Notes project={project} />}</RequireProject>;
}

function Notes({ project }: { project: Project }) {
  const t = useT();
  const locale = useLocale();
  const [newNote, setNewNote] = useState("");
  const [newTheme, setNewTheme] = useState("");
  const [sorting, setSorting] = useState(false);
  const [contradictions, setContradictions] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const arrangement = useArrangement();

  const bodySections = project.sections.filter((s) => s.kind === "body");
  const unsorted = notesFor(project, null);
  const sourceTitle = (id: string | null) => project.sources.find((s) => s.id === id)?.title ?? t.notes.noSource;

  async function sort() {
    setSorting(true);
    setError(null);
    const result = await callAgent("synthesize", {
      question: project.question ?? project.topic,
      notes: project.notes.map((n) => ({ id: n.id, text: n.text, source: n.sourceId ? sourceTitle(n.sourceId) : null })),
      sections: bodySections.map((s) => s.title),
      locale,
    });
    setSorting(false);
    if (!result.ok) {
      setError(t.common.agentError);
      return;
    }
    setOffline(result.mode === "offline");
    setContradictions(result.data.contradictions.map((c) => c.explanation));
    const { assignments } = result.data;
    arrangement.propose((p) => applySort(p, assignments));
  }

  return (
    <div className="flex flex-col gap-6">
      <PageTitle
        actions={
          <>
            <Button onClick={sort} disabled={sorting || arrangement.suggestion !== null || project.notes.length === 0}>
              {sorting ? <Spinner label={t.notes.sorting} /> : `✨ ${t.notes.sort}`}
            </Button>
            <LinkButton href="/outline">{t.notes.outline} →</LinkButton>
          </>
        }
      >
        {t.notes.title}
      </PageTitle>

      {offline ? <Notice tone="warn">{t.common.offlineHint}</Notice> : null}
      {error ? <Notice tone="error">{error}</Notice> : null}
      {arrangement.suggestion ? (
        <ArrangementPreview
          current={project}
          proposed={arrangement.suggestion(project)}
          onApply={() => arrangement.apply(project)}
          onDiscard={arrangement.discard}
        />
      ) : null}
      {arrangement.canUndo ? <UndoArrangement onUndo={arrangement.undo} /> : null}
      {contradictions.length > 0 ? (
        <Notice tone="warn">
          <p className="mb-1 font-semibold">{t.notes.contradictions}</p>
          <ul className="list-disc pl-5">
            {contradictions.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </Notice>
      ) : null}

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <aside className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-4">
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              projectStore.update((p) => addNote(p, newNote, null));
              setNewNote("");
            }}
          >
            <label htmlFor="new-note" className="sr-only">{t.notes.addNote}</label>
            <input id="new-note" className={inputClass} value={newNote} maxLength={1000} placeholder={t.notes.newNotePlaceholder} onChange={(e) => setNewNote(e.target.value)} />
            <Button type="submit" disabled={!newNote.trim()} className="shrink-0">+ {t.notes.addNote}</Button>
          </form>

          <Card as="section" label={t.notes.unsorted(unsorted.length)} className={unsorted.length ? "border-2 border-dashed border-[var(--accent)]" : "border-dashed shadow-none"}>
            <h2 className="mb-1 font-semibold tabular-nums">{t.notes.unsorted(unsorted.length)}</h2>
            <p className="mb-3 text-sm text-[var(--ink-muted)]">{t.notes.dragHint}</p>
            {project.notes.length === 0 ? <p className="text-[var(--ink-muted)]">{t.notes.empty}</p> : <NoteList notes={unsorted} project={project} sourceTitle={sourceTitle} />}
          </Card>
        </aside>

        <div className="flex min-w-0 flex-col gap-4">
      <div className="grid gap-4 md:grid-cols-2">
        {project.sections.map((section) => (
          <Card as="section" key={section.id} label={section.title} className="flex flex-col gap-3 bg-[var(--surface-2)]">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-bold">
                {section.kind === "intro" ? t.outline.intro : section.kind === "conclusion" ? t.outline.conclusion : section.title}
                <span className="ml-2 text-sm font-normal text-[var(--ink-muted)] tabular-nums">{notesFor(project, section.id).length}</span>
              </h2>
              {section.kind === "body" ? (
                <Button variant="ghost" className="min-h-9 px-2 text-sm" aria-label={`${t.notes.removeTheme}: ${section.title}`} onClick={() => projectStore.update((p) => removeSection(p, section.id))}>
                  ✕
                </Button>
              ) : null}
            </div>
            <NoteList notes={notesFor(project, section.id)} project={project} sourceTitle={sourceTitle} />
          </Card>
        ))}
      </div>

      <form
        className="grid gap-3 sm:grid-cols-[1fr_auto]"
        onSubmit={(e) => {
          e.preventDefault();
          projectStore.update((p) => addSection(p, newTheme));
          setNewTheme("");
        }}
      >
        <Field id="new-theme" label={t.notes.addTheme}>
          <input id="new-theme" className={inputClass} value={newTheme} maxLength={120} placeholder={t.notes.newThemePlaceholder} onChange={(e) => setNewTheme(e.target.value)} />
        </Field>
        <div className="flex items-end">
          <Button type="submit" disabled={!newTheme.trim()}>+ {t.notes.addTheme}</Button>
        </div>
      </form>
        </div>
      </div>
    </div>
  );
}

function NoteList({ notes, project, sourceTitle }: { notes: Note[]; project: Project; sourceTitle: (id: string | null) => string }) {
  const t = useT();
  if (notes.length === 0) return <p className="text-sm text-[var(--ink-muted)]">{t.notes.dropHere}</p>;
  return (
    <ul className="flex flex-col gap-2">
      {notes.map((n) => (
        <li key={n.id} className="flex flex-col gap-2 rounded-lg border border-[var(--line)] bg-[var(--surface)] p-3">
          <p>{n.text}</p>
          <p className="text-xs text-[var(--ink-muted)]">{sourceTitle(n.sourceId)}</p>
          <div className="flex flex-wrap items-center gap-2">
            <label className="sr-only" htmlFor={`move-${n.id}`}>{t.notes.moveTo}</label>
            <select
              id={`move-${n.id}`}
              className="min-h-9 rounded-md border border-[var(--line-strong)] bg-[var(--surface)] px-2 text-sm"
              value={n.sectionId ?? ""}
              onChange={(e) => projectStore.update((p) => moveNote(p, n.id, e.target.value || null))}
            >
              <option value="">{t.notes.unsortedOption}</option>
              {project.sections.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
            </select>
            <ReadAloud text={n.text} />
            <Button variant="ghost" className="ml-auto min-h-9 px-2 text-sm" aria-label={`${t.common.delete}: ${n.text.slice(0, 40)}`} onClick={() => projectStore.update((p) => deleteNote(p, n.id))}>
              🗑
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}
