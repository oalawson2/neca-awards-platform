import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getCurrentUser, portalPathForRole } from "./lib/auth/session";

/**
 * Role-based routing shell for the three portals.
 *
 * This is structural only: getCurrentUser() currently always resolves to
 * `null`, so every portal request below redirects to /login. Once Supabase
 * Auth is connected, getCurrentUser() will read the real session and this
 * function will gate /applicant, /secretariat, and /jury by role without
 * further changes here.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const user = await getCurrentUser();

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

  return NextResponse.next();
}

export const config = {
  matcher: ["/applicant/:path*", "/secretariat/:path*", "/jury/:path*"],
};
