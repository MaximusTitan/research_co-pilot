"use client";

import Link from "next/link";
import { useState } from "react";
import { Button, Card, LinkButton, Notice, PageTitle, Spinner, inputClass } from "../../components/ui";
import { RequireProject } from "../../components/shell";
import { ArrangementPreview, UndoArrangement, useArrangement } from "../../components/arrangement-preview";
import { callAgent } from "../../lib/client/agent";
import { useLocale, useT } from "../../lib/i18n";
import { addSection, applyOutline, moveSection, notesFor, renameSection } from "../../lib/project";
import { projectStore } from "../../lib/store";
import type { Gap, Project, Section } from "../../lib/types";

export default function OutlinePage() {
  return <RequireProject>{(project) => <Outline project={project} />}</RequireProject>;
}

function Outline({ project }: { project: Project }) {
  const t = useT();
  const locale = useLocale();
  const [newTitle, setNewTitle] = useState("");
  const [gaps, setGaps] = useState<Gap[] | null>(null);
  const [finding, setFinding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const [building, setBuilding] = useState(false);
  const [outlineError, setOutlineError] = useState<string | null>(null);
  const [outlineOffline, setOutlineOffline] = useState(false);
  const arrangement = useArrangement();

  const emptyBody = project.sections.find((s) => s.kind === "body" && notesFor(project, s.id).length === 0);

  async function findGaps() {
    setFinding(true);
    setError(null);
    const result = await callAgent("gaps", {
      question: project.question ?? project.topic,
      grade: project.grade,
      locale,
      sections: project.sections.map((s) => ({ title: s.title, notes: notesFor(project, s.id).map((n) => n.text) })),
    });
    setFinding(false);
    if (!result.ok) {
      setError(t.common.agentError);
      return;
    }
    setOffline(result.mode === "offline");
    setGaps(result.data.gaps);
  }

  async function buildOutline() {
    setBuilding(true);
    setOutlineError(null);
    const result = await callAgent("outline", {
      question: project.question ?? project.topic,
      writingType: project.writingType,
      grade: project.grade,
      locale,
      notes: project.notes.slice(0, 80).map((n) => ({
        id: n.id,
        text: n.text.slice(0, 1000),
        source: project.sources.find((s) => s.id === n.sourceId)?.title.slice(0, 300) ?? null,
      })),
    });
    setBuilding(false);
    if (!result.ok) {
      setOutlineError(t.common.agentError);
      return;
    }
    setOutlineOffline(result.mode === "offline");
    const { sections } = result.data;
    arrangement.propose((p) => applyOutline(p, sections));
  }

  function sectionLabel(s: Section) {
    if (s.kind === "intro") return t.outline.intro;
    if (s.kind === "conclusion") return t.outline.conclusion;
    return s.title;
  }

  return (
    <div className="flex flex-col gap-6">
      <PageTitle actions={<LinkButton href="/write">{t.outline.startWriting} →</LinkButton>}>{t.outline.title}</PageTitle>
      <p className="-mt-4 text-[var(--ink-muted)]">{t.outline.subtitle}</p>
      {arrangement.suggestion ? (
        <ArrangementPreview
          current={project}
          proposed={arrangement.suggestion(project)}
          onApply={() => arrangement.apply(project)}
          onDiscard={arrangement.discard}
        />
      ) : null}
      {arrangement.canUndo ? <UndoArrangement onUndo={arrangement.undo} /> : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <ol className="flex flex-col gap-3" aria-label={t.outline.title}>
          {project.sections.map((s, index) => {
            const count = notesFor(project, s.id).length;
            const isBody = s.kind === "body";
            const bodyIndex = project.sections.filter((x) => x.kind === "body").findIndex((x) => x.id === s.id);
            return (
              <li key={s.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3">
                <span aria-hidden className="grid size-9 place-items-center rounded-lg bg-[var(--accent-soft)] font-bold">
                  {s.kind === "intro" ? t.outline.introShort : s.kind === "conclusion" ? t.outline.endShort : bodyIndex + 1}
                </span>
                {isBody ? (
                  <label className="sr-only" htmlFor={`title-${s.id}`}>{t.outline.sectionPlaceholder}</label>
                ) : null}
                {isBody ? (
                  <input
                    id={`title-${s.id}`}
                    className={`${inputClass} min-w-40 flex-1`}
                    value={s.title}
                    maxLength={120}
                    onChange={(e) => projectStore.update((p) => renameSection(p, s.id, e.target.value))}
                  />
                ) : (
                  <p className="min-w-40 flex-1 font-semibold">{sectionLabel(s)}</p>
                )}
                {s.keyPoint ? (
                  <p className="basis-full pl-12 text-sm text-[var(--ink-muted)]">
                    <span className="font-semibold">{t.outline.keyPoint}:</span> {s.keyPoint}
                  </p>
                ) : null}
                <span className="rounded-full bg-[var(--surface-2)] px-3 py-1 text-sm">
                  {count === 0 ? t.outline.noNotes : t.outline.notesCount(count)}
                </span>
                {isBody ? (
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      className="min-h-9 px-2"
                      aria-label={`${t.outline.moveUp}: ${s.title}`}
                      disabled={index <= 1}
                      onClick={() => projectStore.update((p) => moveSection(p, s.id, index - 1))}
                    >
                      ↑
                    </Button>
                    <Button
                      variant="ghost"
                      className="min-h-9 px-2"
                      aria-label={`${t.outline.moveDown}: ${s.title}`}
                      disabled={index >= project.sections.length - 2}
                      onClick={() => projectStore.update((p) => moveSection(p, s.id, index + 1))}
                    >
                      ↓
                    </Button>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ol>

        <aside className="flex min-w-0 flex-col gap-4">
          <Card as="section" label={t.outline.aiOutline} className="bg-[var(--accent-soft)]">
            <h2 className="font-semibold">✨ {t.outline.aiOutline}</h2>
            <p className="mb-3 text-sm">{project.notes.length ? t.outline.aiOutlineHelp : t.outline.needNotes}</p>
            <Button variant="primary" onClick={buildOutline} disabled={building || arrangement.suggestion !== null || project.notes.length === 0}>
              {building ? <Spinner label={t.outline.aiOutlining} /> : t.outline.aiOutline}
            </Button>
            {outlineOffline ? <div className="mt-3"><Notice tone="warn">{t.common.offlineHint}</Notice></div> : null}
            {outlineError ? <div className="mt-3"><Notice tone="error">{outlineError}</Notice></div> : null}
          </Card>

          {emptyBody ? (
            <Card className="bg-[var(--accent-soft)]">
              <p className="mb-1 font-semibold">💡 {t.outline.idea}</p>
              <p>{t.outline.emptySection(emptyBody.title)}</p>
              <Link href="/sources" className="mt-3 inline-flex min-h-11 items-center font-semibold underline underline-offset-4">
                {t.outline.findSources} →
              </Link>
            </Card>
          ) : null}

          <form
            className="flex flex-col gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              projectStore.update((p) => addSection(p, newTitle));
              setNewTitle("");
            }}
          >
            <label htmlFor="new-section" className="font-semibold">{t.outline.addSection}</label>
            <input id="new-section" className={inputClass} value={newTitle} maxLength={120} placeholder={t.outline.sectionPlaceholder} onChange={(e) => setNewTitle(e.target.value)} />
            <Button type="submit" disabled={!newTitle.trim()}>+ {t.outline.addSection}</Button>
          </form>

          <Card>
            <p className="font-semibold">{t.outline.tip}</p>
            <p className="text-sm text-[var(--ink-muted)]">{t.outline.tipText}</p>
          </Card>

          <Card as="section" label={t.outline.gapsTitle}>
            <h2 className="font-semibold">{t.outline.gapsTitle}</h2>
            <p className="mb-3 text-sm text-[var(--ink-muted)]">{t.outline.gapsHelp}</p>
            <Button onClick={findGaps} disabled={finding}>
              {finding ? <Spinner label={t.outline.findingGaps} /> : t.outline.findGaps}
            </Button>
            {offline ? <div className="mt-3"><Notice tone="warn">{t.common.offlineHint}</Notice></div> : null}
            {error ? <div className="mt-3"><Notice tone="error">{error}</Notice></div> : null}
            {gaps ? (
              <ul className="mt-3 flex flex-col gap-3">
                {gaps.map((g) => (
                  <li key={g.question} className="rounded-lg border border-[var(--line)] p-3">
                    <p className="font-semibold">{g.question}</p>
                    <p className="text-sm text-[var(--ink-muted)]">{g.why}</p>
                  </li>
                ))}
              </ul>
            ) : null}
          </Card>
        </aside>
      </div>
    </div>
  );
}
