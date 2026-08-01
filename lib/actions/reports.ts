"use server";

import { revalidatePath } from "next/cache";
import { store } from "@/lib/mock/store";
import { logAction } from "@/lib/data/audit";

/**
 * AI-generated content must be approved by Secretariat before release, and
 * must never carry an "AI-generated" label anywhere the applicant can see
 * it — the narrative/strengths/improvements below read as a normal
 * assessment once released.
 */
export async function approveAndReleaseReport(
  reportId: string,
  edits: { narrative: string; strengths: string[]; improvements: string[] }
) {
  const report = store.aiReports.find((r) => r.id === reportId);
  if (!report) return { success: false, error: "Report not found." };

  report.narrative = edits.narrative;
  report.strengths = edits.strengths;
  report.improvements = edits.improvements;
  report.status = "approved";
  report.releasedAt = new Date().toISOString();

  const app = store.applications.find((a) => a.id === report.applicationId);
  if (app) app.status = "released";
  const orgName = app ? store.organizations.find((o) => o.id === app.organizationId)?.name : undefined;
  logAction("Funke Adeyemi", "Approved report for", orgName ?? report.applicationId);
  // Mock notification — real email sending is out of scope until NECA provides email service credentials.
  logAction("System", "Sent release-notification email to", orgName ?? report.applicationId);

  revalidatePath("/secretariat/ai-reports");
  revalidatePath("/applicant/report");
  return { success: true };
}

export async function sendBackReport(reportId: string) {
  const report = store.aiReports.find((r) => r.id === reportId);
  if (!report) return { success: false, error: "Report not found." };
  report.status = "sent_back";
  revalidatePath("/secretariat/ai-reports");
  return { success: true };
}
