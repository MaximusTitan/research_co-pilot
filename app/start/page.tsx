"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Interview, type InterviewResult } from "../../components/interview";
import { Button, Card, Field, inputClass, Notice } from "../../components/ui";
import { VoiceButton } from "../../components/voice-button";
import { useT } from "../../lib/i18n";
import { createProject, setQuestion } from "../../lib/project";
import { projectStore } from "../../lib/store";
import type { GradeBand, WritingType } from "../../lib/types";
import { GRADES } from "../../lib/writing";

const WRITING: { value: WritingType; key: "essay" | "report" | "paper"; hint: "essayHint" | "reportHint" | "paperHint"; icon: string }[] = [
  { value: "essay", key: "essay", hint: "essayHint", icon: "✍️" },
  { value: "report", key: "report", hint: "reportHint", icon: "📊" },
  { value: "paper", key: "paper", hint: "paperHint", icon: "🔬" },
];



export default function StartPage() {
  const t = useT();
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [topic, setTopic] = useState("");
  const [writingType, setWritingType] = useState<WritingType>("report");
  const [grade, setGrade] = useState<GradeBand>("7-8");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const top = useRef<HTMLDivElement>(null);

  // A new topic, type or level starts the interview over.
  const planKey = `${topic.trim()}|${writingType}|${grade}`;

  useEffect(() => {
    top.current?.scrollIntoView({ block: "start" });
  }, [step]);

  function next(e: React.FormEvent) {
    e.preventDefault();
    if (topic.trim().length < 5) {
      setError(t.start.topicTooShort);
      return;
    }
    setError(null);
    setStep(2);
  }

  function start({ question, brief }: InterviewResult) {
    setBusy(true);
    const project = createProject({ topic, writingType, grade, introTitle: t.outline.intro, conclusionTitle: t.outline.conclusion });
    projectStore.add(setQuestion({ ...project, brief }, question, null));
    router.push("/generate");
  }

  return (
    <div ref={top} className="mx-auto max-w-3xl scroll-mt-6">
      <Steps step={step} onBack={() => setStep(1)} />

      {step === 1 ? (
        <>
          <h1 className="mb-6 text-center text-3xl font-bold tracking-tight sm:text-4xl">{t.start.title}</h1>
          <form onSubmit={next} className="flex flex-col gap-6">
            <Card>
              <Field id="topic" label={t.start.topicLabel} help={t.start.topicHelp}>
                <div className="flex items-center gap-2">
                  <input
                    id="topic"
                    className={inputClass}
                    value={topic}
                    placeholder={t.start.topicPlaceholder}
                    onChange={(e) => setTopic(e.target.value)}
                    autoComplete="off"
                    maxLength={500}
                    required
                  />
                  <VoiceButton onText={(text) => setTopic((prev) => (prev ? `${prev} ${text}` : text))} />
                </div>
              </Field>
            </Card>

            <fieldset className="flex flex-col gap-3">
              <legend className="mb-2 font-semibold">{t.start.writingLabel}</legend>
              <div className="grid gap-3 sm:grid-cols-3">
                {WRITING.map((w) => (
                  <Tile key={w.value} name="writing" checked={writingType === w.value} onSelect={() => setWritingType(w.value)} icon={w.icon} label={t.start[w.key]} hint={t.start[w.hint]} centered />
                ))}
              </div>
            </fieldset>

            <fieldset className="flex flex-col gap-3">
              <legend className="mb-2 font-semibold">{t.start.gradeLabel}</legend>
              <div className="flex flex-wrap gap-2">
                {GRADES.map((g) => {
                  const selected = grade === g;
                  return (
                    <label
                      key={g}
                      className={`cursor-pointer rounded-lg border-2 px-4 py-2 transition-colors duration-150 focus-within:outline-3 focus-within:outline-offset-2 focus-within:outline-[var(--focus)] ${
                        selected ? "border-[var(--accent)] bg-[var(--accent-soft)] font-semibold" : "border-[var(--line)] bg-[var(--surface)] hover:bg-[var(--surface-2)]"
                      }`}
                    >
                      <input type="radio" name="grade" value={g} checked={selected} onChange={() => setGrade(g)} className="sr-only" />
                      {t.start.grades[g]}
                    </label>
                  );
                })}
              </div>
            </fieldset>

            {error ? <Notice tone="error">{error}</Notice> : null}

            <div className="flex flex-col items-center gap-3">
              <p className="max-w-md text-center text-sm text-[var(--ink-muted)]">✨ {t.start.aiNote}</p>
              <Button type="submit" variant="primary" className="min-w-64">
                {t.start.next} →
              </Button>
            </div>
          </form>
        </>
      ) : (
        <Interview key={planKey} topic={topic.trim()} writingType={writingType} grade={grade} busy={busy} onBack={() => setStep(1)} onFinish={start} />
      )}
    </div>
  );
}

function Steps({ step, onBack }: { step: 1 | 2; onBack: () => void }) {
  const t = useT();
  const items = [t.start.stepTopic, t.start.stepDirections];
  return (
    <ol aria-label={t.nav.steps} className="mx-auto mb-6 flex w-fit items-center gap-2 text-sm">
      {items.map((label, i) => {
        const n = (i + 1) as 1 | 2;
        const current = n === step;
        const done = n < step;
        const badge = (
          <span
            aria-hidden
            className={`grid size-6 place-items-center rounded-full text-xs font-bold ${
              current ? "bg-[var(--accent)] text-[var(--accent-fg)]" : done ? "bg-[var(--ok-bg)] text-[var(--ok-ink)]" : "bg-[var(--surface-2)] text-[var(--ink-muted)]"
            }`}
          >
            {done ? "✓" : n}
          </span>
        );
        return (
          <li key={label} className="flex items-center gap-2" aria-current={current ? "step" : undefined}>
            {i > 0 ? <span aria-hidden className="h-px w-8 bg-[var(--line-strong)]" /> : null}
            {done ? (
              <button type="button" onClick={onBack} className="flex items-center gap-2 rounded-full py-1 pr-2 text-[var(--ink-muted)] underline-offset-4 hover:text-[var(--ink)] hover:underline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)]">
                {badge}
                {label}
              </button>
            ) : (
              <span className={`flex items-center gap-2 ${current ? "font-semibold" : "text-[var(--ink-muted)]"}`}>
                {badge}
                {label}
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

const CHOICE =
  "cursor-pointer rounded-xl border-2 transition-[background-color,border-color,box-shadow] duration-150 focus-within:outline-3 focus-within:outline-offset-2 focus-within:outline-[var(--focus)]";
const choiceState = (checked: boolean) =>
  checked ? "border-[var(--accent)] bg-[var(--accent-soft)] shadow-[var(--shadow-sm)]" : "border-[var(--line)] bg-[var(--surface)] hover:border-[var(--line-strong)] hover:bg-[var(--surface-2)]";

function Tile({
  name,
  checked,
  onSelect,
  icon,
  visual,
  label,
  hint,
  centered = false,
  mono = false,
}: {
  name: string;
  checked: boolean;
  onSelect: () => void;
  icon?: string;
  visual?: ReactNode;
  label: string;
  hint?: string | null;
  centered?: boolean;
  mono?: boolean;
}) {
  return (
    <label className={`${CHOICE} ${choiceState(checked)} flex gap-3 p-3 ${centered ? "flex-col items-center text-center" : "items-center"}`}>
      <input type="radio" name={name} checked={checked} onChange={onSelect} className="sr-only" />
      {visual ?? (icon ? <span aria-hidden className={centered ? "text-3xl" : "text-2xl"}>{icon}</span> : null)}
      <span className="flex min-w-0 flex-col">
        <span className="font-semibold">{label}</span>
        {hint ? <span className={`text-sm text-[var(--ink-muted)] ${mono ? "font-mono" : ""}`}>{hint}</span> : null}
      </span>
    </label>
  );
}
