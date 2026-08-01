"use server";

import { revalidatePath } from "next/cache";
import { store } from "@/lib/mock/store";
import { logAction } from "@/lib/data/audit";

export interface SubmitResult {
  success: boolean;
  error?: string;
  requiresIncompleteAcknowledgement?: boolean;
  missingDocumentNames?: string[];
}

export async function submitApplication(applicationId: string, acknowledgeIncomplete: boolean): Promise<SubmitResult> {
  const app = store.applications.find((a) => a.id === applicationId);
  if (!app) return { success: false, error: "Application not found." };
  if (app.sectionsCompleted < app.totalSections) {
    return { success: false, error: "Complete every questionnaire section before submitting." };
  }

  const missing = store.documents.filter((d) => d.applicationId === applicationId && d.status === "missing");
  if (missing.length > 0 && !acknowledgeIncomplete) {
    return {
      success: false,
      requiresIncompleteAcknowledgement: true,
      missingDocumentNames: missing.map((d) => d.name),
    };
  }

  app.status = missing.length > 0 ? "incomplete" : "awaiting_review";
  app.submittedAt = new Date().toISOString();

  const orgName = store.organizations.find((o) => o.id === app.organizationId)?.name ?? app.id;
  logAction(orgName, "Submitted application", app.referenceNo);

  revalidatePath("/applicant");
  revalidatePath("/secretariat");
  return { success: true };
}

/**
 * No explicit "mark reviewed" control appears in the wireframes' Application
 * Detail screen (10) — it only shows Responses/Documents/Score Breakdown
 * tabs. This action is a judgment call filling that gap: Secretariat
 * assigns the completeness (preliminary) score here, and advancement to
 * jury scoring happens automatically against the configured threshold.
 */
export async function reviewAndSetPreliminaryScore(applicationId: string, score: number) {
  const app = store.applications.find((a) => a.id === applicationId);
  if (!app) return { success: false, error: "Application not found." };

  app.preliminaryScore = score;
  app.status = score >= store.settings.advancementThresholdScore ? "scoring" : "incomplete";

  const orgName = store.organizations.find((o) => o.id === app.organizationId)?.name ?? app.id;
  logAction("Funke Adeyemi", `Set preliminary score (${score}) for`, orgName);

  revalidatePath("/secretariat");
  revalidatePath(`/secretariat/applications/${applicationId}`);
  return { success: true };
}
