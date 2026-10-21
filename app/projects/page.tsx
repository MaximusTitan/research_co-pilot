"use client";

import { useRouter } from "next/navigation";
import { Button, Card, LinkButton, PageTitle } from "../../components/ui";
import { useLocale, useT } from "../../lib/i18n";
import { resumePath } from "../../lib/project";
import { projectStore, useStore } from "../../lib/store";
import type { Project } from "../../lib/types";

export default function ProjectsPage() {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();
  const state = useStore();

  const list: Project[] = state
    ? Object.values(state.projects).sort((a, b) => b.updatedAt - a.updatedAt)
    : [];

  const dateFormat = new Intl.DateTimeFormat(locale === "hi" ? "hi-IN" : "en", { dateStyle: "medium" });

  return (
    <div className="flex flex-col gap-6">
      <PageTitle actions={<LinkButton href="/start">{t.common.startProject}</LinkButton>}>{t.projects.title}</PageTitle>
      {list.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 border-dashed py-10 text-center shadow-none">
          <span aria-hidden className="text-4xl">📚</span>
          <p className="text-[var(--ink-muted)]">{t.projects.empty}</p>
          <LinkButton href="/start">{t.common.startProject}</LinkButton>
        </Card>
      ) : null}
      <ul className="grid gap-4 sm:grid-cols-2">
        {list.map((p) => (
          <li key={p.id}>
            <Card className="flex h-full flex-col gap-3 transition-shadow duration-150 hover:shadow-[var(--shadow-md)]">
              <div>
                <p className="text-lg font-semibold">{p.topic}</p>
                <p className="text-sm text-[var(--ink-muted)]">
                  {t.start[p.writingType]} · {t.start.grades[p.grade]} · {t.projects.updated}: {dateFormat.format(p.updatedAt)}
                </p>
              </div>
              <div className="mt-auto flex flex-wrap gap-2">
                <Button
                  variant="primary"
                  onClick={() => {
                    projectStore.select(p.id);
                    router.push(resumePath(p));
                  }}
                >
                  {t.projects.open}
                </Button>
                <Button
                  variant="ghost"
                  className="text-[var(--danger-ink)]! hover:bg-[var(--danger-bg)]"
                  aria-label={`${t.projects.remove}: ${p.topic}`}
                  onClick={() => {
                    if (window.confirm(t.projects.confirmRemove)) projectStore.remove(p.id);
                  }}
                >
                  {t.projects.remove}
                </Button>
              </div>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
