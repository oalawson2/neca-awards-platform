"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { logAction } from "@/lib/data/audit";
import { getAnswers, getEffectiveItemsForApplication } from "@/lib/data/answers";
import { getDocuments } from "@/lib/data/checklist";
import { PILLARS } from "@/lib/mock/framework";
import { computeStage1Score } from "@/lib/scoring/stage1";

export interface SubmitStage1Result {
  success: boolean;
  error?: string;
  outstandingQuestions?: string[];
  outstandingDocuments?: string[];
}

/**
 * Stage 1 submission gate (doc section 10/13): every effective B–I item
 * must be answered (or marked N/A with a justification), and every
 * Mandatory checklist item must be uploaded — Advanced items may be left
 * pending. On success, computes and stores the Stage 1 score (used only
 * for shortlist ranking — see lib/scoring/stage1.ts) and moves the
 * application to "submitted".
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

  const { data: app } = await supabase.from("applications").select("organization_id").eq("id", applicationId).maybeSingle();
  if (!app) return { success: false, error: "Application not found." };

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

  const mandatoryDocs = documents.filter((d) => d.track === "mandatory");
  const outstandingDocuments = mandatoryDocs.filter((d) => d.status !== "uploaded").map((d) => d.name);

  if (outstandingQuestions.length > 0 || outstandingDocuments.length > 0) {
    return {
      success: false,
      error: "Your application is incomplete.",
      outstandingQuestions: outstandingQuestions.length > 0 ? outstandingQuestions : undefined,
      outstandingDocuments: outstandingDocuments.length > 0 ? outstandingDocuments : undefined,
    };
  }

  const { overallScore } = computeStage1Score(PILLARS, org.is_unionised, answers, [], org.sector_id);

  const { error: updateError } = await supabase
    .from("applications")
    .update({ stage1_score: overallScore, status: "submitted", submitted_at: new Date().toISOString() })
    .eq("id", applicationId);
  if (updateError) return { success: false, error: "Could not submit — try again." };

  await logAction(org.name, "Submitted Stage 1 application for", org.name);
  revalidatePath("/applicant");
  revalidatePath("/applicant/review");
  revalidatePath("/secretariat");
  return { success: true };
}
