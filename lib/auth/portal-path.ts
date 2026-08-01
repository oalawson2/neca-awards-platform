import type { SessionUser } from "@/types/auth";

/**
 * Pure helpers with no server-only dependencies (no next/headers), so they're
 * safe to import from Client Components, proxy.ts, and Server Components
 * alike. Keep anything that touches cookies() in lib/auth/session.ts instead.
 */

export const SESSION_COOKIE_NAME = "neca_session";

/** Where a given role lands after login. */
export function portalPathForRole(role: SessionUser["role"]): string {
  switch (role) {
    case "applicant":
      return "/applicant";
    case "secretariat":
      return "/secretariat";
    case "jury":
      return "/jury";
  }
}
