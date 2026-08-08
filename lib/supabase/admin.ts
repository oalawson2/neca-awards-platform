import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client — bypasses RLS entirely. Server-only: never
 * import this from a Client Component, and never expose
 * SUPABASE_SERVICE_ROLE_KEY to the browser (no NEXT_PUBLIC_ prefix, and it
 * isn't one — check before adding anything that would inline it client-side).
 *
 * RLS isn't protecting anything once you're using this client — every
 * caller MUST do its own authorization check (e.g. via
 * lib/auth/session.ts's getCurrentUser()) before performing the operation.
 *
 * For the small set of operations that genuinely need to bypass RLS by
 * design: admin-provisioning secretariat/jury accounts via
 * supabase.auth.admin.* (invite-only, per the platform's access model) and
 * audit_log writes (no insert policy exists for authenticated users there).
 */
export function createAdminClient() {
  return createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
