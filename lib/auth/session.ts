import type { SessionUser } from "@/types/auth";
import { createClient } from "@/lib/supabase/server";

export { portalPathForRole } from "@/lib/auth/portal-path";

/**
 * Server Components / Route Handlers / Server Actions only — this file
 * imports lib/supabase/server.ts, which uses next/headers, so it can't be
 * imported from Client Components or proxy.ts. Those should import
 * lib/auth/portal-path.ts instead (see its docstring).
 *
 * Uses supabase.auth.getUser() rather than getSession() — getUser()
 * revalidates the token against the Supabase Auth server on every call,
 * where getSession() just trusts whatever's in the cookie. That round trip
 * is the point: it's what makes this safe to use for access decisions.
 *
 * A signed-in auth.users row with no matching profiles row (e.g. the
 * profiles insert failed mid-signup) is treated as signed-out rather than
 * crashing — there's no role to route on, so there's nothing this function
 * can meaningfully return. A deactivated account (profiles.deactivated_at
 * set — see lib/actions/users.ts's deactivateUser) is treated the same
 * way: this is what makes deactivation take effect immediately, on the
 * very next request, rather than waiting on their Supabase Auth session to
 * naturally expire — the admin-side auth ban (also set by deactivateUser)
 * only blocks *future* sign-ins, not an already-issued session.
 */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, deactivated_at")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile || profile.deactivated_at) return null;

  return {
    id: profile.id,
    email: profile.email,
    fullName: profile.full_name,
    role: profile.role,
  };
}
