/** Where a signed-in student lands: the form that starts a new project. */
export const APP_HOME = "/start";

/** The landing page. Guests see it at "/"; signed-in students are sent on to APP_HOME. */
export const LANDING = "/";

/** Where the password reset email link sends the student once /auth/confirm has signed them in. */
export const RESET_PASSWORD = "/reset-password";

/** Pages anyone can open without signing in. /auth/confirm is where the verification email link lands. */
const PUBLIC_PATHS = ["/login", "/signup", "/forgot-password", "/auth/confirm"];

/** Pages a signed-in user is sent away from. */
const GUEST_ONLY_PATHS = ["/login", "/signup", "/forgot-password"];

function matches(pathname: string, paths: string[]): boolean {
  return paths.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function isPublicPath(pathname: string): boolean {
  return pathname === LANDING || matches(pathname, PUBLIC_PATHS);
}

export function isGuestOnlyPath(pathname: string): boolean {
  return pathname === LANDING || matches(pathname, GUEST_ONLY_PATHS);
}

/**
 * Keeps post-login redirects on this site. Anything that isn't a plain
 * same-origin path ("//evil.com", "/\\evil.com", "https://…") falls back to "/".
 */
export function safeNextPath(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return "/";
  if (/[\u0000-\u001f]/.test(next)) return "/";
  if (isGuestOnlyPath(next.split(/[?#]/)[0])) return "/";
  return next;
}

/** Where the verification email link sends the student; /auth/confirm signs them in, then goes to `next`. */
export function confirmUrl(origin: string, next: string): string {
  const url = new URL("/auth/confirm", origin);
  // Always set next, so an email template can append "&token_hash=…" to this URL.
  url.searchParams.set("next", safeNextPath(next));
  return url.toString();
}
