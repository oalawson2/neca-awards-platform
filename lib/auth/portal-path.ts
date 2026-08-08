import type { SessionUser } from "@/types/auth";

/**
 * Pure helpers with no server-only dependencies (no next/headers, no
 * Supabase client), so they're safe to import from Client Components,
 * proxy.ts, and Server Components alike.
 *
 * No SESSION_COOKIE_NAME export here anymore — Supabase Auth manages its
 * own session cookie(s) via @supabase/ssr (name derived from the project
 * ref), so there's no app-owned cookie name to share across files.
 */

/** Where a given role lands after login. Both secretariat tiers share one portal. */
export function portalPathForRole(role: SessionUser["role"]): string {
  switch (role) {
    case "applicant":
      return "/applicant";
    case "secretariat":
    case "secretariat_super_admin":
      return "/secretariat";
    case "jury":
      return "/jury";
  }
}
