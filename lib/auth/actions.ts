"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logAction } from "@/lib/data/audit";
import { isEmailSendFailure } from "@/lib/supabase/errors";
import { TERMS_VERSION } from "@/lib/terms";
import type { UserRole } from "@/types/auth";

export interface AuthResult {
  success: boolean;
  error?: string;
  role?: UserRole;
  /**
   * True when the account was created but Supabase Auth's own signup
   * confirmation email (built into Supabase, separate from — and
   * unaffected by — this app's not-yet-wired transactional email system)
   * hasn't been confirmed yet. No profile row exists yet in this case; see
   * ensureProfile()'s docstring for why that's deferred to first sign-in.
   */
  needsEmailConfirmation?: boolean;
}

/**
 * Creates the caller's own `profiles` row if one doesn't already exist,
 * always with role='applicant' — the only role the `profiles_insert_own_applicant`
 * RLS policy permits a user to self-insert (secretariat/jury are promoted
 * later by an existing secretariat user, never self-assigned; see
 * lib/actions/users.ts).
 *
 * In practice a DB trigger (`on_auth_user_created` -> `handle_new_auth_user()`)
 * already creates this row synchronously as part of the auth.users insert,
 * so the select below normally finds it immediately and the insert path
 * never runs. It's kept as a defensive fallback (and hardened against the
 * trigger having won a race — PostgREST surfaces that as a 23505 unique
 * violation, which is treated as success, not an error) rather than removed,
 * since nothing here depends on the trigger continuing to exist.
 *
 * Called from both signUpApplicant and signIn because whether signUp()
 * itself yields an authenticated session depends on whether this Supabase
 * project has email confirmation enabled — that's project-level config
 * this codebase can't see or control, so instead of guessing, the account
 * is finished setting up the first time we genuinely have an authenticated
 * session for it, whichever call that turns out to be.
 */
async function ensureProfile(
  supabase: Awaited<ReturnType<typeof createClient>>,
  user: { id: string; email: string }
): Promise<{ role: UserRole } | { error: string }> {
  // Collected regardless of outcome, and only ever surfaced (via
  // logAction below) if every recovery path below still fails — the
  // generic user-facing message never changes, but whoever's diagnosing
  // it gets the real Postgres error without needing server log access.
  // The exact class of bug this exists for (an RLS helper function
  // losing its EXECUTE grant, surfacing as "permission denied for
  // function X" here even though the row demonstrably exists) has
  // already happened twice.
  const diagnostics: string[] = [];

  const { data: existing, error: selectError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (selectError) diagnostics.push(`select: ${selectError.code} ${selectError.message}`);
  if (existing) return { role: existing.role };

  const { data: created, error } = await supabase
    .from("profiles")
    .insert({ id: user.id, email: user.email, full_name: user.email.split("@")[0], role: "applicant" })
    .select("role")
    .single();
  if (created) return { role: created.role };
  if (error) diagnostics.push(`insert: ${error.code} ${error.message}`);

  if (error?.code === "23505") {
    // Lost a race with the trigger between our select and insert — the row
    // exists now, so re-read it instead of treating this as a failure.
    const { data: refetched, error: refetchError } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
    if (refetchError) diagnostics.push(`refetch: ${refetchError.code} ${refetchError.message}`);
    if (refetched) return { role: refetched.role };
  }

  const detail = diagnostics.join(" | ") || "no error details captured";
  console.error("[ensureProfile] failed for", user.email, user.id, "-", detail);
  // Service-role write (bypasses RLS) so this lands even when the failure
  // itself is an RLS/permission problem on the caller's own session —
  // visible to Secretariat at /secretariat/audit-log, no server access
  // needed to diagnose.
  await logAction("System", "Profile setup failed for", `${user.email} (${user.id}) — ${detail}`);

  return { error: "Your account was created but we couldn't finish setting it up. Contact the Secretariat." };
}

/** Real Supabase Auth sign-in. Self-heals a missing profile row (see ensureProfile). */
export async function signIn(email: string, password: string): Promise<AuthResult> {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail || !password) {
    return { success: false, error: "Enter your email and password." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
  if (error || !data.user) {
    return { success: false, error: "Incorrect email or password." };
  }

  const profileResult = await ensureProfile(supabase, { id: data.user.id, email: data.user.email ?? normalizedEmail });
  if ("error" in profileResult) {
    return { success: false, error: profileResult.error };
  }
  return { success: true, role: profileResult.role };
}

export interface SignUpInput {
  email: string;
  password: string;
  confirmPassword: string;
  agreeToTerms: boolean;
}

/**
 * Applicant self-registration only — secretariat/jury accounts are never
 * created here (see lib/actions/users.ts for how those are provisioned).
 *
 * Deliberately does NOT create an organizations/applications row (unlike
 * the mock-phase version this replaces): organizations has several NOT
 * NULL columns (sector_id, org_size_tier, contact_name, etc.) with no
 * sensible blank default, and rc_number/contact_email are both unique, so
 * a placeholder row would either violate constraints or collide across
 * applicants. Section A (Eligibility & Registration) creates the real
 * organization + draft application on first save instead.
 */
export async function signUpApplicant(input: SignUpInput): Promise<AuthResult> {
  const email = input.email.trim().toLowerCase();
  if (!email || !input.password) {
    return { success: false, error: "Email and password are required." };
  }
  if (input.password !== input.confirmPassword) {
    return { success: false, error: "Passwords do not match." };
  }
  if (!input.agreeToTerms) {
    return { success: false, error: "You must agree to the Data Privacy Statement and Terms of Participation." };
  }

  // Recorded in auth.users.user_metadata (via signUp's options.data) rather
  // than a profiles column — there isn't one for this yet. profiles has no
  // terms-acceptance field, and organizations.eligibility_declarations is a
  // different, later-in-the-flow agreement (Section A's legal/tax/sanction
  // declarations), not this signup-time one, so it isn't a fit either. This
  // still durably records the fact (queryable via the admin API or
  // auth.users.raw_user_meta_data directly), it's just not joinable through
  // the regular profiles reads the rest of the app uses. A dedicated
  // profiles.terms_accepted_at (+ terms_version) column would be the
  // cleaner permanent home if one gets added.
  const termsAcceptedAt = new Date().toISOString();

  // Without an explicit emailRedirectTo, Supabase falls back to whatever
  // "Site URL" is configured in its own dashboard (Authentication -> URL
  // Configuration) — a setting this codebase can't see or control, and
  // which may not even point at /auth/callback. Set explicitly here for
  // the same reason requestPasswordReset already does below: so this
  // flow's confirmation link is guaranteed to exchange its code through
  // this app's own /auth/callback (see that route for what happens once
  // it lands there) rather than depend on external, out-of-repo config.
  //
  // next=/login, not /applicant/profile: confirming an email only proves
  // the address is real, not that the person at the keyboard right now
  // is the account owner — same reasoning as password reset, which lands
  // on /reset-password (an actual form) rather than straight into the
  // app. The session /auth/callback establishes here is real (cookies
  // set, same as any other), but ensureProfile() — the only thing that
  // ever creates this user's profiles row — is never called by
  // /auth/callback, only by signIn() and by this function's own
  // immediate-session branch below. proxy.ts's role-gated redirects
  // (including the one that would otherwise bounce a signed-in user away
  // from /login into their portal) all key off that profiles row, so a
  // confirmation-only session with no row yet resolves to role=null and
  // /login renders its real form — confirmed by reading proxy.ts's and
  // getCurrentUser()'s full logic, both unconditional on this point, and
  // by login-form.tsx itself, which only ever establishes a session by
  // submitting real credentials through signIn(), never by reusing one.
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "";
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password: input.password,
    options: {
      data: { terms_accepted_at: termsAcceptedAt, terms_version: TERMS_VERSION },
      emailRedirectTo: `${siteUrl}/auth/callback?next=${encodeURIComponent("/login")}`,
    },
  });
  if (error) {
    return { success: false, error: error.message };
  }
  if (!data.user) {
    return { success: false, error: "Could not create your account. Try again." };
  }

  if (!data.session) {
    // Email confirmation is required before this session is usable — no
    // profiles row can be inserted yet (RLS's WITH CHECK needs auth.uid()
    // to resolve, which requires an authenticated session, not just a
    // created auth.users row). ensureProfile() runs on their first
    // sign-in instead, once they've confirmed and actually have one.
    return { success: true, needsEmailConfirmation: true };
  }

  const profileResult = await ensureProfile(supabase, { id: data.user.id, email: data.user.email ?? email });
  if ("error" in profileResult) {
    return { success: false, error: profileResult.error };
  }
  return { success: true, role: profileResult.role };
}

export interface PasswordResetResult {
  success: boolean;
  error?: string;
}

/**
 * Real Supabase Auth password recovery. Always returns success on a
 * well-formed email, whether or not an account exists for it — that's
 * Supabase's own behavior (resetPasswordForEmail doesn't distinguish
 * "no such user" from "sent"), and this preserves it rather than probing
 * for a distinguishable error, so the form can't be used to enumerate
 * registered emails. Genuine failures (rate limiting, SMTP misconfigured)
 * still surface via `error`.
 *
 * The email links to /auth/callback?next=/reset-password — Supabase's
 * PKCE flow (the @supabase/ssr default) means the link itself points at
 * Supabase's own verify endpoint, which redirects here with a `code` once
 * verified; the callback route exchanges that for the session
 * /reset-password needs to actually call updateUser().
 */
export async function requestPasswordReset(email: string): Promise<PasswordResetResult> {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) return { success: false, error: "Enter your email address." };

  const supabase = await createClient();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "";
  const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
    redirectTo: `${siteUrl}/auth/callback?next=${encodeURIComponent("/reset-password")}`,
  });
  if (error) {
    console.error("[requestPasswordReset] failed for", normalizedEmail, "-", {
      message: error.message,
      code: error.code,
      status: error.status,
    });
    if (isEmailSendFailure(error)) {
      return {
        success: false,
        error:
          "The reset link couldn't be sent. Most likely cause: Resend is still in sandbox mode " +
          "(no verified sending domain), which only allows mail to the Resend account's own inbox — check " +
          "resend.com/domains and the \"from\" address in Supabase's Auth SMTP settings. For the exact " +
          "underlying error, check Supabase Dashboard -> Logs -> Auth.",
      };
    }
    return { success: false, error: error.message };
  }
  return { success: true };
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
