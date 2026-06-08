// =============================================================================
// middleware.ts — gate everything except /login, /signup, and /api/auth/*.
//
// We only check the presence of the session cookie here. The actual
// validation happens in API routes via getCurrentSession() — that's what
// catches expired/revoked sessions. This middleware just keeps anonymous
// users from landing on the builder UI before they sign in.
// =============================================================================

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const SESSION_COOKIE = "eb_session";
const PUBLIC_PATHS = ["/login", "/signup"];

export function middleware(req: NextRequest) {
  const { pathname, searchParams } = req.nextUrl;
  const hasSession = !!req.cookies.get(SESSION_COOKIE)?.value;

  // Bare `/` is no longer the default landing page — anyone visiting
  // http://localhost:3000/ is sent to /dashboard. The builder is still
  // reachable via `/?template=<id>`, `/?campaign=<id>` or `/?fresh=1`, so
  // the redirect only fires when there are no matching params.
  if (
    pathname === "/" &&
    hasSession &&
    !searchParams.has("fresh") &&
    !searchParams.has("template") &&
    !searchParams.has("campaign")
  ) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  // Public assets / Next internals / public pages.
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/api/auth") ||
    PUBLIC_PATHS.includes(pathname)
  ) {
    // If already signed in and visiting /login or /signup, bounce to the
    // dashboard (the new default landing page for the SaaS shell).
    if (hasSession && PUBLIC_PATHS.includes(pathname)) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
    return NextResponse.next();
  }

  if (!hasSession) {
    const url = new URL("/login", req.url);
    // Preserve the destination for deep links, but coerce the bare root URL
    // to /dashboard so a fresh sign-in always lands on the SaaS shell
    // instead of dropping the user into the builder editor.
    url.searchParams.set("next", pathname === "/" ? "/dashboard" : pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
