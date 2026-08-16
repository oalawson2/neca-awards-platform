"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth/session";
import { logAction } from "@/lib/data/audit";
import { isEmailSendFailure } from "@/lib/supabase/errors";

export interface InviteResult {
  success: boolean;
  error?: string;
}

async function requireSecretariat(): Promise<InviteResult | null> {
  const user = await getCurrentUser();
  if (!user || (user.role !== "secretariat" && user.role !== "secretariat_super_admin")) {
    return { success: false, error: "Only Secretariat can invite users." };
  }
  return null;
}

/**
 * GoTrue (Supabase Auth) deliberately doesn't return the underlying SMTP
 * provider's error over the admin API — callers just get a generic
 * "Error sending invite email" / unexpected_failure, regardless of
 * whether the real cause was a bad SMTP password, a network timeout, or
 * (as confirmed live against this project's own auth logs while
 * diagnosing this) Resend's sandbox-mode restriction: with no verified
 * sending domain, Resend only accepts mail addressed to the Resend
 * account owner's own inbox and 550-rejects everyone else. That real
 * reason only shows up in Supabase's own Auth logs (Dashboard -> Logs ->
 * Auth, or mcp__Supabase__get_logs), never in this app's stderr — so we
 * log everything the SDK does hand back here (code/status/message) to at
 * least confirm it's the email-send step failing, and surface a message
 * that names the most likely fix rather than the SDK's opaque one.
 */
function logInviteError(context: string, error: { message: string; code?: string; status?: number }) {
  console.error(`[inviteUser] ${context}:`, { message: error.message, code: error.code, status: error.status });
}

const SEND_FAILURE_MESSAGE =
  "Invite created, but the email didn't send. Most likely cause: Resend is still in sandbox mode " +
  "(no verified sending domain), which only allows mail to the Resend account's own inbox — check " +
  "resend.com/domains and the \"from\" address in Supabase's Auth SMTP settings. For the exact " +
  "underlying error, check Supabase Dashboard -> Logs -> Auth.";

/**
 * Real invite flow (resolved from task #40's deferred design fork now
 * that the service-role key is available): supabase.auth.admin.inviteUserByEmail
 * creates the auth.users row immediately and sends Supabase's own invite
 * email (built-in, separate from this app's not-yet-wired transactional
 * email). The on_auth_user_created trigger fires the instant that row is
 * created and inserts a profiles row with role='applicant' (hardcoded
 * there, can't be spoofed) — immediately promoted to the intended role
 * below via the same admin client, since profiles_update_secretariat
 * would also work for a signed-in secretariat caller but the admin client
 * is already in hand and this avoids a second round trip through RLS.
 *
 * One invite step handles what the mock UI's separate "invite" +
 * "promote" would have needed — inviteUserByEmail's metadata isn't
 * trusted for role (the trigger ignores it), so the explicit update
 * afterward is the only real assignment, not a redundant belt-and-braces
 * step.
 */
export async function inviteUser(input: { name: string; email: string; role: "secretariat" | "jury" }): Promise<InviteResult> {
  const denied = await requireSecretariat();
  if (denied) return denied;

  const email = input.email.trim().toLowerCase();
  const name = input.name.trim();
  if (!email) return { success: false, error: "Email is required." };
  if (!name) return { success: false, error: "Name is required." };

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, { data: { full_name: name } });
  if (error) {
    logInviteError(`inviteUserByEmail failed for ${email}`, error);
    if (error.code === "email_exists" || /already registered/i.test(error.message)) {
      return { success: false, error: "A user with this email already exists." };
    }
    if (isEmailSendFailure(error)) {
      return { success: false, error: SEND_FAILURE_MESSAGE };
    }
    return { success: false, error: error.message };
  }
  if (!data.user) return { success: false, error: "Could not create the invite. Try again." };

  const { error: promoteError } = await admin.from("profiles").update({ role: input.role, full_name: name }).eq("id", data.user.id);
  if (promoteError) {
    console.error(`[inviteUser] role promotion failed for ${email} (user ${data.user.id}):`, promoteError);
    return { success: false, error: "Invite sent, but the role couldn't be set. Contact an engineer to fix this account's role." };
  }

  const actor = await getCurrentUser();
  await logAction(actor?.fullName ?? "Secretariat", `Invited ${input.role}`, name);
  revalidatePath("/secretariat/users");
  return { success: true };
}

export async function resendInvite(userId: string): Promise<InviteResult> {
  const denied = await requireSecretariat();
  if (denied) return denied;

  const admin = createAdminClient();
  const { data: user, error: lookupError } = await admin.auth.admin.getUserById(userId);
  if (lookupError || !user.user?.email) {
    if (lookupError) console.error(`[resendInvite] getUserById failed for ${userId}:`, lookupError);
    return { success: false, error: "User not found." };
  }

  const { error } = await admin.auth.admin.inviteUserByEmail(user.user.email);
  if (error) {
    logInviteError(`resend inviteUserByEmail failed for ${user.user.email}`, error);
    if (isEmailSendFailure(error)) {
      return { success: false, error: SEND_FAILURE_MESSAGE };
    }
    return { success: false, error: error.message };
  }

  const actor = await getCurrentUser();
  await logAction(actor?.fullName ?? "Secretariat", "Resent invite to", user.user.email);
  return { success: true };
}

/** Same as resendInvite, but void-returning so it can be bound directly to a <form action>. */
export async function resendInviteFormAction(userId: string): Promise<void> {
  await resendInvite(userId);
}
