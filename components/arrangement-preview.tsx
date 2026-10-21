"use client";

import { useState } from "react";
import { useT } from "../lib/i18n";
import { arrangementOf, notesFor, restoreArrangement, type Arrangement } from "../lib/project";
import { projectStore } from "../lib/store";
import type { Project } from "../lib/types";
import { Button, Card, Notice } from "./ui";

/**
 * Holds an AI suggestion for how to sort notes until the student applies it,
 * and keeps the layout from before so the last one applied can be undone.
 */
export function useArrangement() {
  const [suggestion, setSuggestion] = useState<{ apply: (p: Project) => Project } | null>(null);
  const [before, setBefore] = useState<Arrangement | null>(null);
  return {
    suggestion: suggestion?.apply ?? null,
    canUndo: before !== null,
    propose(apply: (p: Project) => Project) {
      setSuggestion({ apply });
      setBefore(null);
    },
    discard: () => setSuggestion(null),
    apply(current: Project) {
      if (!suggestion) return;
      setBefore(arrangementOf(current));
      setSuggestion(null);
      projectStore.update(suggestion.apply);
    },
    undo() {
      if (!before) return;
      const snapshot = before;
      projectStore.update((p) => restoreArrangement(p, snapshot));
      setBefore(null);
    },
  };
}

/** Shows the sections and notes a suggestion would produce, marking new sections and notes that move. */
export function ArrangementPreview({ current, proposed, onApply, onDiscard }: { current: Project; proposed: Project; onApply: () => void; onDiscard: () => void }) {
  const t = useT();
  const was = new Map(current.notes.map((n) => [n.id, n.sectionId]));
  const existing = new Set(current.sections.map((s) => s.id));
  const moves = proposed.notes.filter((n) => was.get(n.id) !== n.sectionId).length;
  const newSections = proposed.sections.filter((s) => !existing.has(s.id)).length;
  const keyPoints = proposed.sections.some((s) => s.keyPoint !== current.sections.find((c) => c.id === s.id)?.keyPoint);
  const changes = moves > 0 || newSections > 0 || keyPoints;

  return (
    <Card as="section" label={t.arrange.previewTitle} className="border-2 border-[var(--accent)]">
      <h2 className="font-semibold">✨ {t.arrange.previewTitle}</h2>
      <p className="mb-3 text-sm text-[var(--ink-muted)]">{changes ? `${t.arrange.previewHelp} ${t.arrange.moved(moves)}` : t.arrange.noChange}</p>
      {changes ? (
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {proposed.sections.map((s) => {
            const notes = notesFor(proposed, s.id);
            return (
              <li key={s.id} className="rounded-lg border border-[var(--line)] bg-[var(--surface-2)] p-3">
                <p className="font-semibold">
                  {s.title}
                  {existing.has(s.id) ? null : (
                    <span className="ml-2 rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-xs font-normal">{t.arrange.newSection}</span>
                  )}
                </p>
                {s.keyPoint ? <p className="mt-1 text-sm text-[var(--ink-muted)]">{s.keyPoint}</p> : null}
                <ul className="mt-2 flex flex-col gap-1 text-sm">
                  {notes.map((n) => {
                    const moved = was.get(n.id) !== n.sectionId;
                    return (
                      <li key={n.id} className={`rounded-md p-2 ${moved ? "bg-[var(--accent-soft)]" : "bg-[var(--surface)]"}`}>
                        {moved ? <span aria-hidden>→ </span> : null}
                        {n.text.length > 120 ? `${n.text.slice(0, 120)}…` : n.text}
                      </li>
                    );
                  })}
                </ul>
              </li>
            );
          })}
        </ul>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-2">
        {changes ? <Button variant="primary" onClick={onApply}>{t.arrange.apply}</Button> : null}
        <Button variant="ghost" onClick={onDiscard}>{t.arrange.discard}</Button>
      </div>
    </Card>
  );
}

export function UndoArrangement({ onUndo }: { onUndo: () => void }) {
  const t = useT();
  return (
    <Notice>
      <span className="flex flex-wrap items-center gap-3">
        {t.arrange.applied}
        <Button className="min-h-9 px-3 text-sm" onClick={onUndo}>↶ {t.arrange.undo}</Button>
      </span>
    </Notice>
  );
}
