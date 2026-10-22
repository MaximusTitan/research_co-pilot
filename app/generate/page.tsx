"use client";

import { useRouter } from "next/navigation";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { Button, LinkButton, Notice } from "../../components/ui";
import { RequireProject } from "../../components/shell";
import { AUTOPILOT_STAGES, runAutopilot, type AutopilotProgress } from "../../lib/client/autopilot";
import { useLocale, useT } from "../../lib/i18n";
import type { Project } from "../../lib/types";

export default function GeneratePage() {
  return <RequireProject>{(project) => <Generate project={project} />}</RequireProject>;
}

type Status = "running" | "failed" | "limited";

function Generate({ project }: { project: Project }) {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();
  const [progress, setProgress] = useState<AutopilotProgress>({ stage: "plan" });
  const [status, setStatus] = useState<Status>("running");
  const started = useRef(false);

  async function run() {
    setStatus("running");
    try {
      const result = await runAutopilot(project.id, locale, { intro: t.outline.intro, conclusion: t.outline.conclusion }, setProgress);
      if (result.limited) setStatus("limited");
      else router.replace("/review");
    } catch {
      setStatus("failed");
    }
  }

  const start = useEffectEvent(() => void run());
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    start();
  }, []);

  const currentIndex = status === "limited" ? AUTOPILOT_STAGES.length : AUTOPILOT_STAGES.indexOf(progress.stage);

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6 py-4">
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight">{t.generate.title}</h1>
        <p className="mt-2 text-[var(--ink-muted)]">{t.generate.subtitle}</p>
      </div>

      <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 shadow-[var(--shadow-md)]">
        <p className="text-sm font-semibold text-[var(--ink-muted)]">{project.question ? t.generate.question : t.refine.yourTopic}</p>
        <p className="mt-1 text-lg font-semibold">{project.question ?? project.topic}</p>
        <p className="mt-1 text-sm text-[var(--ink-muted)]">
          {t.start[project.writingType]} · {t.start.grades[project.grade]}
        </p>

        <ol className="mt-5 flex flex-col gap-1" aria-live="polite">
          {AUTOPILOT_STAGES.map((stage, i) => {
            const done = i < currentIndex;
            const active = i === currentIndex && status === "running";
            const failed = i === currentIndex && status === "failed";
            return (
              <li
                key={stage}
                aria-current={active ? "step" : undefined}
                className={`flex items-center gap-3 rounded-lg px-2 py-2 transition-colors duration-200 ${active ? "bg-[var(--accent-soft)]" : ""}`}
              >
                <span
                  aria-hidden
                  className={`grid size-7 shrink-0 place-items-center rounded-full text-xs font-bold ${
                    done ? "bg-[var(--ok-bg)] text-[var(--ok-ink)]" : failed ? "bg-[var(--danger-bg)] text-[var(--danger-ink)]" : active ? "bg-[var(--accent)] text-[var(--accent-fg)]" : "bg-[var(--surface-2)] text-[var(--ink-muted)]"
                  }`}
                >
                  {done ? "✓" : failed ? "!" : active ? <span className="size-3 animate-spin rounded-full border-2 border-current border-t-transparent motion-reduce:animate-none" /> : i + 1}
                </span>
                <span className={`flex-1 ${done || active ? "text-[var(--ink)]" : "text-[var(--ink-muted)]"} ${active ? "font-semibold" : ""}`}>
                  {t.generate.stages[stage]}
                </span>
                {active && stage === "draft" && progress.total ? (
                  <span className="text-sm tabular-nums text-[var(--ink-muted)]">{t.generate.drafting(progress.done ?? 0, progress.total)}</span>
                ) : null}
              </li>
            );
          })}
        </ol>
      </div>

      {status === "running" ? <p className="text-center text-sm text-[var(--ink-muted)]">{t.generate.keepOpen}</p> : null}
      {status === "failed" ? (
        <div className="flex flex-col items-center gap-3">
          <Notice tone="error">{t.generate.failed}</Notice>
          <Button variant="primary" onClick={() => void run()}>{t.common.tryAgain}</Button>
        </div>
      ) : null}
      {status === "limited" ? (
        <div className="flex flex-col items-center gap-3">
          <Notice tone="warn">{t.generate.limited}</Notice>
          <LinkButton href="/review">{t.generate.seePaper} →</LinkButton>
        </div>
      ) : null}
    </div>
  );
}
