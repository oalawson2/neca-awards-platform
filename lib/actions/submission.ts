"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAction } from "@/lib/data/audit";
import { getAnswers, getEffectiveItemsForApplication } from "@/lib/data/answers";
import { getDocuments } from "@/lib/data/checklist";
import { PILLARS } from "@/lib/mock/framework";
import { computeStage1Score } from "@/lib/scoring/stage1";

export interface SubmitStage1Result {
  success: boolean;
  error?: string;
  outstandingQuestions?: string[];
  /** True on a successful submit where at least one required document (any track) was still missing — surfaced so the UI can tell the applicant it was flagged for review, not silently dropped. */
  flaggedForMissingDocuments?: boolean;
}

/**
 * `eligibility_reviews` has no INSERT policy for applicants (only
 * `eligibility_reviews_secretariat`, gated on is_secretariat()) — same
 * constraint as saveOrganizationProfile's syncEligibilityReview
 * (lib/actions/registration.ts), and the same fix: service-role client
 * for just this write, applicant-visible signal (eligibility_review_needed)
 * still set through the caller's own normal RLS-scoped update.
 */
async function flagMissingDocumentsForReview(applicationId: string) {
  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("eligibility_reviews")
    .select("id")
    .eq("application_id", applicationId)
    .eq("status", "pending")
    .eq("reason", "missing_documents")
    .maybeSingle();
  if (!existing) {
    await admin.from("eligibility_reviews").insert({ application_id: applicationId, reason: "missing_documents", status: "pending" });
  }
}

/**
 * Stage 1 submission gate (doc section 10/13, revised): every effective
 * B–I item must be answered (or marked N/A with a justification) — that
 * part still hard-blocks submission. Documents no longer do: an applicant
 * can submit with Mandatory or Advanced documents still missing. Instead,
 * a missing document at submission time flags the application for
 * Secretariat review via the same eligibility_reviews mechanism
 * registration.ts uses for a failed declaration, and submission still
 * proceeds — the applicant sees a message that missing documents will be
 * reviewed separately, not a block.
 *
 * Also guards against re-submitting an application that's already left
 * "draft" — previously this had no status check at all, so navigating
 * back to /applicant/review after being shortlisted (or later) and
 * clicking Submit again would silently recompute stage1_score and reset
 * submitted_at. Answers themselves are already locked at the RLS level
 * (responses_write_own_draft requires status = 'draft'), this just gives
 * this specific action the same guard explicitly rather than relying on
 * every write inside it to fail piecemeal.
 *
 * benchmark_bands is empty by design (real Secretariat configuration work
 * not yet done — see task #14's scope notes), so percentage/numeric items
 * without a configured band score 0 for now rather than failing outright;
 * this matches how the scoring engine has always handled an unconfigured
 * band (itemScorePercent -> benchmarkScorePercent returns 0), not new
 * behavior introduced here.
 */
export async function submitStage1Application(applicationId: string): Promise<SubmitStage1Result> {
  const supabase = await createClient();

  const { data: app } = await supabase.from("applications").select("organization_id, status").eq("id", applicationId).maybeSingle();
  if (!app) return { success: false, error: "Application not found." };
  if (app.status !== "draft") {
    return { success: false, error: "This application has already been submitted and can't be submitted again." };
  }

  const { data: org } = await supabase
    .from("organizations")
    .select("id, name, rc_number, sector_id, is_unionised")
    .eq("id", app.organization_id)
    .maybeSingle();
  if (!org) return { success: false, error: "Organisation not found." };
  if (!org.name?.trim() || !org.rc_number?.trim()) {
    return { success: false, error: "Complete Section A (organisation profile) before submitting." };
  }

  const [items, answers, documents] = await Promise.all([
    getEffectiveItemsForApplication(applicationId),
    getAnswers(applicationId),
    getDocuments(applicationId),
  ]);

  const answered = new Set(answers.filter((a) => a.isNA || a.value !== null).map((a) => a.itemId));
  const outstandingQuestions = items.filter((i) => !answered.has(i.id)).map((i) => `${i.id} — ${i.prompt}`);

  if (outstandingQuestions.length > 0) {
    return {
      success: false,
      error: "Your application is incomplete.",
      outstandingQuestions,
    };
  }

  const missingDocuments = documents.filter((d) => d.status !== "uploaded");

  const { overallScore } = computeStage1Score(PILLARS, org.is_unionised, answers, [], org.sector_id);

  const updatePayload: { stage1_score: number; status: "submitted"; submitted_at: string; eligibility_review_needed?: boolean } = {
    stage1_score: overallScore,
    status: "submitted",
    submitted_at: new Date().toISOString(),
  };
  if (missingDocuments.length > 0) updatePayload.eligibility_review_needed = true;

  const { error: updateError } = await supabase.from("applications").update(updatePayload).eq("id", applicationId);
  if (updateError) return { success: false, error: "Could not submit — try again." };

  if (missingDocuments.length > 0) await flagMissingDocumentsForReview(applicationId);

  await logAction(org.name, "Submitted Stage 1 application for", org.name);
  revalidatePath("/applicant");
  revalidatePath("/applicant/review");
  revalidatePath("/secretariat");
  return { success: true, flaggedForMissingDocuments: missingDocuments.length > 0 };
}
