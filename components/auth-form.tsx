"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { confirmUrl, safeNextPath } from "../lib/auth/routes";
import { authErrorKey, firstIssue, loginInput, signupInput, type AuthErrorKey } from "../lib/auth/validation";
import { useT } from "../lib/i18n";
import { supabaseBrowser } from "../lib/supabase/client";
import { Button, Card, Field, inputClass, Notice } from "./ui";

type Mode = "login" | "signup";

/** Supabase limits how often it emails one address, so the resend button waits this long. */
const RESEND_COOLDOWN_S = 60;

export function AuthForm({ mode }: { mode: Mode }) {
  const t = useT();
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNextPath(params.get("next"));
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<AuthErrorKey | null>(mode === "login" && params.get("error") === "link" ? "linkInvalid" : null);
  const [busy, setBusy] = useState(false);
  // Set once sign-up has emailed a verification link; the form then shows "Check your email".
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  async function resend(to: string) {
    setError(null);
    setResent(false);
    setResending(true);
    const { error: authError } = await supabaseBrowser().auth.resend({
      type: "signup",
      email: to,
      options: { emailRedirectTo: confirmUrl(window.location.origin, next) },
    });
    setResending(false);
    if (authError) return setError(authErrorKey(authError.code));
    setResent(true);
    setCooldown(RESEND_COOLDOWN_S);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const supabase = supabaseBrowser();

    if (mode === "login") {
      const parsed = loginInput.safeParse({ email, password });
      if (!parsed.success) return setError(firstIssue(parsed.error));
      setBusy(true);
      const { error: authError } = await supabase.auth.signInWithPassword(parsed.data);
      if (authError) {
        setBusy(false);
        return setError(authErrorKey(authError.code));
      }
    } else {
      const parsed = signupInput.safeParse({ displayName, email, password });
      if (!parsed.success) return setError(firstIssue(parsed.error));
      setBusy(true);
      const { data, error: authError } = await supabase.auth.signUp({
        email: parsed.data.email,
        password: parsed.data.password,
        options: {
          data: { display_name: parsed.data.displayName },
          emailRedirectTo: confirmUrl(window.location.origin, next),
        },
      });
      if (authError) {
        setBusy(false);
        return setError(authErrorKey(authError.code));
      }
      if (!data.session) {
        // "Confirm email" is on: the account waits for the link. Supabase answers the same way for an
        // email that already has an account, so this screen doesn't reveal which emails are registered.
        setBusy(false);
        setPassword("");
        setResent(false);
        setCooldown(RESEND_COOLDOWN_S);
        return setSentTo(parsed.data.email);
      }
    }

    router.replace(next);
    router.refresh();
  }

  const isLogin = mode === "login";

  if (sentTo) {
    return (
      <div className="mx-auto flex w-full max-w-md flex-col gap-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight">{t.auth.checkEmailTitle}</h1>
          <p className="mt-2 text-[var(--ink-muted)]">{t.auth.checkEmailBody(sentTo)}</p>
        </div>
        <Card>
          <div className="flex flex-col gap-4" aria-busy={resending}>
            {error ? <Notice tone="error">{t.auth.errors[error]}</Notice> : resent ? <Notice>{t.auth.resent}</Notice> : null}
            <p className="text-sm text-[var(--ink-muted)]">{t.auth.checkEmailHelp}</p>
            <Button variant="primary" onClick={() => void resend(sentTo)} disabled={resending || cooldown > 0}>
              {resending ? t.auth.resending : cooldown > 0 ? t.auth.resendIn(cooldown) : t.auth.resend}
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
        <p className="text-center text-sm">
          {t.auth.haveAccount}{" "}
          <Link
            href={{ pathname: "/login", query: next === "/" ? undefined : { next } }}
            className="font-semibold text-[var(--accent-ink)] underline underline-offset-4"
          >
            {t.auth.toLogin}
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight">{isLogin ? t.auth.loginTitle : t.auth.signupTitle}</h1>
        <p className="mt-2 text-[var(--ink-muted)]">{isLogin ? t.auth.loginSubtitle : t.auth.signupSubtitle}</p>
      </div>

      <Card>
          <form onSubmit={submit} className="flex flex-col gap-4" aria-busy={busy} noValidate>
            {error ? <Notice tone="error">{t.auth.errors[error]}</Notice> : resent ? <Notice>{t.auth.resent}</Notice> : null}
            {isLogin && error === "emailNotConfirmed" ? (
              <Button onClick={() => void resend(email.trim().toLowerCase())} disabled={resending || cooldown > 0}>
                {resending ? t.auth.resending : cooldown > 0 ? t.auth.resendIn(cooldown) : t.auth.resend}
              </Button>
            ) : null}
            {!isLogin ? (
              <Field id="name" label={t.auth.name}>
                <input
                  id="name"
                  className={inputClass}
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  autoComplete="name"
                  maxLength={80}
                  required
                />
              </Field>
            ) : null}
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
            <Field id="password" label={t.auth.password} help={isLogin ? undefined : t.auth.passwordHelp}>
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                className={inputClass}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={isLogin ? "current-password" : "new-password"}
                maxLength={128}
                required
              />
            </Field>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" className="size-4" checked={showPassword} onChange={(e) => setShowPassword(e.target.checked)} />
                {t.auth.showPassword}
              </label>
              {isLogin ? (
                <Link href="/forgot-password" className="text-sm font-semibold text-[var(--accent-ink)] underline underline-offset-4">
                  {t.auth.forgotLink}
                </Link>
              ) : null}
            </div>
            <Button type="submit" variant="primary" disabled={busy}>
              {busy ? (isLogin ? t.auth.loggingIn : t.auth.signingUp) : isLogin ? t.auth.login : t.auth.signup}
            </Button>
          </form>
        </Card>

      <p className="text-center text-sm">
        {isLogin ? t.auth.noAccount : t.auth.haveAccount}{" "}
        <Link
          href={{ pathname: isLogin ? "/signup" : "/login", query: next === "/" ? undefined : { next } }}
          className="font-semibold text-[var(--accent-ink)] underline underline-offset-4"
        >
          {isLogin ? t.auth.toSignup : t.auth.toLogin}
        </Link>
      </p>
    </div>
  );
}
