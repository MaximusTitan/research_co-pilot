import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { RESET_PASSWORD, safeNextPath } from "@/lib/auth/routes";
import { supabaseServer } from "@/lib/supabase/server";

const OTP_TYPES = new Set<string>(["signup", "email", "invite", "magiclink", "recovery", "email_change"]);

/**
 * The verification and password reset email links land here. Each carries
 * either a token_hash (works on any device; needs the email templates from
 * the README) or a PKCE code (Supabase's default link; only works in the
 * browser that asked for the email). Either way the student ends up signed in
 * and sent on to `next`.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const next = safeNextPath(searchParams.get("next"));
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const code = searchParams.get("code");

  const supabase = await supabaseServer();
  let ok = false;
  if (tokenHash && type && OTP_TYPES.has(type)) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: type as EmailOtpType });
    ok = !error;
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    ok = !error;
  }

  if (ok) return NextResponse.redirect(new URL(next, request.nextUrl.origin));

  // A dead reset link is best answered with a way to ask for a fresh one.
  if (type === "recovery" || next === RESET_PASSWORD) {
    const forgot = new URL("/forgot-password", request.nextUrl.origin);
    forgot.searchParams.set("error", "link");
    return NextResponse.redirect(forgot);
  }

  const login = new URL("/login", request.nextUrl.origin);
  login.searchParams.set("error", "link");
  if (next !== "/") login.searchParams.set("next", next);
  return NextResponse.redirect(login);
}
