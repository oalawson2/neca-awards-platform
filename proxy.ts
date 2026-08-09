import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { portalPathForRole } from "./lib/auth/portal-path";
import type { UserRole } from "./types/auth";

/**
 * Role-based routing shell for the three portals, now backed by real
 * Supabase Auth.
 *
 * Follows Supabase's documented SSR proxy/middleware pattern: build the
 * response via NextResponse.next({ request }) *before* calling
 * supabase.auth.getUser(), and have the cookie adapter's setAll rebuild
 * that response each time a cookie needs refreshing. This is what lets an
 * expiring session get silently refreshed on a normal page request —
 * skipping it (e.g. reading the request cookie directly instead) causes
 * random sign-outs once the access token expires. Every return path below
 * must carry the cookies from the latest `response`, including redirects,
 * or the refreshed session gets dropped exactly when it was refreshed.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  // NEXT_PUBLIC_ vars are inlined by webpack at `next build` time, not
  // read from the running process's env — so if this ever fires, the fix
  // is to make sure the var is present *when `npm run build` runs*
  // (a .env.local/.env.production file on disk), not just set in cPanel's
  // Node App environment variables UI, which only affects the already-
  // built server process. See README's "Deployment" section.
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
    throw new Error(
      `proxy.ts: missing ${[
        !process.env.NEXT_PUBLIC_SUPABASE_URL && "NEXT_PUBLIC_SUPABASE_URL",
        !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY && "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      ]
        .filter(Boolean)
        .join(", ")} at build time — this was compiled into the app, not read at runtime.`
    );
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let role: UserRole | null = null;
  if (user) {
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
    role = profile?.role ?? null;
  }

  const { pathname } = request.nextUrl;
  const protectedPrefixes = ["/applicant", "/secretariat", "/jury"];
  const isProtected = protectedPrefixes.some((prefix) => pathname.startsWith(prefix));

  function withRefreshedCookies(redirectResponse: NextResponse) {
    response.cookies.getAll().forEach((cookie) => redirectResponse.cookies.set(cookie));
    return redirectResponse;
  }

  if (isProtected && !user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return withRefreshedCookies(NextResponse.redirect(loginUrl));
  }

  // Signed in via Supabase Auth but no profiles row yet (e.g. mid-signup,
  // pending email confirmation) — nothing to route on, treat like signed out.
  if (isProtected && user && !role) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return withRefreshedCookies(NextResponse.redirect(loginUrl));
  }

  if (isProtected && role && !pathname.startsWith(portalPathForRole(role))) {
    return withRefreshedCookies(NextResponse.redirect(new URL(portalPathForRole(role), request.url)));
  }

  if ((pathname === "/login" || pathname === "/signup") && role) {
    return withRefreshedCookies(NextResponse.redirect(new URL(portalPathForRole(role), request.url)));
  }

  return response;
}

export const config = {
  matcher: ["/applicant/:path*", "/secretariat/:path*", "/jury/:path*", "/login", "/signup"],
};
