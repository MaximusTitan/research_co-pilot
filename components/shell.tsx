"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { projectStore, useCurrentProject, useSaveStatus } from "../lib/store";
import { useT } from "../lib/i18n";
import { supabaseBrowser } from "../lib/supabase/client";
import { APP_HOME, LANDING } from "../lib/auth/routes";
import { useAuthUser } from "./auth-provider";
import { Logo } from "./logo";
import { Button, LinkButton, Spinner } from "./ui";

const STEPS = [
  { href: "/refine", key: "refine" },
  { href: "/sources", key: "sources" },
  { href: "/notes", key: "notes" },
  { href: "/outline", key: "outline" },
  { href: "/write", key: "write" },
  { href: "/review", key: "review" },
] as const;

export function Shell({ children }: { children: ReactNode }) {
  const t = useT();
  const pathname = usePathname();
  const { project } = useCurrentProject();
  const user = useAuthUser();

  // The landing page brings its own header and footer.
  if (pathname === LANDING) return <>{children}</>;

  return (
    <div className="flex min-h-full flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-[var(--surface)] focus:p-2">
        {t.common.skipToContent}
      </a>
      <header className="border-b border-[var(--line)] bg-[var(--surface)]">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <Link href={user ? APP_HOME : LANDING} className="rounded focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-[var(--focus)]">
            <Logo height={30} preload />
          </Link>
          <nav aria-label={t.nav.mainNav} className="flex flex-wrap items-center gap-4 text-sm">
            {user ? (
              <Link href="/projects" className="underline-offset-4 hover:underline">
                {t.nav.myProjects}
              </Link>
            ) : null}
            <Link href="/settings" className="underline-offset-4 hover:underline">
              {t.nav.settings}
            </Link>
            {user ? <AccountMenu name={user.displayName ?? user.email ?? ""} /> : null}
          </nav>
        </div>
        <SaveStatus />
        {user && project && pathname !== APP_HOME && pathname !== "/projects" ? (
          <nav aria-label={t.nav.steps} className="border-t border-[var(--line)]">
            <ol className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 py-2 text-sm">
              {STEPS.map((step, i) => {
                const current = pathname === step.href;
                return (
                  <li key={step.href}>
                    <Link
                      href={step.href}
                      aria-current={current ? "step" : undefined}
                      className={`inline-flex min-h-9 items-center gap-2 rounded-full px-3 py-1 whitespace-nowrap ${
                        current ? "bg-[var(--accent)] text-[var(--accent-fg)]" : "hover:bg-[var(--surface-2)]"
                      }`}
                    >
                      <span aria-hidden className="font-semibold">{i + 1}</span>
                      {t.nav[step.key]}
                    </Link>
                  </li>
                );
              })}
            </ol>
          </nav>
        ) : null}
      </header>
      <main id="main" tabIndex={-1} className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:py-8">
        {children}
      </main>
    </div>
  );
}

function AccountMenu({ name }: { name: string }) {
  const t = useT();
  const router = useRouter();

  async function signOut() {
    await projectStore.reset();
    await supabaseBrowser().auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <span className="flex items-center gap-2">
      <span className="max-w-48 truncate text-[var(--ink-muted)]" title={t.nav.signedInAs(name)}>
        {name}
      </span>
      <Button variant="secondary" className="min-h-9 px-3 py-1 text-sm" onClick={signOut}>
        {t.nav.signOut}
      </Button>
    </span>
  );
}

/** Saving happens quietly in the background; this only appears if a save fails. */
function SaveStatus() {
  const t = useT();
  if (useSaveStatus() !== "error") return null;
  return (
    <div role="alert" className="mx-auto flex max-w-6xl items-center gap-3 px-4 pb-2 text-sm">
      <span className="text-[var(--danger-ink)]">{t.nav.saveFailed}</span>
      <Button variant="ghost" className="min-h-9 px-2 text-sm" onClick={() => projectStore.retry()}>
        {t.common.tryAgain}
      </Button>
    </div>
  );
}

/** Renders children only when a project is open; otherwise points the student back to the start. */
export function RequireProject({ children }: { children: (project: NonNullable<ReturnType<typeof useCurrentProject>["project"]>) => ReactNode }) {
  const t = useT();
  const { ready, project } = useCurrentProject();
  if (!ready) return <Spinner label={t.common.loading} />;
  if (!project) {
    return (
      <div className="flex flex-col items-start gap-4">
        <p>{t.common.noProject}</p>
        <LinkButton href={APP_HOME}>{t.common.startProject}</LinkButton>
      </div>
    );
  }
  return <>{children(project)}</>;
}
