"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Button, inputClass, Notice, Spinner } from "./ui";
import { VoiceButton } from "./voice-button";
import { callAgent } from "../lib/client/agent";
import { useLocale, useT } from "../lib/i18n";
import type { Brief, GradeBand, PaperLength, SourceMix, WritingType } from "../lib/types";

/** The AI asks at most this many of its own questions before the fixed ones. */
const MAX_AI_QUESTIONS = 6;
const FIXED = ["length", "sources", "style"] as const;
type Fixed = (typeof FIXED)[number];
type Phase = "ai" | Fixed | "review";

interface Option {
  label: string;
  hint: string;
}
interface Asked {
  question: string;
  options: Option[];
}
interface Answered extends Asked {
  answer: string;
}

export interface InterviewResult {
  question: string;
  brief: Brief;
}

/**
 * The adaptive interview on Start: the AI asks one multiple-choice question at
 * a time, each built on the answers so far, then three quick fixed questions
 * (length, sources, citation style) and a summary the student can change.
 */
export function Interview({
  topic,
  writingType,
  grade,
  onBack,
  onFinish,
  busy,
}: {
  topic: string;
  writingType: WritingType;
  grade: GradeBand;
  onBack: () => void;
  onFinish: (result: InterviewResult) => void;
  busy: boolean;
}) {
  const t = useT();
  const locale = useLocale();
  const [phase, setPhase] = useState<Phase>("ai");
  const [answers, setAnswers] = useState<Answered[]>([]);
  const [current, setCurrent] = useState<Asked | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "failed">("loading");
  const [researchQuestion, setResearchQuestion] = useState("");
  const [length, setLength] = useState<PaperLength>("standard");
  const [sources, setSources] = useState<SourceMix>("mix");
  const [sourcesText, setSourcesText] = useState("");
  const [style, setStyle] = useState<Brief["style"]>("apa");
  const [extra, setExtra] = useState("");
  /** Set when a fixed answer is changed from the summary, so picking returns there. */
  const [backToReview, setBackToReview] = useState(false);
  const started = useRef(false);
  const request = useRef(0);

  async function ask(list: Answered[], max = MAX_AI_QUESTIONS) {
    const id = ++request.current;
    setStatus("loading");
    setCurrent(null);
    const result = await callAgent("interview", {
      topic,
      writingType,
      grade,
      locale,
      answers: list.map(({ question, answer }) => ({ question: question.slice(0, 300), answer: answer.slice(0, 300) })),
      maxQuestions: max,
    });
    if (id !== request.current) return; // The student went back meanwhile.
    if (!result.ok) {
      setStatus("failed");
      return;
    }
    setStatus("ready");
    if (result.data.done) {
      setResearchQuestion(result.data.researchQuestion);
      setPhase(backToReview ? "review" : "length");
      setBackToReview(false);
    } else {
      setCurrent({ question: result.data.question, options: result.data.options });
    }
  }

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void ask([]);
    // Runs once for this topic; Start remounts the interview when the topic changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function answer(text: string) {
    if (!current || !text.trim()) return;
    const list = [...answers, { ...current, answer: text.trim() }];
    setAnswers(list);
    void ask(list);
  }

  /** Re-opens an earlier AI question; the questions after it depended on its answer, so they go. */
  function reopen(index: number) {
    request.current++;
    const target = answers[index];
    setAnswers(answers.slice(0, index));
    setCurrent({ question: target.question, options: target.options });
    setStatus("ready");
    setPhase("ai");
  }

  function back() {
    if (phase === "ai") {
      if (answers.length === 0) onBack();
      else reopen(answers.length - 1);
      return;
    }
    if (phase === "length") {
      if (answers.length) reopen(answers.length - 1);
      else onBack();
      return;
    }
    const order: Phase[] = ["length", "sources", "style", "review"];
    setPhase(order[order.indexOf(phase) - 1]);
  }

  function pickFixed(next: () => void) {
    next();
    if (backToReview || phase === "style") {
      setBackToReview(false);
      setPhase("review");
    } else {
      setPhase(FIXED[FIXED.indexOf(phase as Fixed) + 1]);
    }
  }

  function finish() {
    onFinish({
      question: researchQuestion.trim() || topic,
      brief: {
        length,
        approach: "custom",
        approachText: "",
        sources,
        sourcesText: sourcesText.trim(),
        style,
        extra: extra.trim(),
        interview: answers.map(({ question, answer }) => ({ question, answer })),
      },
    });
  }

  // Progress: AI questions so far, then the three fixed ones.
  const stepNumber = phase === "ai" ? answers.length + 1 : phase === "review" ? 0 : answers.length + FIXED.indexOf(phase) + 1;
  const estimatedTotal = Math.max(answers.length + (phase === "ai" ? 1 : 0), 4) + FIXED.length;
  const progress = phase === "review" ? 1 : Math.min(0.95, (stepNumber - 1) / estimatedTotal);

  const lengthOptions: Option[] = [
    { label: t.start.lengths.short, hint: t.start.lengths.shortHint },
    { label: t.start.lengths.standard, hint: t.start.lengths.standardHint },
    { label: t.start.lengths.long, hint: t.start.lengths.longHint },
  ];
  const lengths: PaperLength[] = ["short", "standard", "long"];
  const sourceValues: Exclude<SourceMix, "custom">[] = ["studies", "official", "mix"];
  const sourceOptions: Option[] = [
    { label: t.start.sourceMixes.studies, hint: t.start.sourceMixes.studiesHint },
    { label: t.start.sourceMixes.official, hint: t.start.sourceMixes.officialHint },
    { label: t.start.sourceMixes.mix, hint: t.start.sourceMixes.mixHint },
  ];
  const styles: Brief["style"][] = ["apa", "mla", "ieee"];
  const styleOptions: Option[] = [
    { label: "APA", hint: "(Smith, 2020)" },
    { label: "MLA", hint: "(Smith)" },
    { label: "IEEE", hint: "[1]" },
  ];
  const sourceLabel = sources === "custom" ? sourcesText : sourceOptions[sourceValues.indexOf(sources)].label;

  return (
    <div className="flex flex-col gap-5">
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{phase === "review" ? t.interview.reviewTitle : t.interview.title}</h1>
        <p className="mt-2 text-[var(--ink-muted)]">{phase === "review" ? t.interview.reviewSubtitle : t.interview.subtitle}</p>
        <p className="mx-auto mt-4 inline-flex max-w-full items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--surface)] px-4 py-1.5 text-sm shadow-[var(--shadow-sm)]">
          <span className="truncate font-semibold">{topic}</span>
          <span className="shrink-0 text-[var(--ink-muted)]">· {t.start[writingType]} · {t.start.grades[grade]}</span>
        </p>
      </div>

      <div
        role="progressbar"
        aria-label={t.interview.progress}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress * 100)}
        className="h-1.5 overflow-hidden rounded-full bg-[var(--surface-2)]"
      >
        <div className="h-full rounded-full bg-[var(--accent)] transition-[width] duration-500 ease-out" style={{ width: `${Math.max(4, progress * 100)}%` }} />
      </div>

      {phase === "ai" ? (
        <QuestionCard
          key={`ai-${answers.length}-${current?.question ?? "loading"}`}
          n={stepNumber}
          question={current?.question}
          loading={status === "loading"}
          failed={status === "failed"}
          onRetry={() => void ask(answers)}
          options={current?.options ?? []}
          onPick={(o) => answer(o.label)}
          own={{ placeholder: t.interview.ownPlaceholder, onSubmit: answer }}
          footer={
            answers.length >= 2 && status === "ready" ? (
              <button
                type="button"
                onClick={() => void ask(answers, Math.max(2, answers.length))}
                className="text-sm text-[var(--ink-muted)] underline underline-offset-4 hover:text-[var(--ink)] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)]"
              >
                {t.interview.enough} →
              </button>
            ) : null
          }
        />
      ) : null}

      {phase === "length" ? (
        <QuestionCard
          key="length"
          n={stepNumber}
          question={t.start.lengthLabel}
          options={lengthOptions}
          selected={lengthOptions[lengths.indexOf(length)].label}
          onPick={(o) => pickFixed(() => setLength(lengths[lengthOptions.indexOf(o)]))}
        />
      ) : null}

      {phase === "sources" ? (
        <QuestionCard
          key="sources"
          n={stepNumber}
          question={t.start.sourcesLabel}
          options={sourceOptions}
          selected={sources === "custom" ? undefined : sourceOptions[sourceValues.indexOf(sources)].label}
          onPick={(o) => pickFixed(() => setSources(sourceValues[sourceOptions.indexOf(o)]))}
          own={{
            placeholder: t.start.ownSourcesPlaceholder,
            onSubmit: (text) =>
              pickFixed(() => {
                setSources("custom");
                setSourcesText(text);
              }),
          }}
        />
      ) : null}

      {phase === "style" ? (
        <QuestionCard
          key="style"
          n={stepNumber}
          question={t.start.styleLabel}
          help={t.start.styleHint}
          options={styleOptions}
          selected={styleOptions[styles.indexOf(style)].label}
          onPick={(o) => pickFixed(() => setStyle(styles[styleOptions.indexOf(o)]))}
          mono
        />
      ) : null}

      {phase === "review" ? (
        <div className="fade-up flex flex-col gap-4">
          <div className="rounded-2xl border-2 border-[var(--accent)] bg-[var(--accent-soft)] p-5">
            <label htmlFor="research-question" className="text-sm font-semibold text-[var(--accent-ink)]">
              🎯 {t.interview.researchQuestion}
            </label>
            <textarea
              id="research-question"
              className={`${inputClass} mt-2 min-h-16 resize-y text-lg font-semibold`}
              value={researchQuestion}
              maxLength={300}
              onChange={(e) => setResearchQuestion(e.target.value)}
            />
          </div>

          <ul className="flex flex-col divide-y divide-[var(--line)] rounded-2xl border border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow-sm)]">
            {answers.map((a, i) => (
              <SummaryRow key={`${i}-${a.question}`} question={a.question} answer={a.answer} onChange={() => (setBackToReview(true), reopen(i))} />
            ))}
            <SummaryRow question={t.start.lengthLabel} answer={lengthOptions[lengths.indexOf(length)].label} onChange={() => (setBackToReview(true), setPhase("length"))} />
            <SummaryRow question={t.start.sourcesLabel} answer={sourceLabel} onChange={() => (setBackToReview(true), setPhase("sources"))} />
            <SummaryRow question={t.start.styleLabel} answer={style.toUpperCase()} onChange={() => (setBackToReview(true), setPhase("style"))} />
          </ul>

          <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 shadow-[var(--shadow-sm)]">
            <label htmlFor="extra" className="font-semibold">
              {t.start.extraLabel}
              <span className="ml-2 rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-xs font-medium text-[var(--ink-muted)]">{t.start.optional}</span>
            </label>
            <div className="mt-2 flex items-start gap-2">
              <textarea
                id="extra"
                className={`${inputClass} min-h-20 resize-y`}
                value={extra}
                maxLength={600}
                placeholder={t.start.extraPlaceholder}
                onChange={(e) => setExtra(e.target.value)}
              />
              <VoiceButton onText={(text) => setExtra((prev) => (prev ? `${prev} ${text}` : text))} />
            </div>
          </div>
        </div>
      ) : null}

      <div className="sticky bottom-0 z-10 -mx-4 flex items-center justify-between gap-3 border-t border-[var(--line)] bg-[var(--bg)]/90 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-2xl sm:border sm:bg-[var(--surface)]/90 sm:shadow-[var(--shadow-md)]">
        <Button variant="ghost" onClick={back} disabled={busy}>
          ← {t.start.back}
        </Button>
        {phase === "review" ? (
          <Button variant="primary" onClick={finish} disabled={busy || !researchQuestion.trim()} className="min-w-48">
            {busy ? <Spinner label={t.refine.thinking} /> : `✨ ${t.start.submit} →`}
          </Button>
        ) : (
          <span className="text-sm text-[var(--ink-muted)] tabular-nums">{t.interview.questionN(stepNumber)}</span>
        )}
      </div>
    </div>
  );
}

function QuestionCard({
  n,
  question,
  help,
  options,
  selected,
  onPick,
  own,
  loading = false,
  failed = false,
  onRetry,
  footer,
  mono = false,
}: {
  n: number;
  question?: string;
  help?: string;
  options: Option[];
  selected?: string;
  onPick: (option: Option) => void;
  own?: { placeholder: string; onSubmit: (text: string) => void };
  loading?: boolean;
  failed?: boolean;
  onRetry?: () => void;
  footer?: ReactNode;
  mono?: boolean;
}) {
  const t = useT();
  const [typing, setTyping] = useState(false);
  const [text, setText] = useState("");

  return (
    <section aria-live="polite" className="fade-up rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 shadow-[var(--shadow-md)] sm:p-6">
      <p className="text-sm font-semibold text-[var(--accent-ink)]">{t.interview.questionN(n)}</p>
      {loading ? (
        <div className="mt-3 flex flex-col gap-3">
          <Spinner label={t.interview.thinking} />
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-[var(--surface-2)] motion-reduce:animate-none" />
          ))}
        </div>
      ) : failed ? (
        <div className="mt-3 flex flex-col items-start gap-3">
          <Notice tone="error">{t.interview.failed}</Notice>
          <Button variant="primary" onClick={onRetry}>{t.common.tryAgain}</Button>
        </div>
      ) : (
        <>
          <h2 className="mt-1 text-xl font-bold sm:text-2xl">{question}</h2>
          {help ? <p className="mt-1 text-sm text-[var(--ink-muted)]">{help}</p> : null}
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {options.map((o, i) => {
              const isSelected = selected === o.label;
              return (
                <button
                  key={o.label}
                  type="button"
                  onClick={() => onPick(o)}
                  aria-pressed={selected !== undefined ? isSelected : undefined}
                  className={`group flex min-h-16 items-start gap-3 rounded-xl border-2 p-3 text-left transition-[background-color,border-color,box-shadow,scale] duration-150 active:scale-[0.98] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)] ${
                    isSelected ? "border-[var(--accent)] bg-[var(--accent-soft)]" : "border-[var(--line)] bg-[var(--surface)] hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]"
                  }`}
                >
                  <span
                    aria-hidden
                    className={`grid size-7 shrink-0 place-items-center rounded-lg text-sm font-bold transition-colors ${
                      isSelected ? "bg-[var(--accent)] text-[var(--accent-fg)]" : "bg-[var(--surface-2)] text-[var(--ink-muted)] group-hover:bg-[var(--accent)] group-hover:text-[var(--accent-fg)]"
                    }`}
                  >
                    {String.fromCharCode(65 + i)}
                  </span>
                  <span className="flex min-w-0 flex-col">
                    <span className="font-semibold">{o.label}</span>
                    {o.hint ? <span className={`text-sm text-[var(--ink-muted)] ${mono ? "font-mono" : ""}`}>{o.hint}</span> : null}
                  </span>
                </button>
              );
            })}
          </div>

          {own ? (
            typing ? (
              <form
                className="fade-up mt-3 flex items-center gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (text.trim()) own.onSubmit(text.trim());
                }}
              >
                <input aria-label={own.placeholder} className={inputClass} value={text} maxLength={300} placeholder={own.placeholder} onChange={(e) => setText(e.target.value)} autoFocus />
                <VoiceButton onText={(spoken) => setText((prev) => (prev ? `${prev} ${spoken}` : spoken))} />
                <Button type="submit" variant="primary" disabled={!text.trim()}>
                  {t.interview.continue}
                </Button>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setTyping(true)}
                className="mt-3 flex min-h-11 w-full items-center gap-3 rounded-xl border-2 border-dashed border-[var(--line-strong)] px-3 text-left text-[var(--ink-muted)] transition-colors hover:border-[var(--accent)] hover:text-[var(--ink)] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)]"
              >
                <span aria-hidden>✏️</span> {t.interview.typeOwn}
              </button>
            )
          ) : null}
          {footer ? <div className="mt-4 text-center">{footer}</div> : null}
        </>
      )}
    </section>
  );
}

function SummaryRow({ question, answer, onChange }: { question: string; answer: string; onChange: () => void }) {
  const t = useT();
  return (
    <li className="flex items-start justify-between gap-3 px-5 py-3">
      <div className="min-w-0">
        <p className="text-sm text-[var(--ink-muted)]">{question}</p>
        <p className="font-semibold">{answer}</p>
      </div>
      <Button variant="ghost" className="min-h-9 shrink-0 px-3 text-sm" onClick={onChange}>
        {t.interview.change}
      </Button>
    </li>
  );
}
