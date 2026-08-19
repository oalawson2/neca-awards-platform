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
    return { success: false, error: "Only Secretariat can manage users." };
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

/**
 * Edits an existing Secretariat/jury account's name and role. Deliberately
 * doesn't touch email (a Supabase Auth identity change, a bigger and
 * riskier operation than "edit basic details" asked for) or
 * secretariat_super_admin (a more sensitive elevated flag, not part of
 * this UI). Uses the admin client for both writes since profiles_update_secretariat
 * would cover the profiles row but auth.users' user_metadata.full_name
 * (kept in sync so it doesn't drift from a stale value if this account is
 * ever re-invited) needs the admin API either way.
 */
export async function editUser(userId: string, input: { name: string; role: "secretariat" | "jury" }): Promise<InviteResult> {
  const denied = await requireSecretariat();
  if (denied) return denied;

  const name = input.name.trim();
  if (!name) return { success: false, error: "Name is required." };

  const admin = createAdminClient();
  const { data: existing } = await admin.from("profiles").select("role").eq("id", userId).maybeSingle();
  if (!existing) return { success: false, error: "User not found." };
  // secretariat_super_admin isn't one of the two roles this form offers,
  // so writing input.role verbatim would silently demote a super admin to
  // a regular Secretariat account the moment anyone edited their name.
  const role = existing.role === "secretariat_super_admin" ? "secretariat_super_admin" : input.role;

  const { error } = await admin.from("profiles").update({ full_name: name, role }).eq("id", userId);
  if (error) return { success: false, error: "Could not save changes." };

  await admin.auth.admin.updateUserById(userId, { user_metadata: { full_name: name } });

  const actor = await getCurrentUser();
  await logAction(actor?.fullName ?? "Secretariat", "Updated user", name);
  revalidatePath("/secretariat/users");
  return { success: true };
}

/**
 * Deactivation, not deletion (see PR discussion): juror_scores, audit_log,
 * panel_memberships, interviews.requested_by and others all reference
 * profiles by id, so a hard delete would either orphan historical records
 * or fail outright on the FK. profiles.deactivated_at is the record of
 * record; the auth-level ban (ban_duration: '876000h' — GoTrue's own
 * documented pattern for an effectively-permanent ban, there's no literal
 * "forever" value) additionally blocks this account from signing in again
 * at all, belt-and-braces alongside deactivated_at being checked on every
 * request by getCurrentUser()/proxy.ts. Refuses to let a Secretariat user
 * deactivate their own account — the whole point of this screen is
 * Secretariat managing *other* accounts, and self-deactivation has no real
 * use case here beyond an admin accidentally locking themselves out.
 */
export async function deactivateUser(userId: string): Promise<InviteResult> {
  const denied = await requireSecretariat();
  if (denied) return denied;

  const actor = await getCurrentUser();
  if (actor?.id === userId) return { success: false, error: "You can't deactivate your own account." };

  const admin = createAdminClient();
  const { data: existing } = await admin.from("profiles").select("full_name").eq("id", userId).maybeSingle();
  if (!existing) return { success: false, error: "User not found." };

  const { error } = await admin.from("profiles").update({ deactivated_at: new Date().toISOString() }).eq("id", userId);
  if (error) return { success: false, error: "Could not deactivate this account." };

  await admin.auth.admin.updateUserById(userId, { ban_duration: "876000h" });

  await logAction(actor?.fullName ?? "Secretariat", "Deactivated user", existing.full_name);
  revalidatePath("/secretariat/users");
  return { success: true };
}

/** Reverses deactivateUser: clears deactivated_at and lifts the auth-level ban. */
export async function reactivateUser(userId: string): Promise<InviteResult> {
  const denied = await requireSecretariat();
  if (denied) return denied;

  const admin = createAdminClient();
  const { data: existing } = await admin.from("profiles").select("full_name").eq("id", userId).maybeSingle();
  if (!existing) return { success: false, error: "User not found." };

  const { error } = await admin.from("profiles").update({ deactivated_at: null }).eq("id", userId);
  if (error) return { success: false, error: "Could not reactivate this account." };

  await admin.auth.admin.updateUserById(userId, { ban_duration: "none" });

  const actor = await getCurrentUser();
  await logAction(actor?.fullName ?? "Secretariat", "Reactivated user", existing.full_name);
  revalidatePath("/secretariat/users");
  return { success: true };
}
