import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isGuestOnlyPath, isPublicPath } from "../auth/routes";
import { supabaseEnv } from "./env";

/**
 * Refreshes the Supabase session cookie on every request and gates pages:
 * guests go to /login, signed-in users skip /login and /signup, and API
 * calls without a session get a 401.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { url, key } = supabaseEnv();

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(toSet, headers) {
        toSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers).forEach(([k, v]) => response.headers.set(k, v));
      },
    },
  });

  // Do not run code between createServerClient and getClaims: it can log users out at random.
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims.sub);
  const { pathname, search } = request.nextUrl;

  if (!signedIn && pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (!signedIn && !isPublicPath(pathname)) {
    const login = request.nextUrl.clone();
    login.pathname = "/login";
    login.search = "";
    if (pathname !== "/") login.searchParams.set("next", `${pathname}${search}`);
    return redirectWithCookies(login, response);
  }

  if (signedIn && isGuestOnlyPath(pathname)) {
    const home = request.nextUrl.clone();
    home.pathname = "/";
    home.search = "";
    return redirectWithCookies(home, response);
  }

  return response;
}

/** A redirect must carry any refreshed session cookies, or the browser and server fall out of sync. */
function redirectWithCookies(url: URL, from: NextResponse) {
  const redirect = NextResponse.redirect(url);
  from.cookies.getAll().forEach((c) => redirect.cookies.set(c));
  return redirect;
}
