"use client";

import { useMemo, useState } from "react";
import { Button, Card, Notice, PageTitle, Spinner } from "../../components/ui";
import { RequireProject } from "../../components/shell";
import { citedRefs, type CitationStyle } from "../../lib/citations";
import { buildPaper, paperToText, type Paper } from "../../lib/paper";
import { callAgent } from "../../lib/client/agent";
import { useFlash } from "../../lib/client/hooks";
import { applyFix, checkGrammar, fixAllGrammar as fixGrammarText, checkOriginality, verifyCitations, type CitationProblem, type Issue } from "../../lib/checks";
import { useLocale, useT } from "../../lib/i18n";
import type { Dictionary } from "../../lib/i18n/en";
import { fullDraft, replaceInDrafts, savedSources } from "../../lib/project";
import { projectStore } from "../../lib/store";
import { sentences } from "../../lib/text";
import type { Project, Section } from "../../lib/types";

type Verdict = "supported" | "partial" | "unsupported";
interface ClaimResult {
  id: string;
  /** The sentence as it appears in the draft, citations included. */
  original: string;
  sentence: string;
  verdict: Verdict;
  explanation: string;
}

type FixableProblem = "uncitedClaim" | "weakSupport" | "carefulSource" | "missingSource";
type FixState = { status: "loading" } | { status: "ready"; replacement: string; explanation: string; offline: boolean } | { status: "error" };

interface Feedback {
  overall: string;
  strengths: string[];
  improvements: { section: string; advice: string }[];
  offline: boolean;
}

function isFixable(kind: CitationProblem["kind"]): kind is FixableProblem {
  return kind !== "unusedSource";
}

export default function ReviewPage() {
  return <RequireProject>{(project) => <Review project={project} />}</RequireProject>;
}

function issueText(t: Dictionary, issue: Issue): string {
  const o = issue.original;
  const r = issue.replacement ?? "";
  switch (issue.messageKey) {
    case "misspelling":
      return t.issues.misspelling(o, r);
    case "theirThere":
      return t.issues.theirThere(o, r);
    case "repeatedWord":
      return t.issues.repeatedWord(o, r);
    case "capital":
      return t.issues.capital(o, r);
    case "lowercaseI":
      return t.issues.lowercaseI();
    case "doubleSpace":
      return t.issues.doubleSpace();
    case "longSentence":
      return t.issues.longSentence();
  }
}

function Review({ project }: { project: Project }) {
  const t = useT();
  const locale = useLocale();
  const [style, setStyle] = useState<CitationStyle>("apa");
  const [claims, setClaims] = useState<ClaimResult[] | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [offline, setOffline] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, flashCopied] = useFlash();
  const [fixes, setFixes] = useState<Record<string, FixState>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);

  const draft = fullDraft(project);
  const originality = useMemo(() => checkOriginality(draft, project.sources), [draft, project.sources]);
  const grammar = useMemo(
    () => project.sections.map((s) => ({ section: s, issues: checkGrammar(s.draft, project.grade) })),
    [project.sections, project.grade],
  );
  const problems = useMemo(() => verifyCitations(draft, project.sources, project.notes), [draft, project.sources, project.notes]);
  const saved = savedSources(project);
  const grammarCount = grammar.reduce((n, g) => n + g.issues.length, 0);

  function fix(section: Section, issue: Issue) {
    projectStore.update((p) => ({
      ...p,
      sections: p.sections.map((s) => (s.id === section.id ? { ...s, draft: applyFix(s.draft, issue) } : s)),
    }));
  }

  function fixAllGrammar() {
    projectStore.update((p) => ({
      ...p,
      sections: p.sections.map((s) => ({ ...s, draft: fixGrammarText(s.draft, p.grade) })),
    }));
  }

  function clearFix(key: string) {
    setFixes((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
  }

  async function requestFix(key: string, sentence: string, problem: FixableProblem) {
    setNotice(null);
    setFixes((f) => ({ ...f, [key]: { status: "loading" } }));
    const result = await callAgent("fixClaim", {
      sentence: sentence.slice(0, 1000),
      problem,
      sources: saved.slice(0, 30).flatMap((s) => (s.ref === null ? [] : [{ ref: s.ref, title: s.title.slice(0, 300), summary: s.summary.slice(0, 1500) }])),
      notes: project.notes.slice(0, 40).map((n) => n.text.slice(0, 1000)),
      grade: project.grade,
      locale,
    });
    setFixes((f) => ({
      ...f,
      [key]: result.ok ? { status: "ready", ...result.data, offline: result.mode === "offline" } : { status: "error" },
    }));
  }

  function replaceSentence(original: string, replacement: string, key?: string) {
    const { project: next, replaced } = replaceInDrafts(project, original, replacement);
    if (!replaced) {
      setNotice(t.review.sentenceChanged);
      return;
    }
    projectStore.update(() => next);
    if (key) clearFix(key);
  }

  /** Copied wording becomes an honest quotation with its citation, instead of being reworded to hide it. */
  function quoteSentence(sentence: string, sourceId: string | null) {
    const ref = project.sources.find((s) => s.id === sourceId && s.saved)?.ref;
    if (!ref) return;
    const core = sentence.replace(/\s*\[[\d,\s]+\]/g, "").trim().replace(/[.!?]+$/, "");
    replaceSentence(sentence, `“${core}” [${ref}].`);
  }

  async function getFeedback() {
    setReviewing(true);
    setFeedbackError(null);
    const result = await callAgent("feedback", {
      question: (project.question ?? project.topic).slice(0, 500),
      writingType: project.writingType,
      grade: project.grade,
      locale,
      sections: project.sections.slice(0, 20).map((s) => ({
        title: (s.kind === "intro" ? t.outline.intro : s.kind === "conclusion" ? t.outline.conclusion : s.title).slice(0, 120),
        text: s.draft.slice(0, 8000),
      })),
    });
    setReviewing(false);
    if (!result.ok) {
      setFeedbackError(t.common.agentError);
      return;
    }
    setFeedback({ ...result.data, offline: result.mode === "offline" });
  }

  async function verify() {
    setVerifying(true);
    setError(null);
    const cited = sentences(draft).filter((s) => citedRefs(s.text).length > 0);
    const items = cited.flatMap((s, i) =>
      citedRefs(s.text).map((ref) => {
        const source = project.sources.find((x) => x.ref === ref);
        const evidence = source
          ? [source.summary, source.keyQuote ?? "", ...project.notes.filter((n) => n.sourceId === source.id).map((n) => n.text)].join("\n")
          : "";
        return { id: `${i}-${ref}`, original: s.text, sentence: s.text.replace(/\[[\d,\s]+\]/g, "").trim(), evidence };
      }),
    );
    if (items.length === 0) {
      setVerifying(false);
      setClaims([]);
      return;
    }
    const result = await callAgent("verify", { claims: items.slice(0, 40).map(({ id, sentence, evidence }) => ({ id, sentence, evidence })), locale });
    setVerifying(false);
    if (!result.ok) {
      setError(t.common.agentError);
      return;
    }
    setOffline(result.mode === "offline");
    setClaims(
      result.data.results.map((r) => {
        const item = items.find((i) => i.id === r.id);
        return { ...r, original: item?.original ?? "", sentence: item?.sentence ?? "" };
      }),
    );
  }

  const paper = buildPaper(project, { intro: t.outline.intro, conclusion: t.outline.conclusion, references: t.review.references }, style);

  async function copyText() {
    try {
      await navigator.clipboard.writeText(paperToText(paper));
      flashCopied();
    } catch {
      // Clipboard blocked: the text is still on the page.
    }
  }

  function exportWord() {
    const body = paper.sections
      .map((s) => `<h2>${escapeHtml(s.heading)}</h2>${s.paragraphs.map((p) => `<p>${escapeHtml(p).replace(/\n/g, "<br/>")}</p>`).join("")}`)
      .join("");
    const refs = paper.references.length
      ? `<h2>${escapeHtml(paper.referencesTitle)}</h2>${paper.references.map((r) => `<p>${escapeHtml(r)}</p>`).join("")}`
      : "";
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(paper.title)}</title></head><body><h1>${escapeHtml(paper.title)}</h1>${body}${refs}</body></html>`;
    const url = URL.createObjectURL(new Blob([html], { type: "application/msword" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${project.topic.slice(0, 60).replace(/[^\p{L}\p{N}]+/gu, "_") || "research"}.doc`;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const citationCount = problems.length;
  const usedCount = saved.filter((s) => s.ref !== null && citedRefs(draft).includes(s.ref)).length;
  const originalityOk = originality.score >= 90;
  const toFix = (originalityOk ? 0 : 1) + (grammarCount ? 1 : 0) + (citationCount ? 1 : 0);
  const hasPaper = paper.sections.length > 0;

  const tiles: { id: string; label: string; value: string; ok: boolean }[] = [
    { id: "check-originality", label: t.review.originality, value: `${originality.score}%`, ok: originalityOk },
    { id: "check-grammar", label: t.review.tileGrammar, value: grammarCount ? t.review.toFixCount(grammarCount) : t.review.allClear, ok: grammarCount === 0 },
    { id: "check-citations", label: t.review.tileCitations, value: citationCount ? t.review.toFixCount(citationCount) : t.review.allClear, ok: citationCount === 0 },
    { id: "paper", label: t.review.tileSources, value: t.review.usedOf(usedCount, saved.length), ok: saved.length > 0 && usedCount === saved.length },
  ];

  return (
    <>
    {/* Printing (and "Save as PDF") shows only the paper, never the checks around it. */}
    <PrintablePaper paper={paper} />
    <div className="flex flex-col gap-6 print:hidden">
      <PageTitle
        subtitle={hasPaper ? (toFix === 0 ? `✓ ${t.review.ready}` : t.review.notReady(toFix)) : t.review.paperEmpty}
        actions={
          <>
            <Button onClick={copyText} disabled={!hasPaper}>{copied ? `✓ ${t.review.copied}` : t.review.copyText}</Button>
            <Button onClick={exportWord} disabled={!hasPaper}>⬇️ {t.review.word}</Button>
            <Button variant="primary" onClick={() => window.print()} disabled={!hasPaper}>🖨️ {t.review.pdf}</Button>
          </>
        }
      >
        {t.review.title}
      </PageTitle>

      <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label={t.review.summary}>
        {tiles.map((tile) => (
          <li key={tile.id}>
            <a
              href={`#${tile.id}`}
              className={`flex h-full flex-col gap-1 rounded-2xl border p-4 shadow-[var(--shadow-sm)] transition-colors duration-150 hover:border-[var(--line-strong)] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)] ${
                tile.ok ? "border-[var(--line)] bg-[var(--surface)]" : "border-[var(--warn)] bg-[var(--warn-bg)]"
              }`}
            >
              <span className="flex items-center gap-2 text-sm text-[var(--ink-muted)]">
                <span aria-hidden className={`grid size-5 place-items-center rounded-full text-xs font-bold ${tile.ok ? "bg-[var(--ok-bg)] text-[var(--ok-ink)]" : "bg-[var(--warn)] text-[var(--bg)]"}`}>
                  {tile.ok ? "✓" : "!"}
                </span>
                {tile.label}
              </span>
              <span className="text-xl font-bold tabular-nums">{tile.value}</span>
            </a>
          </li>
        ))}
      </ul>

      {notice ? <Notice tone="warn">{notice}</Notice> : null}

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <section id="paper" aria-label={t.review.yourPaper} className="min-w-0 scroll-mt-4 overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow-md)]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] px-5 py-3">
            <div>
              <h2 className="font-semibold">{t.review.yourPaper}</h2>
              <p className="text-sm text-[var(--ink-muted)]">{t.review.yourPaperHelp}</p>
            </div>
            <div role="group" aria-label={t.review.referenceStyle} className="flex items-center gap-1">
              <span className="mr-1 text-sm text-[var(--ink-muted)]">{t.review.referenceStyle}</span>
              {(["apa", "mla"] as const).map((s) => (
                <Button key={s} aria-pressed={style === s} variant={style === s ? "primary" : "secondary"} className="min-h-9 px-3 text-sm uppercase" onClick={() => setStyle(s)}>
                  {s}
                </Button>
              ))}
            </div>
          </div>
          {hasPaper ? (
            <div className="px-5 py-8 sm:px-10 sm:py-10">
              <PaperView
                paper={paper}
                className="mx-auto max-w-[68ch] font-serif text-[1.05rem] leading-[1.8] [&_h1]:mb-8 [&_h1]:text-center [&_h1]:text-2xl [&_h1]:leading-snug [&_h1]:font-bold sm:[&_h1]:text-3xl [&_h2]:mt-8 [&_h2]:mb-2 [&_h2]:text-lg [&_h2]:font-bold [&_p]:mb-3 [&_p]:whitespace-pre-wrap [&_.references]:mt-10 [&_.references]:border-t [&_.references]:border-[var(--line)] [&_.references]:pt-2 [&_.references_p]:pl-8 [&_.references_p]:-indent-8 [&_.references_p]:text-sm [&_.references_p]:break-words"
              />
            </div>
          ) : (
            <p className="px-5 py-10 text-center text-[var(--ink-muted)]">{t.review.paperEmpty}</p>
          )}
        </section>

        <aside className="flex min-w-0 flex-col gap-4" aria-label={t.review.toFixTitle}>
          <Card as="section" label={t.review.tileCitations} className="scroll-mt-4">
            <h2 id="check-citations" className="mb-2 flex scroll-mt-4 items-center justify-between gap-2 font-semibold">
              {t.review.tileCitations}
              <StatusPill ok={citationCount === 0} text={citationCount ? t.review.toFixCount(citationCount) : t.review.allClear} />
            </h2>
            {problems.length === 0 ? <p className="text-sm text-[var(--ink-muted)]">{t.review.allSupported}</p> : null}
            <ul className="flex flex-col gap-2">
              {problems.map((p, i) => (
                <li key={`${p.kind}-${i}`} className="rounded-lg border border-[var(--line)] p-3 text-sm">
                  <p className="font-medium">{problemText(t, p)}</p>
                  {p.sentence ? <p className="mt-1 text-[var(--ink-muted)]">“{p.sentence}”</p> : null}
                  {p.sentence && isFixable(p.kind) ? (
                    <ProblemFix problem={p.kind} sentence={p.sentence} fixes={fixes} onRequest={requestFix} onApply={replaceSentence} onSkip={clearFix} />
                  ) : null}
                </li>
              ))}
            </ul>
          </Card>

          <Card as="section" label={t.review.tileGrammar}>
            <h2 id="check-grammar" className="mb-2 flex scroll-mt-4 items-center justify-between gap-2 font-semibold">
              {t.review.tileGrammar}
              <StatusPill ok={grammarCount === 0} text={grammarCount ? t.review.toFixCount(grammarCount) : t.review.allClear} />
            </h2>
            {grammarCount === 0 ? <p className="text-sm text-[var(--ink-muted)]">{t.review.noIssues}</p> : null}
            <ul className="flex flex-col gap-2">
              {grammar.flatMap(({ section, issues }) =>
                issues.map((issue) => (
                  <li key={`${section.id}-${issue.id}`} className="flex items-center justify-between gap-3 rounded-lg border border-[var(--line)] p-2 pl-3">
                    <span className="min-w-0 text-sm">{issueText(t, issue)}</span>
                    {issue.replacement !== null ? (
                      <Button className="min-h-9 shrink-0 px-3 text-sm" onClick={() => fix(section, issue)}>{t.review.fix}</Button>
                    ) : null}
                  </li>
                )),
              )}
            </ul>
            {grammar.some(({ issues }) => issues.some((i) => i.replacement !== null)) ? (
              <Button className="mt-3 w-full" onClick={fixAllGrammar}>{t.review.fixAll}</Button>
            ) : null}
          </Card>

          <Card as="section" label={t.review.originality}>
            <h2 id="check-originality" className="mb-2 flex scroll-mt-4 items-center justify-between gap-2 font-semibold">
              {t.review.originality}
              <StatusPill ok={originalityOk} text={`${originality.score}%`} />
            </h2>
            <p className="text-sm text-[var(--ink-muted)]">{originality.flagged.length === 0 ? t.review.ownWords : t.review.tooClose}</p>
            {originality.flagged.length > 0 ? (
              <ul className="mt-3 flex flex-col gap-2 text-sm">
                {originality.flagged.map((f) => (
                  <li key={f.sentence} className="rounded-lg border border-[var(--line)] p-3">
                    <p>{f.sentence}</p>
                    <p className="mt-1 text-[var(--ink-muted)]">{t.review.copiedFrom}</p>
                    {project.sources.some((s) => s.id === f.sourceId && s.saved) ? (
                      <Button className="mt-2 min-h-9 px-3 text-sm" onClick={() => quoteSentence(f.sentence, f.sourceId)}>
                        {t.review.makeQuote}
                      </Button>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : null}
          </Card>

          <Card as="section" label={t.review.feedbackTitle} className="bg-[var(--accent-soft)]">
            <h2 className="font-semibold">✨ {t.review.feedbackTitle}</h2>
            <p className="mb-3 text-sm">{t.review.feedbackHelp}</p>
            <Button variant="primary" onClick={getFeedback} disabled={reviewing || !hasPaper}>
              {reviewing ? <Spinner label={t.review.gettingFeedback} /> : t.review.getFeedback}
            </Button>
            {feedbackError ? <div className="mt-3"><Notice tone="error">{feedbackError}</Notice></div> : null}
            {feedback ? (
              <div className="fade-up mt-4 flex flex-col gap-3">
                {feedback.offline ? <Notice tone="warn">{t.common.offlineHint}</Notice> : null}
                <p>{feedback.overall}</p>
                {feedback.strengths.length ? (
                  <div>
                    <p className="font-semibold">{t.review.strengths}</p>
                    <ul className="list-disc pl-5 text-sm">
                      {feedback.strengths.map((s) => (
                        <li key={s}>{s}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {feedback.improvements.length ? (
                  <div>
                    <p className="font-semibold">{t.review.nextSteps}</p>
                    <ul className="flex flex-col gap-2 text-sm">
                      {feedback.improvements.map((imp) => (
                        <li key={`${imp.section}-${imp.advice}`} className="rounded-lg bg-[var(--surface)] p-2">
                          <span className="font-semibold">{imp.section}:</span> {imp.advice}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            ) : null}
          </Card>

          <Card as="section" label={t.review.verification}>
            <h2 className="font-semibold">{t.review.verification}</h2>
            <p className="mb-3 text-sm text-[var(--ink-muted)]">{t.review.verifyHelp}</p>
            <Button onClick={verify} disabled={verifying || !hasPaper}>
              {verifying ? <Spinner label={t.review.verifying} /> : t.review.runVerify}
            </Button>
            {offline ? <div className="mt-3"><Notice tone="warn">{t.common.offlineHint}</Notice></div> : null}
            {error ? <div className="mt-3"><Notice tone="error">{error}</Notice></div> : null}
            {claims ? (
              claims.length === 0 ? (
                <p className="mt-3">{t.review.noCitations}</p>
              ) : (
                <ul className="fade-up mt-3 flex flex-col gap-2">
                  {claims.map((c) => (
                    <li key={c.id} className="rounded-lg border border-[var(--line)] p-3">
                      <p className="text-sm font-semibold">{t.review.verdict[c.verdict]}</p>
                      <p className="text-sm">{c.sentence}</p>
                      <p className="text-sm text-[var(--ink-muted)]">{c.explanation}</p>
                      {c.verdict !== "supported" && c.original ? (
                        <FixControls
                          state={fixes[`claim:${c.id}`]}
                          original={c.original}
                          onRequest={() => requestFix(`claim:${c.id}`, c.original, "weakSupport")}
                          onApply={(replacement) => replaceSentence(c.original, replacement, `claim:${c.id}`)}
                          onSkip={() => clearFix(`claim:${c.id}`)}
                        />
                      ) : null}
                    </li>
                  ))}
                </ul>
              )
            ) : null}
          </Card>
        </aside>
      </div>
    </div>
    </>
  );
}

function StatusPill({ ok, text }: { ok: boolean; text: string }) {
  return (
    <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold tabular-nums ${ok ? "bg-[var(--ok-bg)] text-[var(--ok-ink)]" : "bg-[var(--warn-bg)] text-[var(--warn-ink)]"}`}>
      {ok ? "✓ " : ""}
      {text}
    </span>
  );
}

function PrintablePaper({ paper }: { paper: Paper }) {
  return <PaperView paper={paper} className="paper hidden print:block" />;
}

function PaperView({ paper, className }: { paper: Paper; className: string }) {
  return (
    <article className={className}>
      <h1>{paper.title}</h1>
      {paper.sections.map((s, i) => (
        <section key={`${i}-${s.heading}`}>
          <h2>{s.heading}</h2>
          {s.paragraphs.map((p, j) => (
            <p key={j}>{p}</p>
          ))}
        </section>
      ))}
      {paper.references.length ? (
        <section className="references">
          <h2>{paper.referencesTitle}</h2>
          {paper.references.map((r) => (
            <p key={r}>{r}</p>
          ))}
        </section>
      ) : null}
    </article>
  );
}

function ProblemFix({
  problem,
  sentence,
  fixes,
  onRequest,
  onApply,
  onSkip,
}: {
  problem: FixableProblem;
  sentence: string;
  fixes: Record<string, FixState>;
  onRequest: (key: string, sentence: string, problem: FixableProblem) => void;
  onApply: (original: string, replacement: string, key: string) => void;
  onSkip: (key: string) => void;
}) {
  const key = `problem:${problem}:${sentence}`;
  return (
    <FixControls
      state={fixes[key]}
      original={sentence}
      onRequest={() => onRequest(key, sentence, problem)}
      onApply={(replacement) => onApply(sentence, replacement, key)}
      onSkip={() => onSkip(key)}
    />
  );
}

function FixControls({
  state,
  original,
  onRequest,
  onApply,
  onSkip,
}: {
  state: FixState | undefined;
  original: string;
  onRequest: () => void;
  onApply: (replacement: string) => void;
  onSkip: () => void;
}) {
  const t = useT();
  if (!state || state.status === "error") {
    return (
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Button className="min-h-9 px-3 text-sm" onClick={onRequest}>✨ {t.review.fixWithAi}</Button>
        {state?.status === "error" ? <span className="text-[var(--danger-ink)]">{t.common.agentError}</span> : null}
      </div>
    );
  }
  if (state.status === "loading") {
    return (
      <div className="mt-2">
        <Spinner label={t.review.fixing} />
      </div>
    );
  }
  const replacement = state.replacement.trim();
  const changed = replacement !== "" && replacement !== original.trim();
  return (
    <div className="mt-2 rounded-lg bg-[var(--surface-2)] p-2">
      {state.offline ? <p className="mb-1 text-xs text-[var(--ink-muted)]">{t.common.offlineMode}</p> : null}
      {changed ? (
        <>
          <p className="text-xs font-semibold">{t.review.suggestedFix}</p>
          <p className="mt-1">{replacement}</p>
        </>
      ) : null}
      <p className="mt-1 text-[var(--ink-muted)]">{state.explanation}</p>
      <div className="mt-2 flex gap-2">
        {changed ? (
          <Button variant="primary" className="min-h-9 px-3 text-sm" onClick={() => onApply(replacement)}>
            {t.review.useFix}
          </Button>
        ) : null}
        <Button className="min-h-9 px-3 text-sm" onClick={onSkip}>
          {t.write.skip}
        </Button>
      </div>
    </div>
  );
}

function problemText(t: Dictionary, p: CitationProblem): string {
  switch (p.kind) {
    case "missingSource":
      return t.citationProblems.missingSource(p.ref);
    case "uncitedClaim":
      return t.citationProblems.uncitedClaim();
    case "unusedSource":
      return t.citationProblems.unusedSource(p.ref);
    case "weakSupport":
      return t.citationProblems.weakSupport(p.ref);
    case "carefulSource":
      return t.citationProblems.carefulSource(p.ref);
  }
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);
}
