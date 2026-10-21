"use client";

import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import type { Trust } from "../lib/types";
import { useT } from "../lib/i18n";

type Variant = "primary" | "secondary" | "ghost" | "danger";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-[var(--accent)] text-[var(--accent-fg)] hover:bg-[var(--accent-hover)] border-transparent shadow-[var(--shadow-sm)]",
  secondary: "bg-[var(--surface)] text-[var(--ink)] border-[var(--line-strong)] hover:bg-[var(--surface-2)] hover:border-[var(--ink-muted)] shadow-[var(--shadow-sm)]",
  ghost: "bg-transparent text-[var(--ink)] border-transparent hover:bg-[var(--surface-2)]",
  danger: "bg-[var(--danger)] text-white border-transparent hover:opacity-90 shadow-[var(--shadow-sm)]",
};

/** Shared by buttons and button-styled links: colour changes fade, and a press gives a slight squeeze. */
const BUTTON_BASE =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border px-4 py-2 font-medium transition-[color,background-color,border-color,opacity,scale] duration-150 ease-out select-none active:scale-[0.96] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100";

export function Button({
  variant = "secondary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type="button"
      {...props}
      className={`${BUTTON_BASE} ${VARIANTS[variant]} ${className}`}
    />
  );
}

export function LinkButton({ href, children, variant = "primary" }: { href: string; children: ReactNode; variant?: Variant }) {
  return (
    <Link
      href={href}
      className={`${BUTTON_BASE} ${VARIANTS[variant]}`}
    >
      {children}
    </Link>
  );
}

export function Card({ children, className = "", as: Tag = "section", label }: { children: ReactNode; className?: string; as?: "section" | "div" | "article"; label?: string }) {
  return (
    <Tag aria-label={label} className={`rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 shadow-[var(--shadow-sm)] ${className}`}>
      {children}
    </Tag>
  );
}

export function Field({ label, children, help, id }: { label: string; children: ReactNode; help?: string; id: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="font-semibold">
        {label}
      </label>
      {children}
      {help ? <p className="text-sm text-[var(--ink-muted)]">{help}</p> : null}
    </div>
  );
}

export const inputClass =
  "min-h-11 w-full rounded-lg border border-[var(--line-strong)] bg-[var(--surface)] px-3 py-2 text-[var(--ink)] transition-[border-color,box-shadow] duration-150 placeholder:text-[var(--ink-muted)] hover:border-[var(--ink-muted)] focus-visible:border-[var(--accent)] focus-visible:shadow-[0_0_0_3px_var(--accent-soft)] focus-visible:outline-3 focus-visible:outline-offset-1 focus-visible:outline-[var(--focus)]";

const TRUST_STYLE: Record<Trust, string> = {
  trusted: "bg-[var(--ok-bg)] text-[var(--ok-ink)] before:bg-[var(--ok)]",
  check: "bg-[var(--warn-bg)] text-[var(--warn-ink)] before:bg-[var(--warn)]",
  careful: "bg-[var(--danger-bg)] text-[var(--danger-ink)] before:bg-[var(--danger)]",
};

/** Traffic-light credibility tag. The colour is always paired with a word and a dot shape. */
export function TrustBadge({ trust }: { trust: Trust }) {
  const t = useT();
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-sm font-medium before:inline-block before:size-2 before:rounded-full ${TRUST_STYLE[trust]}`}>
      {t.sources.trust[trust]}
    </span>
  );
}

const NOTICE_STYLE = {
  info: { box: "bg-[var(--accent-soft)] border-[var(--accent)]", icon: "text-[var(--accent-ink)]" },
  warn: { box: "bg-[var(--warn-bg)] border-[var(--warn)]", icon: "text-[var(--warn-ink)]" },
  error: { box: "bg-[var(--danger-bg)] border-[var(--danger)]", icon: "text-[var(--danger-ink)]" },
};

/** A message box. Each tone has its own icon as well as its colour, so it reads without colour too. */
export function Notice({ tone = "info", children }: { tone?: "info" | "warn" | "error"; children: ReactNode }) {
  const style = NOTICE_STYLE[tone];
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`fade-up flex gap-3 rounded-xl border-l-4 px-4 py-3 text-[var(--ink)] ${style.box}`}>
      <NoticeIcon tone={tone} className={`mt-[0.2em] size-[1.1em] shrink-0 ${style.icon}`} />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

function NoticeIcon({ tone, className }: { tone: "info" | "warn" | "error"; className: string }) {
  const common = { className, viewBox: "0 0 20 20", fill: "none", stroke: "currentColor", strokeWidth: 1.75, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
  if (tone === "warn") {
    return (
      <svg {...common}>
        <path d="M10 3 2.5 16.5h15L10 3Z" />
        <path d="M10 8.5v3.5M10 14.5v.01" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <circle cx="10" cy="10" r="7.5" />
      {tone === "error" ? <path d="m7.5 7.5 5 5m0-5-5 5" /> : <path d="M10 9v4.5M10 6.5v.01" />}
    </svg>
  );
}

/** Inside a button it takes the button's text colour, so it stays readable on a filled button. */
export function Spinner({ label }: { label: string }) {
  return (
    <span role="status" className="flex items-center gap-2 text-[var(--ink-muted)] [button_&]:text-current">
      <span aria-hidden className="inline-block size-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent opacity-80 motion-reduce:animate-none" />
      {label}
    </span>
  );
}

export function PageTitle({ children, actions, subtitle }: { children: ReactNode; actions?: ReactNode; subtitle?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{children}</h1>
        {subtitle ? <p className="mt-1 text-[var(--ink-muted)]">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}
