"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/session";
import { logAction } from "@/lib/data/audit";

export interface ResultsReleaseResult {
  success: boolean;
  error?: string;
}

async function requireSecretariat() {
  const user = await getCurrentUser();
  if (!user || (user.role !== "secretariat" && user.role !== "secretariat_super_admin")) {
    return { user: null, denied: { success: false, error: "Only Secretariat can change this." } as ResultsReleaseResult };
  }
  return { user, denied: null };
}

/**
 * The explicit "release results" action — distinct from Apply Shortlist
 * (lib/actions/shortlisting.ts), which only computes and stores each
 * application's shortlisted/not_shortlisted status. That status is set
 * the moment Apply Shortlist runs, per sector, potentially well before
 * every sector's shortlist is finalized — but the applicant dashboard
 * (app/(portals)/applicant/page.tsx) only shows a shortlisted/
 * not_shortlisted outcome once this flag is set, regardless of how long
 * the underlying status has already been sitting in the database. That's
 * the deliberate gap this exists to hold open: Secretariat can run
 * shortlisting per sector at whatever pace makes sense and only flip
 * this once every sector's outcome is ready to go out together.
 *
 * Independent of closeApplications/reopenApplications below — releasing
 * results has never required applications to be closed first, and that
 * stays true now that closing is a real, separate hard stop (see that
 * function's docstring for why they were briefly conflated in one control
 * and why that was wrong).
 */
export async function releaseResults(): Promise<ResultsReleaseResult> {
  const { user, denied } = await requireSecretariat();
  if (denied) return denied;

  const supabase = await createClient();
  const { error } = await supabase
    .from("platform_settings")
    .update({ results_released_at: new Date().toISOString(), results_released_by: user.id })
    .eq("id", true);
  if (error) return { success: false, error: "Could not release results." };

  await logAction(user.fullName || user.email, "Released results", "Platform-wide");
  revalidatePath("/applicant");
  revalidatePath("/secretariat/settings");
  return { success: true };
}

/** Undo, in case results were released by mistake — puts applicants back to the pre-release view. */
export async function unreleaseResults(): Promise<ResultsReleaseResult> {
  const { user, denied } = await requireSecretariat();
  if (denied) return denied;

  const supabase = await createClient();
  const { error } = await supabase.from("platform_settings").update({ results_released_at: null, results_released_by: null }).eq("id", true);
  if (error) return { success: false, error: "Could not undo release." };

  await logAction(user.fullName || user.email, "Reversed results release", "Platform-wide");
  revalidatePath("/applicant");
  revalidatePath("/secretariat/settings");
  return { success: true };
}

/**
 * A real hard stop on new applications (applications_insert_own RLS
 * checks platform_settings.applications_closed_at directly) — distinct
 * from, and independent of, releaseResults above. Only blocks creating a
 * new `applications` row; an applicant already partway through a draft
 * keeps editing and submitting normally (applications_update_own_draft
 * has no such check).
 */
export async function closeApplications(): Promise<ResultsReleaseResult> {
  const { user, denied } = await requireSecretariat();
  if (denied) return denied;

  const supabase = await createClient();
  const { error } = await supabase
    .from("platform_settings")
    .update({ applications_closed_at: new Date().toISOString(), applications_closed_by: user.id })
    .eq("id", true);
  if (error) return { success: false, error: "Could not close applications." };

  await logAction(user.fullName || user.email, "Closed applications to new entrants", "Platform-wide");
  revalidatePath("/applicant/profile");
  revalidatePath("/secretariat/settings");
  return { success: true };
}

/** Reopen — e.g. a deadline extension. */
export async function reopenApplications(): Promise<ResultsReleaseResult> {
  const { user, denied } = await requireSecretariat();
  if (denied) return denied;

  const supabase = await createClient();
  const { error } = await supabase
    .from("platform_settings")
    .update({ applications_closed_at: null, applications_closed_by: null })
    .eq("id", true);
  if (error) return { success: false, error: "Could not reopen applications." };

  await logAction(user.fullName || user.email, "Reopened applications to new entrants", "Platform-wide");
  revalidatePath("/applicant/profile");
  revalidatePath("/secretariat/settings");
  return { success: true };
}
