"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Card, Field, inputClass, Notice, Spinner } from "../components/ui";
import { VoiceButton } from "../components/voice-button";
import { callAgent } from "../lib/client/agent";
import { useLocale, useT } from "../lib/i18n";
import { createProject } from "../lib/project";
import { projectStore } from "../lib/store";
import type { GradeBand, WritingType } from "../lib/types";

const WRITING: { value: WritingType; key: "essay" | "report" | "paper"; hint: "essayHint" | "reportHint" | "paperHint"; icon: string }[] = [
  { value: "essay", key: "essay", hint: "essayHint", icon: "✍️" },
  { value: "report", key: "report", hint: "reportHint", icon: "📊" },
  { value: "paper", key: "paper", hint: "paperHint", icon: "🔬" },
];

const GRADES: GradeBand[] = ["4-6", "7-8", "9-10", "11-12", "adult"];

export default function StartPage() {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();
  const [topic, setTopic] = useState("");
  const [writingType, setWritingType] = useState<WritingType>("report");
  const [grade, setGrade] = useState<GradeBand>("7-8");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function start(e: React.FormEvent) {
    e.preventDefault();
    if (topic.trim().length < 5) {
      setError(t.start.topicTooShort);
      return;
    }
    setError(null);
    setBusy(true);
    const project = createProject({
      topic,
      writingType,
      grade,
      introTitle: t.outline.intro,
      conclusionTitle: t.outline.conclusion,
    });
    projectStore.add(project);

    const result = await callAgent("plan", { topic: project.topic, writingType, grade, locale, exclude: [] });
    projectStore.update((p) =>
      result.ok
        ? { ...p, coachMessage: result.data.coachMessage, angles: result.data.angles.map((a, i) => ({ id: `${p.id}-a${i}`, ...a })), plan: result.data.plan }
        : p,
    );
    if (!result.ok) setError(t.common.agentError);
    router.push("/refine");
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-6 text-center text-3xl font-bold tracking-tight sm:text-4xl">{t.start.title}</h1>
      <form onSubmit={start} className="flex flex-col gap-6" aria-busy={busy}>
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
            {WRITING.map((w) => {
              const selected = writingType === w.value;
              return (
                <label
                  key={w.value}
                  className={`flex cursor-pointer flex-col items-center gap-1 rounded-xl border-2 p-4 text-center transition-colors focus-within:outline-3 focus-within:outline-offset-2 focus-within:outline-[var(--focus)] ${
                    selected ? "border-[var(--accent)] bg-[var(--accent-soft)]" : "border-[var(--line)] bg-[var(--surface)] hover:bg-[var(--surface-2)]"
                  }`}
                >
                  <input type="radio" name="writing" value={w.value} checked={selected} onChange={() => setWritingType(w.value)} className="sr-only" />
                  <span aria-hidden className="text-3xl">{w.icon}</span>
                  <span className="font-semibold">{t.start[w.key]}</span>
                  <span className="text-sm text-[var(--ink-muted)]">{t.start[w.hint]}</span>
                </label>
              );
            })}
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
                  className={`cursor-pointer rounded-lg border-2 px-4 py-2 focus-within:outline-3 focus-within:outline-offset-2 focus-within:outline-[var(--focus)] ${
                    selected ? "border-[var(--accent)] bg-[var(--accent-soft)] font-semibold" : "border-[var(--line)] bg-[var(--surface)]"
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

        <div className="flex justify-center">
          <Button type="submit" variant="primary" disabled={busy} className="min-w-64">
            {busy ? <Spinner label={t.refine.thinking} /> : `${t.start.submit} →`}
          </Button>
        </div>
      </form>
    </div>
  );
}
