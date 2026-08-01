import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE_NAME, portalPathForRole } from "./lib/auth/portal-path";
import { store } from "./lib/mock/store";

/**
 * Role-based routing shell for the three portals.
 *
 * Reads the session cookie directly via `request.cookies` rather than
 * lib/auth/session.ts's getCurrentUser() — that function uses
 * `next/headers`'s cookies(), which only works in Server Components/Route
 * Handlers, not in Proxy/Middleware (and importing that file at all pulls
 * next/headers into a bundle that can't have it). Once Supabase Auth is
 * connected, this will read the Supabase session cookie the same way.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const userId = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const user = userId ? store.users.find((u) => u.id === userId) : undefined;

  const protectedPrefixes = ["/applicant", "/secretariat", "/jury"];
  const isProtected = protectedPrefixes.some((prefix) =>
    pathname.startsWith(prefix)
  );

  if (isProtected && !user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isProtected && user && !pathname.startsWith(portalPathForRole(user.role))) {
    return NextResponse.redirect(new URL(portalPathForRole(user.role), request.url));
  }

  if ((pathname === "/login" || pathname === "/signup") && user) {
    return NextResponse.redirect(new URL(portalPathForRole(user.role), request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/applicant/:path*", "/secretariat/:path*", "/jury/:path*", "/login", "/signup"],
};
