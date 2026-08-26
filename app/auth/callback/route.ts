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
 *
 * The redirect target's origin deliberately comes from
 * NEXT_PUBLIC_SITE_URL (same as requestPasswordReset's own redirectTo,
 * in lib/auth/actions.ts), NOT from `new URL(request.url).origin`.
 * Behind this app's LiteSpeed/Passenger deployment, a route handler's
 * request.url is only built from the incoming Host header when Next's
 * experimental.trustHostHeader is true (it isn't, here) — otherwise Next
 * builds it from the server's own listen hostname, which next.config.ts
 * and deploy.sh deliberately force to the literal string '0.0.0.0' (see
 * the HOSTNAME-bind fix elsewhere in this repo's history) so Passenger
 * can reach it on every interface. That's the right fix for binding, but
 * it means request.url's origin here was never the public site — it was
 * "https://0.0.0.0:<port>", producing a browser-level ERR_ADDRESS_INVALID
 * instead of a normal "link expired" page for every reset-link click.
 */
export async function GET(request: Request) {
  const origin = process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin;
  const { searchParams } = new URL(request.url);
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
