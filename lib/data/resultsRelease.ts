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
