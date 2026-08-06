"use server";

import { revalidatePath } from "next/cache";
import { store } from "@/lib/mock/store";
import { logAction } from "@/lib/data/audit";
import { PILLARS } from "@/lib/mock/framework";
import { computeStage1Score, effectiveItemsForOrg } from "@/lib/scoring/stage1";

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
 */
export async function submitStage1Application(applicationId: string): Promise<SubmitStage1Result> {
  const app = store.applications.find((a) => a.id === applicationId);
  if (!app) return { success: false, error: "Application not found." };
  const org = store.organizations.find((o) => o.id === app.organizationId);
  if (!org) return { success: false, error: "Organisation not found." };

  if (!org.name.trim() || !org.rcNumber.trim()) {
    return { success: false, error: "Complete Section A (organisation profile) before submitting." };
  }

  const items = effectiveItemsForOrg(org.isUnionised);
  const answers = store.answers.filter((a) => a.applicationId === applicationId);
  const answered = new Set(answers.filter((a) => a.isNA || a.value !== null).map((a) => a.itemId));
  const outstandingQuestions = items.filter((i) => !answered.has(i.id)).map((i) => `${i.id} — ${i.prompt}`);

  const mandatoryDocs = store.documents.filter((d) => d.applicationId === applicationId && d.track === "mandatory");
  const outstandingDocuments = mandatoryDocs.filter((d) => d.status !== "uploaded").map((d) => d.name);

  if (outstandingQuestions.length > 0 || outstandingDocuments.length > 0) {
    return {
      success: false,
      error: "Your application is incomplete.",
      outstandingQuestions: outstandingQuestions.length > 0 ? outstandingQuestions : undefined,
      outstandingDocuments: outstandingDocuments.length > 0 ? outstandingDocuments : undefined,
    };
  }

  const { overallScore } = computeStage1Score(PILLARS, org.isUnionised, answers, store.benchmarkBands, org.sectorId);
  app.stage1Score = overallScore;
  app.status = "submitted";
  app.submittedAt = new Date().toISOString();

  logAction(org.name, "Submitted Stage 1 application for", org.name);
  revalidatePath("/applicant");
  revalidatePath("/applicant/review");
  revalidatePath("/secretariat");
  return { success: true };
}
