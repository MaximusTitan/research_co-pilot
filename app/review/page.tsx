"use client";

import { useMemo, useState } from "react";
import { Button, Card, Notice, PageTitle, Spinner } from "../../components/ui";
import { RequireProject } from "../../components/shell";
import { citedRefs, formatCitation, type CitationStyle } from "../../lib/citations";
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
  const originality = useMemo(() => checkOriginality(draft, project.sources, project.notes), [draft, project.sources, project.notes]);
  const grammar = useMemo(
    () => project.sections.map((s) => ({ section: s, issues: checkGrammar(s.draft, project.grade) })),
    [project.sections, project.grade],
  );
  const problems = useMemo(() => verifyCitations(draft, project.sources, project.notes), [draft, project.sources, project.notes]);
  const saved = savedSources(project);
  const grammarCount = grammar.reduce((n, g) => n + g.issues.length, 0);
  const citedCount = citedRefs(draft).length;

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

  async function copyText() {
    try {
      await navigator.clipboard.writeText(draft);
      flashCopied();
    } catch {
      // Clipboard blocked: the text is still on the page.
    }
  }

  function exportWord() {
    const body = project.sections
      .filter((s) => s.draft.trim())
      .map((s) => `<h2>${escapeHtml(s.kind === "intro" ? t.outline.intro : s.kind === "conclusion" ? t.outline.conclusion : s.title)}</h2>${escapeHtml(s.draft.trim())
        .split(/\n{2,}/)
        .map((p) => `<p>${p.replace(/\n/g, "<br/>")}</p>`)
        .join("")}`)
      .join("");
    const refs = saved
      .filter((s) => s.ref !== null)
      .map((s) => `<p>${escapeHtml(formatCitation(s, style))}</p>`)
      .join("");
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(project.topic)}</title></head><body><h1>${escapeHtml(project.topic)}</h1>${body}<h2>${escapeHtml(t.review.references)}</h2>${refs}</body></html>`;
    const url = URL.createObjectURL(new Blob([html], { type: "application/msword" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${project.topic.slice(0, 60).replace(/[^\p{L}\p{N}]+/gu, "_") || "research"}.doc`;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const checks = [
    { ok: citedCount > 0 && problems.every((p) => p.kind !== "missingSource"), label: t.review.checklist.cited },
    { ok: grammarCount === 0, label: t.review.checklist.grammar },
    { ok: originality.score >= 90, label: t.review.checklist.originality },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageTitle actions={<Button onClick={() => window.print()}>🖨️ {t.review.pdf}</Button>}>{t.review.title}</PageTitle>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-4">
          <Card as="section" label={t.review.originality} className={originality.score >= 90 ? "bg-[var(--ok-bg)]" : "bg-[var(--warn-bg)]"}>
            <h2 className="font-semibold">{t.review.originality}</h2>
            <p className="my-2 text-center text-5xl font-extrabold tabular-nums" aria-label={`${originality.score}%`}>{originality.score}%</p>
            <p className="text-center text-sm">{originality.flagged.length === 0 ? t.review.ownWords : t.review.tooClose}</p>
            {originality.flagged.length > 0 ? (
              <ul className="mt-3 flex flex-col gap-2 text-sm">
                {originality.flagged.map((f) => (
                  <li key={f.sentence} className="rounded-lg bg-[var(--surface)] p-2">
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
            <p className="mt-3 text-sm text-[var(--ink-muted)]">{t.review.sentencesToCheck(originality.flagged.length)}</p>
          </Card>

          <Card as="section" label={t.review.grammar(grammarCount)}>
            <div className="mb-2 flex items-center justify-between gap-2">
              <h2 className="font-semibold">{t.review.grammar(grammarCount)}</h2>
              {grammar.some(({ issues }) => issues.some((i) => i.replacement !== null)) ? (
                <Button className="min-h-9 px-3 text-sm" onClick={fixAllGrammar}>{t.review.fixAll}</Button>
              ) : null}
            </div>
            {grammarCount === 0 ? <p>{t.review.noIssues}</p> : null}
            <ul className="flex flex-col gap-3">
              {grammar.flatMap(({ section, issues }) =>
                issues.map((issue) => (
                  <li key={`${section.id}-${issue.id}`} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--line)] p-2">
                    <span className="text-sm">{issueText(t, issue)}</span>
                    {issue.replacement !== null ? (
                      <Button className="min-h-9 px-3 text-sm" onClick={() => fix(section, issue)}>{t.review.fix}</Button>
                    ) : null}
                  </li>
                )),
              )}
            </ul>
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          <Card as="section" label={t.review.feedbackTitle} className="bg-[var(--accent-soft)]">
            <h2 className="font-semibold">✨ {t.review.feedbackTitle}</h2>
            <p className="mb-3 text-sm">{t.review.feedbackHelp}</p>
            <Button variant="primary" onClick={getFeedback} disabled={reviewing || !draft.trim()}>
              {reviewing ? <Spinner label={t.review.gettingFeedback} /> : t.review.getFeedback}
            </Button>
            {feedbackError ? <div className="mt-3"><Notice tone="error">{feedbackError}</Notice></div> : null}
            {feedback ? (
              <div className="mt-4 flex flex-col gap-3">
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

          {notice ? <Notice tone="warn">{notice}</Notice> : null}

          <Card as="section" label={t.review.verification}>
            <h2 className="font-semibold">{t.review.verification}</h2>
            <p className="mb-3 text-sm text-[var(--ink-muted)]">{t.review.verifyHelp}</p>
            <Button onClick={verify} disabled={verifying}>
              {verifying ? <Spinner label={t.review.verifying} /> : t.review.runVerify}
            </Button>
            {offline ? <div className="mt-3"><Notice tone="warn">{t.common.offlineHint}</Notice></div> : null}
            {error ? <div className="mt-3"><Notice tone="error">{error}</Notice></div> : null}
            {claims ? (
              claims.length === 0 ? (
                <p className="mt-3">{t.review.noCitations}</p>
              ) : (
                <ul className="mt-3 flex flex-col gap-2">
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

          <Card as="section" label={t.review.checklist.cited}>
            <h2 className="mb-2 font-semibold">{t.review.checklist.cited}</h2>
            <ul className="flex flex-col gap-2">
              {problems.map((p, i) => (
                <li key={`${p.kind}-${i}`} className="rounded-lg border border-[var(--line)] p-2 text-sm">
                  {problemText(t, p)}
                  {p.sentence ? <span className="mt-1 block text-[var(--ink-muted)]">“{p.sentence}”</span> : null}
                  {p.sentence && isFixable(p.kind) ? (
                    <ProblemFix problem={p.kind} sentence={p.sentence} fixes={fixes} onRequest={requestFix} onApply={replaceSentence} onSkip={clearFix} />
                  ) : null}
                </li>
              ))}
            </ul>
            {problems.length === 0 ? <p className="text-sm">{t.review.allSupported}</p> : null}
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          <Card as="section" label={t.review.bibliography}>
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="font-semibold">{t.review.bibliography}</h2>
              <div role="group" aria-label={t.review.bibliography} className="flex gap-1">
                {(["apa", "mla"] as const).map((s) => (
                  <Button key={s} aria-pressed={style === s} variant={style === s ? "primary" : "secondary"} className="min-h-9 px-3 text-sm uppercase" onClick={() => setStyle(s)}>
                    {s}
                  </Button>
                ))}
              </div>
            </div>
            {saved.length === 0 ? <p className="text-sm">{t.review.noSources}</p> : null}
            <ol className="flex flex-col gap-2 text-sm">
              {saved.map((s) => (
                <li key={s.id} className="rounded-lg bg-[var(--surface-2)] p-2">
                  <span className="font-semibold">[{s.ref}]</span> {formatCitation(s, style)}
                </li>
              ))}
            </ol>
          </Card>

          <Card as="section" label={t.review.export}>
            <h2 className="mb-2 font-semibold">{t.review.export}</h2>
            <div className="flex flex-col gap-2">
              <Button onClick={exportWord} disabled={!draft.trim()}>⬇️ {t.review.word}</Button>
              <Button onClick={() => window.print()} disabled={!draft.trim()}>🖨️ {t.review.pdf}</Button>
              <Button onClick={copyText} disabled={!draft.trim()}>{copied ? t.review.copied : t.review.copyText}</Button>
            </div>
            <ul className="mt-4 flex flex-col gap-1 text-sm">
              {checks.map((c) => (
                <li key={c.label} className={c.ok ? "" : "text-[var(--ink-muted)]"}>
                  <span aria-hidden>{c.ok ? "✓" : "○"}</span> <span className="sr-only">{c.ok ? "" : "not yet: "}</span>
                  {c.label}
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </div>
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
