"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "../components/logo";
import { TrustBadge } from "../components/ui";
import { useLocale, useT } from "../lib/i18n";
import { updateSettings } from "../lib/settings";
import { GRADES } from "../lib/writing";


const FEATURE_ICONS: ReactNode[] = [
  // Shield with a tick: trusted sources.
  <path key="0" d="M12 3 5 6v5c0 4.4 3 8.3 7 9.5 4-1.2 7-5.1 7-9.5V6l-7-3Zm-3 9 2 2 4-4" />,
  // Pencil: the right kind of writing.
  <path key="1" d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4Zm9.5-13.5 4 4" />,
  // Magnifier with a tick: evidence check.
  <path key="2" d="M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Zm5.5-2 5 5M7.5 10.5l2 2 3.5-3.5" />,
  // Person in a circle: accessibility.
  <path key="3" d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-12.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3ZM7.5 10l4.5 1 4.5-1M12 11v3l-2 3.5m2-3.5 2 3.5" />,
  // Speech bubbles: two languages.
  <path key="4" d="M4 5h10v7H8l-4 3V5Zm6 10v1h6l4 3v-9h-4" />,
  // Page with a download arrow: ready to hand in.
  <path key="5" d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Zm0 0v5h5M12 11v6m-3-3 3 3 3-3" />,
];

export default function LandingPage() {
  const t = useT();
  const l = t.landing;
  const locale = useLocale();

  return (
    <div className="relative flex min-h-full flex-col overflow-x-clip">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-[var(--surface)] focus:p-2">
        {t.common.skipToContent}
      </a>

      <header className="sticky top-0 z-40 border-b border-[var(--line)]/60 bg-[var(--bg)]/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <Link href="/" className="rounded focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-[var(--focus)]">
            <Logo height={34} preload />
          </Link>
          <nav aria-label={t.nav.mainNav} className="flex items-center gap-1 text-sm sm:gap-2">
            <a href="#how" className="hidden rounded-lg px-3 py-2 hover:bg-[var(--surface-2)] md:inline-block">{l.nav.how}</a>
            <a href="#features" className="hidden rounded-lg px-3 py-2 hover:bg-[var(--surface-2)] md:inline-block">{l.nav.features}</a>
            <a href="#levels" className="hidden rounded-lg px-3 py-2 hover:bg-[var(--surface-2)] md:inline-block">{l.nav.levels}</a>
            <button
              type="button"
              onClick={() => updateSettings({ locale: locale === "en" ? "hi" : "en" })}
              aria-label={l.switchLanguageLabel}
              lang={locale === "en" ? "hi" : "en"}
              className="hidden rounded-lg px-3 py-2 text-[var(--ink-muted)] hover:bg-[var(--surface-2)] sm:inline-block"
            >
              {l.switchLanguage}
            </button>
            <Link href="/login" className="rounded-lg px-3 py-2 font-medium hover:bg-[var(--surface-2)]">
              {l.signIn}
            </Link>
            <CtaLink href="/signup" size="sm">{l.getStarted}</CtaLink>
          </nav>
        </div>
      </header>

      <main id="main" tabIndex={-1} className="flex-1">
        {/* Hero */}
        <section className="relative">
          <Glow />
          <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 pb-20 pt-14 sm:pt-20 lg:grid-cols-[1.05fr_1fr] lg:gap-10 lg:pb-28">
            <div className="rise-in min-w-0">
              <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--surface)] px-3 py-1 text-sm font-medium text-[var(--ink-muted)] shadow-sm">
                <Sparkle className="size-4 text-[var(--brand-blue)]" />
                {l.eyebrow}
              </p>
              <h1 className={`text-4xl font-extrabold tracking-tight ${locale === "hi" ? "leading-[1.3]" : "leading-[1.08]"} text-balance sm:text-5xl lg:text-6xl`}>
                {l.heroTitleA} <span className="brand-mark">{l.heroTitleMark}</span> {l.heroTitleB}
              </h1>
              <p className="mt-6 max-w-xl text-lg text-pretty text-[var(--ink-muted)]">{l.heroBody}</p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <CtaLink href="/signup">{l.ctaPrimary} <span aria-hidden>→</span></CtaLink>
                <a
                  href="#how"
                  className="inline-flex min-h-12 items-center rounded-xl border border-[var(--line-strong)] bg-[var(--surface)] px-5 font-semibold hover:bg-[var(--surface-2)] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)]"
                >
                  {l.ctaSecondary}
                </a>
              </div>
              <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-[var(--ink-muted)]">
                {l.perks.map((perk) => (
                  <li key={perk} className="flex items-center gap-2">
                    <Check className="size-4 text-[var(--ok)]" />
                    {perk}
                  </li>
                ))}
              </ul>
            </div>
            <ProductPreview />
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="scroll-mt-20 border-y border-[var(--line)] bg-[var(--surface)] py-20 sm:py-24">
          <div className="mx-auto max-w-6xl px-4">
            <SectionHeading title={l.howTitle} body={l.howBody} />
            <ol className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {l.steps.map((step, i) => (
                <li
                  key={step.title}
                  className="group relative rounded-2xl border border-[var(--line)] bg-[var(--bg)] p-6 transition-[border-color,transform] duration-200 hover:-translate-y-0.5 hover:border-[var(--brand-blue)]/50"
                >
                  <span
                    aria-hidden
                    className="mb-4 inline-flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--brand-blue)] to-[#5b7cff] text-lg font-bold text-white shadow-[0_6px_16px_-6px_var(--brand-blue)]"
                  >
                    {i + 1}
                  </span>
                  <h3 className="text-lg font-bold">{step.title}</h3>
                  <p className="mt-1.5 text-[var(--ink-muted)]">{step.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="scroll-mt-20 py-20 sm:py-24">
          <div className="mx-auto max-w-6xl px-4">
            <SectionHeading title={l.featuresTitle} />
            <ul className="mt-14 grid gap-x-10 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
              {l.features.map((f, i) => (
                <li key={f.title} className="flex flex-col gap-3">
                  <span aria-hidden className="inline-flex size-12 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent-ink)]">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="size-6">
                      {FEATURE_ICONS[i]}
                    </svg>
                  </span>
                  <h3 className="text-lg font-bold">{f.title}</h3>
                  <p className="text-[var(--ink-muted)]">{f.body}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Levels */}
        <section id="levels" className="scroll-mt-20 px-4 pb-20 sm:pb-24">
          <div className="mx-auto flex max-w-6xl flex-col items-center gap-8 rounded-3xl border border-[var(--line)] bg-[var(--surface)] px-6 py-12 text-center sm:px-12">
            <SectionHeading title={l.levelsTitle} body={l.levelsBody} />
            <ul className="flex flex-wrap justify-center gap-3">
              {GRADES.map((g, i) => (
                <li
                  key={g}
                  className="rounded-full border-2 px-4 py-2 font-semibold"
                  style={{ borderColor: `color-mix(in srgb, var(--brand-blue) ${30 + i * 15}%, var(--brand-green))` }}
                >
                  {t.start.grades[g]}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Final call to action */}
        <section className="px-4 pb-20 sm:pb-28">
          <div className="relative mx-auto max-w-6xl overflow-hidden rounded-3xl bg-[var(--brand-navy)] px-6 py-16 text-center text-white sm:px-12 sm:py-20">
            <div aria-hidden className="pointer-events-none absolute -left-24 -top-24 size-72 rounded-full bg-[var(--brand-blue)] opacity-60 blur-3xl" />
            <div aria-hidden className="pointer-events-none absolute -bottom-28 -right-16 size-80 rounded-full bg-[var(--brand-green)] opacity-40 blur-3xl" />
            <Sparkle className="relative mx-auto mb-6 size-10 text-[var(--brand-sky)]" />
            <h2 className="relative mx-auto max-w-2xl text-3xl font-extrabold tracking-tight text-balance sm:text-4xl">{l.finalTitle}</h2>
            <p className="relative mx-auto mt-4 max-w-xl text-lg text-white/80">{l.finalBody}</p>
            <div className="relative mt-8 flex flex-col items-center gap-4">
              <Link
                href="/signup"
                className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-[var(--brand-lime)] px-6 text-lg font-bold text-[var(--brand-navy)] transition-transform hover:-translate-y-0.5 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                {l.finalCta} <span aria-hidden>→</span>
              </Link>
              <p className="text-sm text-white/75">
                {l.haveAccount}{" "}
                <Link href="/login" className="font-semibold text-white underline underline-offset-4">
                  {l.signIn}
                </Link>
              </p>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-[var(--line)] bg-[var(--surface)]">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 text-sm text-[var(--ink-muted)] sm:flex-row">
          <Logo height={24} />
          <p>© {l.footer}</p>
        </div>
      </footer>
    </div>
  );
}

/** A miniature of the Sources step, so visitors see the app before signing up. */
function ProductPreview() {
  const t = useT();
  const m = t.landing.mock;
  const stepKeys = ["refine", "sources", "notes", "outline", "write", "review"] as const;

  return (
    <figure aria-label={m.label} className="rise-in relative mx-auto w-full min-w-0 max-w-lg [animation-delay:150ms] lg:mx-0 lg:justify-self-end">
      <div className="rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-5 shadow-[0_30px_60px_-20px_rgba(16,12,82,0.35)] sm:p-6">
        <div className="flex items-center gap-1.5" aria-hidden>
          <span className="size-2.5 rounded-full bg-[var(--line-strong)]/60" />
          <span className="size-2.5 rounded-full bg-[var(--line-strong)]/60" />
          <span className="size-2.5 rounded-full bg-[var(--line-strong)]/60" />
        </div>
        <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-[var(--ink-muted)]">{t.refine.yourTopic}</p>
        <p className="mt-1 text-xl font-bold">{m.topic}</p>
        <ol className="mt-4 flex gap-1 overflow-hidden text-xs" aria-hidden>
          {stepKeys.map((key, i) => (
            <li
              key={key}
              className={`flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 ${
                i === 1 ? "bg-[var(--brand-blue)] text-white" : i === 0 ? "bg-[var(--accent-soft)] text-[var(--accent-ink)]" : "text-[var(--ink-muted)]"
              }`}
            >
              <span className="font-semibold">{i + 1}</span>
              {t.nav[key]}
            </li>
          ))}
        </ol>
        <p className="mt-5 text-sm font-medium text-[var(--ink-muted)]">{m.sourcesFound}</p>
        <ul className="mt-2 flex flex-col gap-2.5">
          {m.sources.map((s) => (
            <li key={s.title} className="flex items-center justify-between gap-3 rounded-xl border border-[var(--line)] bg-[var(--bg)] px-4 py-3">
              <span className="min-w-0">
                <span className="block truncate font-semibold">{s.title}</span>
                <span className="block text-sm text-[var(--ink-muted)]">{s.site}</span>
              </span>
              <span className="shrink-0">
                <TrustBadge trust={s.trust} />
              </span>
            </li>
          ))}
        </ul>
      </div>
      <figcaption className="absolute -bottom-6 -left-3 flex items-center gap-3 rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-4 py-3 shadow-lg sm:-left-8">
        <span aria-hidden className="inline-flex size-9 items-center justify-center rounded-full bg-[var(--ok-bg)] text-[var(--ok)]">
          <Check className="size-5" />
        </span>
        <span className="leading-tight">
          <span className="block text-xs text-[var(--ink-muted)]">{m.claim}</span>
          <span className="block font-semibold">{m.supported}</span>
        </span>
      </figcaption>
      <Sparkle className="absolute -right-3 -top-5 size-10 text-[var(--brand-sky)] drop-shadow-sm" />
    </figure>
  );
}

function SectionHeading({ title, body }: { title: string; body?: string }) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <h2 className="text-3xl font-extrabold tracking-tight text-balance sm:text-4xl">{title}</h2>
      {body ? <p className="mt-4 text-lg text-pretty text-[var(--ink-muted)]">{body}</p> : null}
    </div>
  );
}

function CtaLink({ href, children, size = "md" }: { href: string; children: ReactNode; size?: "sm" | "md" }) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-2 rounded-xl bg-[var(--brand-blue)] font-semibold text-white shadow-[0_8px_20px_-8px_var(--brand-blue)] transition-[background-color,transform] hover:-translate-y-px hover:bg-[#2f32d6] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)] ${
        size === "sm" ? "min-h-10 px-4 text-sm" : "min-h-12 px-6 text-base"
      }`}
    >
      {children}
    </Link>
  );
}

/** Soft colour wash behind the hero, in the logo's blue and green. */
function Glow() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute -top-40 left-1/2 h-[28rem] w-[56rem] -translate-x-1/2 rounded-full bg-[var(--brand-blue)] opacity-[0.12] blur-3xl" />
      <div className="absolute right-[-10rem] top-40 h-80 w-80 rounded-full bg-[var(--brand-green)] opacity-20 blur-3xl" />
      <div className="absolute left-[-8rem] top-72 h-64 w-64 rounded-full bg-[var(--brand-lime)] opacity-[0.12] blur-3xl" />
    </div>
  );
}

/** The four-point star from the logo. */
function Sparkle({ className = "" }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M12 1.5c.6 5.6 4.9 9.9 10.5 10.5-5.6.6-9.9 4.9-10.5 10.5C11.4 16.9 7.1 12.6 1.5 12 7.1 11.4 11.4 7.1 12 1.5Z" />
    </svg>
  );
}

function Check({ className = "" }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </svg>
  );
}
