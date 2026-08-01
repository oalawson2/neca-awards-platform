import type { SessionUser } from "@/types/auth";

/**
 * Placeholder session lookup.
 *
 * Once the Supabase schema and Auth are connected, this will read the
 * Supabase session (via lib/supabase/server.ts) and resolve the user's
 * role from a `profiles` table. For now it always returns `null` so
 * every portal route falls through to /login.
 */
export async function getCurrentUser(): Promise<SessionUser | null> {
  return null;
}

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
