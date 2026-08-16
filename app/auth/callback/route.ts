import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Lands here after a Supabase Auth email link (currently only password
 * recovery — see requestPasswordReset) is clicked. @supabase/ssr's
 * default PKCE flow means the link itself points at Supabase's own
 * verify endpoint, which redirects back here with a `code` once
 * verified; exchanging it here is what turns that into a real session,
 * carried forward via the same cookie-based session every other Server
 * Action in this app already relies on.
 *
 * `next` is only ever trusted as a same-origin relative path — anything
 * else (a bare protocol-relative `//host/...`, or a full external URL)
 * falls back to the default, so this can't be turned into an open
 * redirect via a crafted email link.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const rawNext = searchParams.get("next") ?? "/reset-password";
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/reset-password";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=reset-link-invalid`);
}
