"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Card, Notice, Spinner, inputClass } from "../../components/ui";
import { RequireProject } from "../../components/shell";
import { ReadAloud } from "../../components/read-aloud";
import { callAgent } from "../../lib/client/agent";
import { useLocale, useT } from "../../lib/i18n";
import { setQuestion as applyQuestion } from "../../lib/project";
import { projectStore } from "../../lib/store";
import type { Angle, Project } from "../../lib/types";

export default function RefinePage() {
  return <RequireProject>{(project) => <Refine project={project} />}</RequireProject>;
}

function Refine({ project }: { project: Project }) {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();
  const [angleId, setAngleId] = useState<string | null>(project.selectedAngleId);
  const [question, setQuestion] = useState<string | null>(project.question);
  const [ownQuestion, setOwnQuestion] = useState("");
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);

  const angle: Angle | undefined = project.angles.find((a) => a.id === angleId);
  const chosen = ownQuestion.trim() || question;

  async function showMore() {
    setLoadingMore(true);
    setError(null);
    const result = await callAgent("plan", {
      topic: project.topic,
      writingType: project.writingType,
      grade: project.grade,
      locale,
      exclude: project.angles.map((a) => a.title),
    });
    setLoadingMore(false);
    if (!result.ok) {
      setError(t.common.agentError);
      return;
    }
    setOffline(result.mode === "offline");
    const fresh = result.data.angles.map((a, i) => ({ id: `${project.id}-m${Date.now()}-${i}`, ...a }));
    projectStore.update((p) => ({ ...p, angles: [...p.angles, ...fresh] }));
  }

  function useQuestion() {
    if (!chosen) return;
    projectStore.update((p) => applyQuestion(p, chosen, angleId));
    router.push("/sources");
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
      <aside className="flex min-w-0 flex-col gap-4">
        <Card label={t.refine.yourTopic}>
          <p className="text-sm text-[var(--ink-muted)]">{t.refine.yourTopic}</p>
          <p className="text-lg font-semibold">{project.topic}</p>
          <p className="text-sm text-[var(--ink-muted)]">{t.start[project.writingType]} · {t.start.grades[project.grade]}</p>
        </Card>

        {project.coachMessage ? (
          <Card className="bg-[var(--accent-soft)]">
            <p className="mb-2 flex items-center gap-2 font-semibold">
              <span aria-hidden>🧭</span> {t.refine.plannerName}
            </p>
            <p>{project.coachMessage}</p>
            <div className="mt-2">
              <ReadAloud text={project.coachMessage} />
            </div>
          </Card>
        ) : null}

        <Card>
          <p className="mb-2 font-semibold">{t.refine.plan}</p>
          <ol className="list-decimal space-y-1 pl-5">
            {project.plan.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </Card>
      </aside>

      <div className="flex min-w-0 flex-col gap-6">
        <section aria-labelledby="angles-h">
          <h2 id="angles-h" className="mb-3 text-lg font-semibold">{t.refine.pickAngle}</h2>
          {project.angles.length === 0 ? (
            <Notice tone="warn">{t.common.agentError}</Notice>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {project.angles.map((a) => {
                const selected = a.id === angleId;
                return (
                  <button
                    key={a.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => {
                      setAngleId(a.id);
                      setQuestion(null);
                    }}
                    className={`flex min-h-24 flex-col items-start gap-2 rounded-xl border-2 p-4 text-left transition-colors focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)] ${
                      selected ? "border-[var(--accent)] bg-[var(--accent-soft)]" : "border-[var(--line)] bg-[var(--surface)] hover:bg-[var(--surface-2)]"
                    }`}
                  >
                    <span className="font-semibold">
                      <span aria-hidden className="mr-1">{a.emoji}</span>
                      {a.title}
                    </span>
                    <span className="rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-sm">{t.refine.tags[a.tag]}</span>
                  </button>
                );
              })}
            </div>
          )}
          <div className="mt-3">
            <Button onClick={showMore} disabled={loadingMore}>
              {loadingMore ? <Spinner label={t.refine.thinking} /> : `✨ ${t.refine.showMore}`}
            </Button>
          </div>
          {offline ? <div className="mt-3"><Notice tone="warn">{t.common.offlineHint}</Notice></div> : null}
          {error ? <div className="mt-3"><Notice tone="error">{error}</Notice></div> : null}
        </section>

        <section aria-labelledby="questions-h">
          <h2 id="questions-h" className="mb-3 text-lg font-semibold">{t.refine.pickQuestion}</h2>
          {!angle ? (
            <p className="text-[var(--ink-muted)]">{t.refine.chooseFirst}</p>
          ) : (
            <div role="radiogroup" aria-label={t.refine.pickQuestion} className="flex flex-col gap-2">
              {angle.questions.map((q) => {
                const selected = question === q && !ownQuestion.trim();
                return (
                  <label
                    key={q}
                    className={`flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border-2 p-3 focus-within:outline-3 focus-within:outline-offset-2 focus-within:outline-[var(--focus)] ${
                      selected ? "border-[var(--accent)] bg-[var(--accent-soft)]" : "border-[var(--line)] bg-[var(--surface)]"
                    }`}
                  >
                    <input
                      type="radio"
                      name="question"
                      className="mt-1 size-4 accent-[var(--accent)]"
                      checked={selected}
                      onChange={() => {
                        setQuestion(q);
                        setOwnQuestion("");
                      }}
                    />
                    <span>{q}</span>
                  </label>
                );
              })}
            </div>
          )}

          <div className="mt-4 flex flex-col gap-1.5">
            <label htmlFor="own-q" className="font-semibold">{t.refine.ownQuestion}</label>
            <input
              id="own-q"
              className={inputClass}
              value={ownQuestion}
              maxLength={300}
              placeholder={t.refine.ownQuestionPlaceholder}
              onChange={(e) => setOwnQuestion(e.target.value)}
            />
          </div>

          <div className="mt-6">
            <Button variant="primary" onClick={useQuestion} disabled={!chosen}>
              {t.refine.useQuestion} →
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}
