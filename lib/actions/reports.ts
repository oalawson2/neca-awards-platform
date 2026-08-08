"use server";

import { revalidatePath } from "next/cache";
import { store, generateId } from "@/lib/mock/store";
import { logAction } from "@/lib/data/audit";
import { buildShortlistedReportContent, buildNonShortlistedReportContent } from "@/lib/data/reports";

/**
 * Generates (or regenerates) the report for an applicant — a genuinely
 * different variant depending on whether they were shortlisted, not a
 * lesser version of the same report (doc section 12). Mock generation:
 * deterministic from real score data, since no Anthropic API key exists
 * yet to call for real. Never labeled "AI-generated" anywhere the
 * applicant can see it, carried forward from the earlier decision.
 */
export async function generateReport(applicationId: string) {
  const app = store.applications.find((a) => a.id === applicationId);
  if (!app) return { success: false, error: "Application not found." };
  const org = store.organizations.find((o) => o.id === app.organizationId)!;

  if (app.isShortlisted) {
    const content = await buildShortlistedReportContent(applicationId);
    const existing = store.shortlistedReports.find((r) => r.applicationId === applicationId);
    if (existing) {
      Object.assign(existing, content, { status: "pending_approval" });
    } else {
      store.shortlistedReports.push({
        id: generateId("report"),
        applicationId,
        status: "pending_approval",
        ...content,
        createdAt: new Date().toISOString(),
        releasedAt: null,
      });
    }
  } else {
    const content = await buildNonShortlistedReportContent(applicationId);
    const existing = store.nonShortlistedReports.find((r) => r.applicationId === applicationId);
    if (existing) {
      Object.assign(existing, content, { status: "pending_approval" });
    } else {
      store.nonShortlistedReports.push({
        id: generateId("report"),
        applicationId,
        status: "pending_approval",
        ...content,
        createdAt: new Date().toISOString(),
        releasedAt: null,
      });
    }
  }

  logAction("System", "Generated report for", org.name);
  revalidatePath("/secretariat/ai-reports");
  revalidatePath(`/secretariat/ai-reports/${applicationId}`);
  return { success: true };
}

export async function approveAndReleaseReport(applicationId: string, approverName: string) {
  const app = store.applications.find((a) => a.id === applicationId);
  if (!app) return { success: false, error: "Application not found." };
  const org = store.organizations.find((o) => o.id === app.organizationId)!;

  const now = new Date().toISOString();
  if (app.isShortlisted) {
    const report = store.shortlistedReports.find((r) => r.applicationId === applicationId);
    if (!report) return { success: false, error: "No report to approve — generate one first." };
    report.status = "approved";
    report.releasedAt = now;
  } else {
    const report = store.nonShortlistedReports.find((r) => r.applicationId === applicationId);
    if (!report) return { success: false, error: "No report to approve — generate one first." };
    report.status = "approved";
    report.releasedAt = now;
  }
  app.status = "released";

  logAction(approverName, "Approved and released report for", org.name);
  revalidatePath("/secretariat/ai-reports");
  revalidatePath("/applicant/report");
  return { success: true };
}

export async function sendBackReport(applicationId: string, reviewerName: string) {
  const app = store.applications.find((a) => a.id === applicationId);
  if (!app) return { success: false, error: "Application not found." };
  const org = store.organizations.find((o) => o.id === app.organizationId)!;

  const report = app.isShortlisted
    ? store.shortlistedReports.find((r) => r.applicationId === applicationId)
    : store.nonShortlistedReports.find((r) => r.applicationId === applicationId);
  if (!report) return { success: false, error: "No report to send back." };
  report.status = "sent_back";

  logAction(reviewerName, "Sent report back for revision:", org.name);
  revalidatePath("/secretariat/ai-reports");
  return { success: true };
}
