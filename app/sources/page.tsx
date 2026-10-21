"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import { Button, Card, LinkButton, Notice, PageTitle, Spinner, TrustBadge, inputClass } from "../../components/ui";
import { RequireProject } from "../../components/shell";
import { ReadAloud } from "../../components/read-aloud";
import { formatCitation } from "../../lib/citations";
import { callAgent } from "../../lib/client/agent";
import { useFlash } from "../../lib/client/hooks";
import { useLocale, useT } from "../../lib/i18n";
import { addDocumentSource, addSourceNote, addSources, needsSearch, toggleMarked, toggleSaved } from "../../lib/project";
import { safeHttpUrl } from "../../lib/credibility";
import { projectStore } from "../../lib/store";
import { documentSource, filterSources, toSource, type SourceFilter } from "../../lib/sources";
import type { Project, Source } from "../../lib/types";

const MAX_FILE_BYTES = 200_000;

export default function SourcesPage() {
  return <RequireProject>{(project) => <Sources project={project} />}</RequireProject>;
}

function Sources({ project }: { project: Project }) {
  const t = useT();
  const locale = useLocale();
  const [filter, setFilter] = useState<SourceFilter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(project.sources[0]?.id ?? null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [offline, setOffline] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  const question = project.question ?? project.topic;

  async function search(nextPage: number) {
    setLoading(true);
    setError(null);
    const result = await callAgent("sources", { question, topic: project.topic, grade: project.grade, locale, page: nextPage });
    setLoading(false);
    if (!result.ok) {
      setError(t.sources.networkHint);
      return;
    }
    setOffline(result.mode === "offline");
    setPage(nextPage);
    const found = result.data.sources.map(toSource);
    projectStore.update((p) => ({ ...addSources(p, found), searchedFor: question }));
  }

  const startSearch = useEffectEvent(() => search(1));
  // Look for sources the first time this screen opens for a question, and again after the question changes.
  const stale = needsSearch(project);
  useEffect(() => {
    if (started.current || !stale) return;
    started.current = true;
    void startSearch();
  }, [stale]);

  const visible = filterSources(project.sources, filter);
  const selected: Source | undefined = project.sources.find((s) => s.id === selectedId) ?? visible[0];
  const savedCount = project.sources.filter((s) => s.saved).length;

  return (
    <div className="flex flex-col gap-6">
      <PageTitle>{t.sources.title}</PageTitle>
      <p className="-mt-4 text-[var(--ink-muted)]">{question}</p>

      <div role="group" aria-label={t.sources.title} className="flex flex-wrap gap-2">
        {(
          [
            ["all", t.sources.all(project.sources.length)],
            ["trusted", t.sources.trustedOnly],
            ["saved", t.sources.savedFilter(savedCount)],
          ] as const
        ).map(([value, label]) => (
          <Button key={value} aria-pressed={filter === value} variant={filter === value ? "primary" : "secondary"} onClick={() => setFilter(value)} className="min-h-9">
            {label}
          </Button>
        ))}
      </div>

      {offline ? <Notice tone="warn">{t.sources.needsAi}</Notice> : null}
      {error ? <Notice tone="error">{error}</Notice> : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <section aria-label={t.sources.title} className="flex min-w-0 flex-col gap-3">
          {loading && stale ? <Spinner label={t.sources.searching} /> : null}
          {!loading && visible.length === 0 ? <p className="text-[var(--ink-muted)]">{t.sources.none}</p> : null}
          <ul className="flex flex-col gap-3">
            {visible.map((s) => {
              const isSelected = selected?.id === s.id;
              return (
                <li key={s.id}>
                  <div
                    className={`rounded-xl border-2 p-4 transition-colors ${
                      isSelected ? "border-[var(--accent)] bg-[var(--accent-soft)]" : "border-[var(--line)] bg-[var(--surface)]"
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <button
                        type="button"
                        aria-current={isSelected ? "true" : undefined}
                        onClick={() => setSelectedId(s.id)}
                        className="text-left font-semibold underline-offset-4 hover:underline focus-visible:outline-3 focus-visible:outline-[var(--focus)]"
                      >
                        {s.title}
                      </button>
                      <TrustBadge trust={s.trust} />
                    </div>
                    <p className="text-sm text-[var(--ink-muted)]">
                      {[s.publisher, s.year, t.sources.kinds[s.kind]].filter(Boolean).join(" · ")}
                    </p>
                    <p className="mt-1 line-clamp-2">{s.summary}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Button
                        className="min-h-9 px-3 text-sm"
                        aria-pressed={s.saved}
                        onClick={() => projectStore.update((p) => toggleSaved(p, s.id))}
                      >
                        <span aria-hidden>{s.saved ? "⭐" : "☆"}</span> {s.saved ? t.sources.unsave : t.sources.save}
                      </Button>
                      <Button
                        className="min-h-9 px-3 text-sm"
                        aria-pressed={s.marked}
                        onClick={() => projectStore.update((p) => toggleMarked(p, s.id))}
                      >
                        <span aria-hidden>{s.marked ? "🔖" : "✎"}</span> {s.marked ? t.sources.marked : t.sources.mark}
                      </Button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
          <div>
            <Button onClick={() => search(page + 1)} disabled={loading}>
              {loading && !stale ? <Spinner label={t.sources.searching} /> : t.sources.searchAgain}
            </Button>
          </div>
        </section>

        <aside aria-label={t.sources.reading} className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-4 lg:self-start">
          {selected ? <Reader source={selected} /> : <Card><p>{t.sources.pickOne}</p></Card>}
          <UploadDocument project={project} question={question} />
        </aside>
      </div>

      <div className="flex justify-end">
        <LinkButton href="/notes">{t.sources.next} →</LinkButton>
      </div>
    </div>
  );
}

function Reader({ source }: { source: Source }) {
  const t = useT();
  const [copied, flashCopied] = useFlash();
  const [added, flashAdded] = useFlash();
  const url = safeHttpUrl(source.url);
  const readText = `${source.title}. ${source.summary}`;

  async function copyCitation() {
    try {
      await navigator.clipboard.writeText(formatCitation(source, "apa"));
      flashCopied();
    } catch {
      // Clipboard blocked: the citation is still shown below for manual copying.
    }
  }

  return (
    <Card as="article" label={t.sources.reading}>
      <p className="text-sm font-semibold text-[var(--ink-muted)]">{t.sources.reading}</p>
      <h2 className="text-lg font-bold">{source.title}</h2>
      <p className="text-sm text-[var(--ink-muted)]">
        {[source.authors.join(", "), source.year].filter(Boolean).join(" · ")}
      </p>
      <div className="mt-3 flex flex-col gap-2">
        <TrustBadge trust={source.trust} />
        <p className="text-sm">
          <span className="font-semibold">{t.sources.why}</span> {t.trustReason[source.trustReason]}
        </p>
      </div>
      <p className="mt-3">{source.summary}</p>
      {source.keyQuote ? (
        <blockquote className="mt-3 rounded-lg border-l-4 border-[var(--warn)] bg-[var(--warn-bg)] p-3">
          <p className="mb-1 text-sm font-semibold">{t.sources.highlight}</p>
          <p>
            <mark className="key">{source.keyQuote}</mark>
          </p>
        </blockquote>
      ) : null}
      <div className="mt-4 flex flex-col gap-2">
        <Button
          variant="primary"
          onClick={() => {
            projectStore.update((p) => addSourceNote(p, source));
            flashAdded();
          }}
        >
          <span aria-hidden>📌</span> {added ? t.sources.addedToNotes : t.sources.addToNotes}
        </Button>
        <Button onClick={copyCitation}>{copied ? t.sources.citeCopied : t.sources.cite}</Button>
        <div className="flex flex-wrap gap-2">
          <ReadAloud text={readText} />
          {url ? (
            <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center underline underline-offset-4">
              {t.sources.open}
            </a>
          ) : null}
        </div>
      </div>
    </Card>
  );
}

function UploadDocument({ project, question }: { project: Project; question: string }) {
  const t = useT();
  const locale = useLocale();
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function onFile(file: File | undefined) {
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) {
      setError(t.sources.fileTooBig);
      return;
    }
    if (!/\.(txt|md)$/i.test(file.name)) {
      setError(t.sources.fileType);
      return;
    }
    setError(null);
    setText(await file.text());
    setTitle((prev) => prev || file.name.replace(/\.(txt|md)$/i, ""));
  }

  async function analyze() {
    setError(null);
    setDone(null);
    setBusy(true);
    const docTitle = title.trim() || t.sources.upload;
    const result = await callAgent("analyze", { title: docTitle, text, question, grade: project.grade, locale });
    setBusy(false);
    if (!result.ok) {
      setError(t.common.agentError);
      return;
    }
    projectStore.update((p) => addDocumentSource(p, documentSource(docTitle, result.data.summary), result.data.keyFindings));
    setDone(t.sources.keyFindings);
    setText("");
    setTitle("");
  }

  return (
    <Card as="section" label={t.sources.upload}>
      <h2 className="mb-1 font-semibold">{t.sources.upload}</h2>
      <p className="mb-3 text-sm text-[var(--ink-muted)]">{t.sources.uploadHelp}</p>
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="doc-file" className="text-sm font-semibold">{t.sources.chooseFile}</label>
          <input id="doc-file" type="file" accept=".txt,.md,text/plain,text/markdown" className="text-sm" onChange={(e) => onFile(e.target.files?.[0])} />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="doc-title" className="text-sm font-semibold">{t.sources.docTitle}</label>
          <input id="doc-title" className={inputClass} value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="doc-text" className="text-sm font-semibold">{t.sources.docText}</label>
          <textarea id="doc-text" className={`${inputClass} min-h-32`} value={text} maxLength={60000} onChange={(e) => setText(e.target.value)} />
        </div>
        <Button onClick={analyze} disabled={busy || text.trim().length < 50}>
          {busy ? <Spinner label={t.sources.analyzing} /> : t.sources.analyze}
        </Button>
        {error ? <Notice tone="error">{error}</Notice> : null}
        {done ? <Notice>{done}</Notice> : null}
      </div>
    </Card>
  );
}
