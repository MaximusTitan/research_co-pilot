"use client";

import { useState } from "react";
import { Button, Card, Field, LinkButton, Notice, PageTitle, Spinner, inputClass } from "../../components/ui";
import { RequireProject } from "../../components/shell";
import { ReadAloud } from "../../components/read-aloud";
import { callAgent } from "../../lib/client/agent";
import { useLocale, useT } from "../../lib/i18n";
import { addNote, addSection, deleteNote, ensureSection, moveNote, notesFor, removeSection } from "../../lib/project";
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
    projectStore.update((p) => {
      let next = p;
      for (const a of result.data.assignments) {
        if (!p.notes.some((n) => n.id === a.noteId)) continue;
        const ensured = ensureSection(next, a.section);
        next = moveNote(ensured.project, a.noteId, ensured.sectionId || null);
      }
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <PageTitle
        actions={
          <>
            <Button onClick={sort} disabled={sorting || project.notes.length === 0}>
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

      <form
        className="grid gap-3 sm:grid-cols-[1fr_auto]"
        onSubmit={(e) => {
          e.preventDefault();
          projectStore.update((p) => addNote(p, newNote, null));
          setNewNote("");
        }}
      >
        <Field id="new-note" label={t.notes.addNote}>
          <input id="new-note" className={inputClass} value={newNote} maxLength={1000} placeholder={t.notes.newNotePlaceholder} onChange={(e) => setNewNote(e.target.value)} />
        </Field>
        <div className="flex items-end">
          <Button type="submit" disabled={!newNote.trim()}>+ {t.notes.addNote}</Button>
        </div>
      </form>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {project.sections.map((section) => (
          <Card as="section" key={section.id} label={section.title} className="flex flex-col gap-3 bg-[var(--surface-2)]">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-bold">{section.title}</h2>
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

      <Card as="section" label={t.notes.unsorted(unsorted.length)} className="border-dashed">
        <h2 className="mb-2 font-semibold">{t.notes.unsorted(unsorted.length)}</h2>
        <p className="mb-3 text-sm text-[var(--ink-muted)]">{t.notes.dragHint}</p>
        <NoteList notes={unsorted} project={project} sourceTitle={sourceTitle} />
        {project.notes.length === 0 ? <p className="text-[var(--ink-muted)]">{t.notes.empty}</p> : null}
      </Card>

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
