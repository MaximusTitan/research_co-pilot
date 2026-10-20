"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { APP_HOME, confirmUrl, RESET_PASSWORD } from "../lib/auth/routes";
import { authErrorKey, firstIssue, forgotPasswordInput, resetPasswordInput, type AuthErrorKey } from "../lib/auth/validation";
import { useT } from "../lib/i18n";
import { supabaseBrowser } from "../lib/supabase/client";
import { Button, Card, Field, inputClass, LinkButton, Notice } from "./ui";

/** Supabase limits how often it emails one address, so the resend button waits this long. */
const RESEND_COOLDOWN_S = 60;

/** Step 1: the student asks for a reset link. */
export function ForgotPasswordForm() {
  const t = useT();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<AuthErrorKey | null>(params.get("error") === "link" ? "resetLinkInvalid" : null);
  const [busy, setBusy] = useState(false);
  // Set once the link is on its way; the page then shows "Check your email".
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [resent, setResent] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  /** Supabase answers the same way whether or not the email has an account, so nothing here reveals that. */
  async function send(to: string): Promise<boolean> {
    setBusy(true);
    const { error: authError } = await supabaseBrowser().auth.resetPasswordForEmail(to, {
      redirectTo: confirmUrl(window.location.origin, RESET_PASSWORD),
    });
    setBusy(false);
    if (authError) {
      setError(authErrorKey(authError.code));
      return false;
    }
    setCooldown(RESEND_COOLDOWN_S);
    return true;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = forgotPasswordInput.safeParse({ email });
    if (!parsed.success) return setError(firstIssue(parsed.error));
    if (await send(parsed.data.email)) {
      setResent(false);
      setSentTo(parsed.data.email);
    }
  }

  async function resend(to: string) {
    setError(null);
    setResent(false);
    if (await send(to)) setResent(true);
  }

  if (sentTo) {
    return (
      <AuthPage title={t.auth.checkEmailTitle} subtitle={t.auth.resetSentBody(sentTo)}>
        <Card>
          <div className="flex flex-col gap-4" aria-busy={busy}>
            {error ? <Notice tone="error">{t.auth.errors[error]}</Notice> : resent ? <Notice>{t.auth.resent}</Notice> : null}
            <p className="text-sm text-[var(--ink-muted)]">{t.auth.resetSentHelp}</p>
            <Button variant="primary" onClick={() => void resend(sentTo)} disabled={busy || cooldown > 0}>
              {busy ? t.auth.resending : cooldown > 0 ? t.auth.resendIn(cooldown) : t.auth.resend}
            </Button>
            <Button
              onClick={() => {
                setSentTo(null);
                setError(null);
              }}
            >
              {t.auth.useDifferentEmail}
            </Button>
          </div>
        </Card>
        <BackToLogin />
      </AuthPage>
    );
  }

  return (
    <AuthPage title={t.auth.forgotTitle} subtitle={t.auth.forgotSubtitle}>
      <Card>
        <form onSubmit={submit} className="flex flex-col gap-4" aria-busy={busy} noValidate>
          {error ? <Notice tone="error">{t.auth.errors[error]}</Notice> : null}
          <Field id="email" label={t.auth.email}>
            <input
              id="email"
              type="email"
              inputMode="email"
              className={inputClass}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              maxLength={254}
              required
            />
          </Field>
          <Button type="submit" variant="primary" disabled={busy}>
            {busy ? t.auth.sendingResetLink : t.auth.sendResetLink}
          </Button>
        </form>
      </Card>
      <BackToLogin />
    </AuthPage>
  );
}

/**
 * Step 2: the reset link has signed the student in (via /auth/confirm), and
 * they choose a new password. Signed-in students can also come here directly
 * to change their password.
 */
export function ResetPasswordForm() {
  const t = useT();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<AuthErrorKey | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = resetPasswordInput.safeParse({ password, confirm });
    if (!parsed.success) return setError(firstIssue(parsed.error));
    setBusy(true);
    const supabase = supabaseBrowser();
    const { error: authError } = await supabase.auth.updateUser({ password: parsed.data.password });
    if (authError) {
      setBusy(false);
      return setError(authErrorKey(authError.code));
    }
    // Whoever knew the old password may still be signed in somewhere; end those sessions.
    await supabase.auth.signOut({ scope: "others" });
    setBusy(false);
    setPassword("");
    setConfirm("");
    setDone(true);
  }

  if (done) {
    return (
      <AuthPage title={t.auth.resetDoneTitle} subtitle={t.auth.resetDoneBody}>
        <div className="flex justify-center">
          <LinkButton href={APP_HOME}>{t.auth.continueToApp} →</LinkButton>
        </div>
      </AuthPage>
    );
  }

  return (
    <AuthPage title={t.auth.resetTitle} subtitle={t.auth.resetSubtitle}>
      <Card>
        <form onSubmit={submit} className="flex flex-col gap-4" aria-busy={busy} noValidate>
          {error ? <Notice tone="error">{t.auth.errors[error]}</Notice> : null}
          <Field id="new-password" label={t.auth.newPassword} help={t.auth.passwordHelp}>
            <input
              id="new-password"
              type={showPassword ? "text" : "password"}
              className={inputClass}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              maxLength={128}
              required
            />
          </Field>
          <Field id="confirm-password" label={t.auth.confirmPassword}>
            <input
              id="confirm-password"
              type={showPassword ? "text" : "password"}
              className={inputClass}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              maxLength={128}
              required
            />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="size-4" checked={showPassword} onChange={(e) => setShowPassword(e.target.checked)} />
            {t.auth.showPassword}
          </label>
          <Button type="submit" variant="primary" disabled={busy}>
            {busy ? t.auth.savingPassword : t.auth.savePassword}
          </Button>
        </form>
      </Card>
    </AuthPage>
  );
}

function AuthPage({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        <p className="mt-2 text-[var(--ink-muted)]">{subtitle}</p>
      </div>
      {children}
    </div>
  );
}

function BackToLogin() {
  const t = useT();
  return (
    <p className="text-center text-sm">
      <Link href="/login" className="font-semibold text-[var(--accent-ink)] underline underline-offset-4">
        {t.auth.backToLogin}
      </Link>
    </p>
  );
}
