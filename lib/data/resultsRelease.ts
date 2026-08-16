import { createClient } from "@/lib/supabase/server";

/**
 * Whether shortlist results are visible to applicants yet — separate
 * from applications.status itself, which Apply Shortlist sets as soon
 * as it runs. See lib/actions/resultsRelease.ts for why these are kept
 * distinct.
 */
export async function getResultsReleaseStatus(): Promise<{ releasedAt: string | null }> {
  const supabase = await createClient();
  const { data } = await supabase.from("platform_settings").select("results_released_at").eq("id", true).maybeSingle();
  return { releasedAt: data?.results_released_at ?? null };
}

/**
 * Whether new applications can be created — independent of
 * results_released_at (see getResultsReleaseStatus). Only blocks new
 * `applications` INSERTs (applications_insert_own RLS); an applicant
 * already partway through a draft is unaffected.
 */
export async function getApplicationsClosedStatus(): Promise<{ closedAt: string | null }> {
  const supabase = await createClient();
  const { data } = await supabase.from("platform_settings").select("applications_closed_at").eq("id", true).maybeSingle();
  return { closedAt: data?.applications_closed_at ?? null };
}
