"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/session";
import { logAction } from "@/lib/data/audit";

export interface ResultsReleaseResult {
  success: boolean;
  error?: string;
}

/**
 * The explicit "Close Applications & Release Results" action — distinct
 * from Apply Shortlist (lib/actions/shortlisting.ts), which only computes
 * and stores each application's shortlisted/not_shortlisted status. That
 * status is set the moment Apply Shortlist runs, per sector, potentially
 * well before every sector's shortlist is finalized — but the applicant
 * dashboard (app/(portals)/applicant/page.tsx) only shows a
 * shortlisted/not_shortlisted outcome once this flag is set, regardless
 * of how long the underlying status has already been sitting in the
 * database. That's the deliberate gap this exists to hold open: Secretariat
 * can run shortlisting per sector at whatever pace makes sense and only
 * flip this once every sector's outcome is ready to go out together.
 */
export async function releaseResults(): Promise<ResultsReleaseResult> {
  const user = await getCurrentUser();
  if (!user || (user.role !== "secretariat" && user.role !== "secretariat_super_admin")) {
    return { success: false, error: "Only Secretariat can release results." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("platform_settings")
    .update({ results_released_at: new Date().toISOString(), results_released_by: user.id })
    .eq("id", true);
  if (error) return { success: false, error: "Could not release results." };

  await logAction(user.fullName || user.email, "Closed applications and released results", "Platform-wide");
  revalidatePath("/applicant");
  revalidatePath("/secretariat/settings");
  return { success: true };
}

/** Undo, in case results were released by mistake — puts applicants back to the pre-release view. */
export async function unreleaseResults(): Promise<ResultsReleaseResult> {
  const user = await getCurrentUser();
  if (!user || (user.role !== "secretariat" && user.role !== "secretariat_super_admin")) {
    return { success: false, error: "Only Secretariat can change this." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("platform_settings").update({ results_released_at: null, results_released_by: null }).eq("id", true);
  if (error) return { success: false, error: "Could not undo release." };

  await logAction(user.fullName || user.email, "Reversed results release", "Platform-wide");
  revalidatePath("/applicant");
  revalidatePath("/secretariat/settings");
  return { success: true };
}
