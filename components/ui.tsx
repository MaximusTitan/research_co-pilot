"use client";

import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import type { Trust } from "../lib/types";
import { useT } from "../lib/i18n";

type Variant = "primary" | "secondary" | "ghost" | "danger";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-[var(--accent)] text-[var(--accent-fg)] hover:bg-[var(--accent-hover)] border-transparent",
  secondary: "bg-[var(--surface)] text-[var(--ink)] border-[var(--line-strong)] hover:bg-[var(--surface-2)]",
  ghost: "bg-transparent text-[var(--ink)] border-transparent hover:bg-[var(--surface-2)]",
  danger: "bg-[var(--danger)] text-white border-transparent hover:opacity-90",
};

export function Button({
  variant = "secondary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type="button"
      {...props}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border px-4 py-2 font-medium transition-colors focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)] disabled:cursor-not-allowed disabled:opacity-50 ${VARIANTS[variant]} ${className}`}
    />
  );
}

export function LinkButton({ href, children, variant = "primary" }: { href: string; children: ReactNode; variant?: Variant }) {
  return (
    <Link
      href={href}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border px-4 py-2 font-medium focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)] ${VARIANTS[variant]}`}
    >
      {children}
    </Link>
  );
}

export function Card({ children, className = "", as: Tag = "section", label }: { children: ReactNode; className?: string; as?: "section" | "div" | "article"; label?: string }) {
  return (
    <Tag aria-label={label} className={`rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4 shadow-sm ${className}`}>
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
  "min-h-11 w-full rounded-lg border border-[var(--line-strong)] bg-[var(--surface)] px-3 py-2 text-[var(--ink)] placeholder:text-[var(--ink-muted)] focus-visible:outline-3 focus-visible:outline-offset-1 focus-visible:outline-[var(--focus)]";

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

export function Notice({ tone = "info", children }: { tone?: "info" | "warn" | "error"; children: ReactNode }) {
  const style = {
    info: "bg-[var(--accent-soft)] border-[var(--accent)]",
    warn: "bg-[var(--warn-bg)] border-[var(--warn)]",
    error: "bg-[var(--danger-bg)] border-[var(--danger)]",
  }[tone];
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`rounded-lg border-l-4 px-4 py-3 text-[var(--ink)] ${style}`}>
      {children}
    </div>
  );
}

export function Spinner({ label }: { label: string }) {
  return (
    <p role="status" className="flex items-center gap-2 text-[var(--ink-muted)]">
      <span aria-hidden className="inline-block size-4 animate-spin rounded-full border-2 border-[var(--line-strong)] border-t-[var(--accent)] motion-reduce:animate-none" />
      {label}
    </p>
  );
}

export function PageTitle({ children, actions }: { children: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{children}</h1>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}
