"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { safeNextPath } from "../lib/auth/routes";
import { authErrorKey, firstIssue, loginInput, signupInput, type AuthErrorKey } from "../lib/auth/validation";
import { useT } from "../lib/i18n";
import { supabaseBrowser } from "../lib/supabase/client";
import { Button, Card, Field, inputClass, Notice } from "./ui";

type Mode = "login" | "signup";

export function AuthForm({ mode }: { mode: Mode }) {
  const t = useT();
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNextPath(params.get("next"));
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<AuthErrorKey | null>(null);
  const [busy, setBusy] = useState(false);

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
        options: { data: { display_name: parsed.data.displayName } },
      });
      if (authError || !data.session) {
        if (process.env.NODE_ENV === "development") {
          // Both cases usually mean "Confirm email" is still on in Supabase (Authentication → Sign In / Providers → Email).
          console.warn("Sign-up did not start a session:", authError?.code ?? "no session returned");
        }
        setBusy(false);
        return setError(authErrorKey(authError?.code));
      }
    }

    router.replace(next);
    router.refresh();
  }

  const isLogin = mode === "login";

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight">{isLogin ? t.auth.loginTitle : t.auth.signupTitle}</h1>
        <p className="mt-2 text-[var(--ink-muted)]">{isLogin ? t.auth.loginSubtitle : t.auth.signupSubtitle}</p>
      </div>

      <Card>
          <form onSubmit={submit} className="flex flex-col gap-4" aria-busy={busy} noValidate>
            {error ? <Notice tone="error">{t.auth.errors[error]}</Notice> : null}
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
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="size-4" checked={showPassword} onChange={(e) => setShowPassword(e.target.checked)} />
              {t.auth.showPassword}
            </label>
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
