import { createBrowserClient } from "@supabase/ssr";

/**
 * Supabase client for use in Client Components.
 * Requires NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
 * (see .env.example) — "publishable key" is Supabase's current name for
 * what used to be called the anon key; safe to expose to the browser.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  );
}
