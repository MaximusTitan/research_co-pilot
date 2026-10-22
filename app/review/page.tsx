"use client";

import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import { Button, Card, LinkButton, Notice, PageTitle, Spinner } from "../../components/ui";
import { RequireProject } from "../../components/shell";
import { useAuthUser } from "../../components/auth-provider";
import { PaperPages, type PaperPagesMeta } from "../../components/paper-pages";
import { abstractRequest } from "../../lib/client/autopilot";
import { citedRefs, type CitationStyle } from "../../lib/citations";
import { buildPaper, paperToText } from "../../lib/paper";
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
  const [writingAbstract, setWritingAbstract] = useState(false);
  const abstractStarted = useRef(false);
  const user = useAuthUser();

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

  const paperLabels = { abstract: t.review.abstract, keywords: t.review.keywords, intro: t.outline.intro, conclusion: t.outline.conclusion, references: t.review.references };
  const paper = buildPaper(project, paperLabels, style);
  const hasPaper = paper.sections.length > 0;
  const meta: PaperPagesMeta = {
    author: user?.displayName || user?.email?.split("@")[0] || t.review.yourPaper,
    affiliation: `${t.start[project.writingType]} · ${t.start.grades[project.grade]}`,
    date: new Intl.DateTimeFormat(locale === "hi" ? "hi-IN" : "en-US", { dateStyle: "long" }).format(project.updatedAt),
    abstractLabel: t.review.abstract,
    keywordsLabel: t.review.keywords,
    pageLabel: t.review.page,
    lang: locale,
  };

  // Papers written before abstracts existed, or by hand, get one the first time they're opened here.
  const needsAbstract = hasPaper && !project.abstract;
  const writeAbstract = useEffectEvent(async () => {
    setWritingAbstract(true);
    const result = await callAgent("abstract", abstractRequest(project, locale, { intro: t.outline.intro, conclusion: t.outline.conclusion }));
    setWritingAbstract(false);
    if (result.ok) projectStore.update((p) => (p.id === project.id ? { ...p, abstract: result.data.abstract, keywords: result.data.keywords } : p));
  });
  useEffect(() => {
    if (!needsAbstract || abstractStarted.current) return;
    abstractStarted.current = true;
    void writeAbstract();
  }, [needsAbstract]);

  async function copyText() {
    try {
      await navigator.clipboard.writeText(paperToText(paper, paperLabels));
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
    const front = [
      paper.abstract ? `<p><b><i>${escapeHtml(t.review.abstract)}</i>—${escapeHtml(paper.abstract)}</b></p>` : "",
      paper.keywords.length ? `<p><b><i>${escapeHtml(t.review.keywords)}</i>—${escapeHtml(paper.keywords.join(", "))}</b></p>` : "",
    ].join("");
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(paper.title)}</title></head><body><h1>${escapeHtml(paper.title)}</h1><p><i>${escapeHtml(meta.author)}</i><br/>${escapeHtml(meta.affiliation)}<br/>${escapeHtml(meta.date)}</p>${front}${body}${refs}</body></html>`;
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
  const checks: { id: string; label: string; value: string; ok: boolean }[] = [
    { id: "check-citations", label: t.review.tileCitations, value: citationCount ? t.review.toFixCount(citationCount) : t.review.allClear, ok: citationCount === 0 },
    { id: "check-grammar", label: t.review.tileGrammar, value: grammarCount ? t.review.toFixCount(grammarCount) : t.review.allClear, ok: grammarCount === 0 },
    { id: "check-originality", label: t.review.originality, value: `${originality.score}%`, ok: originalityOk },
    { id: "check-sources", label: t.review.tileSources, value: t.review.usedOf(usedCount, saved.length), ok: saved.length > 0 && usedCount === saved.length },
  ];
  const wordCount = paper.sections.reduce((n, s) => n + s.paragraphs.join(" ").split(/\s+/).filter(Boolean).length, 0);
  const tocLink =
    "flex gap-2 rounded-md px-2 py-1.5 text-[var(--ink-muted)] transition-colors duration-150 hover:bg-[var(--surface-2)] hover:text-[var(--ink)] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)]";

  return (
    <>
    {/* Printing (and "Save as PDF") shows only the paper pages, never the checks around them. */}
    <div className="flex flex-col gap-6 print:block">
      <div className="print:hidden">
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
        {t.review.paperTitle}
      </PageTitle>
      </div>

      {notice ? <div className="print:hidden"><Notice tone="warn">{notice}</Notice></div> : null}

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] print:block">
        <section id="paper" aria-label={t.review.yourPaper} className="min-w-0 scroll-mt-4 rounded-2xl bg-[var(--desk)] p-2 sm:p-6 print:rounded-none print:bg-transparent print:p-0">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3 px-1 print:hidden">
            <p className="text-sm tabular-nums text-[var(--ink-muted)]">
              {hasPaper
                ? [
                    t.review.words(wordCount),
                    t.review.readTime(Math.max(1, Math.round(wordCount / 200))),
                    t.review.sectionsCount(paper.sections.length),
                    t.review.sourcesCount(paper.references.length),
                  ].join(" · ")
                : t.review.yourPaperHelp}
              {writingAbstract ? ` · ${t.generate.stages.abstract}…` : ""}
            </p>
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
            <PaperPages paper={paper} meta={meta} />
          ) : (
            <div className="paper-sheet flex flex-col items-center gap-4 text-center">
              <p>{t.review.paperEmpty}</p>
              <LinkButton href="/generate">✨ {t.review.writeWithAi}</LinkButton>
            </div>
          )}
        </section>

        <aside className="flex min-w-0 flex-col gap-4 print:hidden" aria-label={t.review.toFixTitle}>
          {hasPaper ? (
            <Card as="section" label={t.review.contents}>
              <h2 className="mb-2 font-semibold">{t.review.contents}</h2>
              <ol className="flex flex-col gap-0.5 text-sm">
                {paper.sections.map((s, i) => (
                  <li key={`${i}-${s.heading}`}>
                    <a href={`#paper-section-${i}`} className={tocLink}>
                      <span className="w-5 shrink-0 tabular-nums">{i + 1}.</span>
                      <span className="min-w-0">{s.heading}</span>
                    </a>
                  </li>
                ))}
                {paper.references.length ? (
                  <li>
                    <a href="#paper-references" className={tocLink}>
                      <span aria-hidden className="w-5 shrink-0" />
                      <span>{paper.referencesTitle}</span>
                    </a>
                  </li>
                ) : null}
              </ol>
            </Card>
          ) : null}

          <Card as="section" label={t.review.checksTitle}>
            <h2 className="mb-1 flex items-center justify-between gap-2 font-semibold">
              {t.review.checksTitle}
              {hasPaper && toFix === 0 ? <StatusPill ok text={t.review.allChecksPass} /> : null}
            </h2>
            <div className="flex flex-col divide-y divide-[var(--line)]">
              {checks.map((c) => (
                <details key={c.id} id={c.id} className="group scroll-mt-4 py-1">
                  <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 rounded-md text-sm focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)] [&::-webkit-details-marker]:hidden">
                    <span className="flex items-center gap-2">
                      <span aria-hidden className="inline-block w-2 text-[var(--ink-muted)] transition-transform duration-150 group-open:rotate-90">›</span>
                      {c.label}
                    </span>
                    <StatusPill ok={c.ok} text={c.value} />
                  </summary>
                  <div className="pb-2 pl-4">
                    {c.id === "check-citations" ? (
                      <>
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
                      </>
                    ) : null}
                    {c.id === "check-grammar" ? (
                      <>
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
                      </>
                    ) : null}
                    {c.id === "check-originality" ? (
                      <>
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
                      </>
                    ) : null}
                    {c.id === "check-sources" ? (
                      <ul className="flex flex-col gap-1 text-sm">
                        {saved.length === 0 ? <li className="text-[var(--ink-muted)]">{t.review.noSources}</li> : null}
                        {saved.map((s) => (
                          <li key={s.id} className="flex gap-2">
                            <span className="shrink-0 tabular-nums text-[var(--ink-muted)]">[{s.ref}]</span>
                            <span className="min-w-0">{s.title}</span>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                </details>
              ))}
            </div>
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

          <Card as="section" label={t.review.fineTune}>
            <h2 className="font-semibold">{t.review.fineTune}</h2>
            <p className="mb-3 text-sm text-[var(--ink-muted)]">{t.review.fineTuneHelp}</p>
            <div className="flex flex-wrap gap-2">
              <LinkButton href="/write" variant="secondary">✎ {t.review.editText}</LinkButton>
              <LinkButton href="/sources" variant="secondary">{t.review.editSources}</LinkButton>
              <LinkButton href="/outline" variant="secondary">{t.review.editOutline}</LinkButton>
            </div>
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
