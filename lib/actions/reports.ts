"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/session";
import { logAction } from "@/lib/data/audit";
import { buildShortlistedReportContent, buildNonShortlistedReportContent } from "@/lib/data/reports";

export interface ReportActionResult {
  success: boolean;
  error?: string;
}

async function requireSecretariat(): Promise<ReportActionResult | null> {
  const user = await getCurrentUser();
  if (!user || (user.role !== "secretariat" && user.role !== "secretariat_super_admin")) {
    return { success: false, error: "Only Secretariat can manage reports." };
  }
  return null;
}

/**
 * Generates (or regenerates) the report for an applicant — a genuinely
 * different variant depending on whether they were shortlisted, not a
 * lesser version of the same report (doc section 12). Deterministic from
 * real score data, since no Anthropic API key exists yet to call for
 * real. Never labeled "AI-generated" anywhere the applicant can see it.
 * Upserts into application_reports (task #43's migration) — regenerating
 * resets status to pending_approval and clears any prior release, since
 * new content needs a fresh Secretariat review before it's shown again.
 */
export async function generateReport(applicationId: string): Promise<ReportActionResult> {
  const denied = await requireSecretariat();
  if (denied) return denied;

  const supabase = await createClient();
  const { data: app } = await supabase.from("applications").select("status, organization_id").eq("id", applicationId).maybeSingle();
  if (!app) return { success: false, error: "Application not found." };
  const { data: org } = await supabase.from("organizations").select("name").eq("id", app.organization_id).maybeSingle();

  const isShortlisted = app.status !== "not_shortlisted";
  const kind = isShortlisted ? "shortlisted" : "non_shortlisted";

  let row: { narrative: string | null; strengths: string[]; improvements: string[]; pillarBreakdown: unknown };
  if (isShortlisted) {
    const content = await buildShortlistedReportContent(applicationId);
    row = { narrative: content.narrative, strengths: content.strengths, improvements: content.improvements, pillarBreakdown: content.pillarBreakdown };
  } else {
    const content = await buildNonShortlistedReportContent(applicationId);
    row = { narrative: null, strengths: [], improvements: [], pillarBreakdown: content.pillarSummary };
  }

  const { error } = await supabase.from("application_reports").upsert(
    {
      application_id: applicationId,
      kind,
      status: "pending_approval",
      narrative: row.narrative,
      strengths: row.strengths,
      improvements: row.improvements,
      pillar_breakdown: row.pillarBreakdown,
      reviewed_by: null,
      reviewed_at: null,
      released_at: null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "application_id" }
  );
  if (error) return { success: false, error: "Could not generate report." };

  await logAction("System", "Generated report for", org?.name ?? applicationId);
  revalidatePath("/secretariat/ai-reports");
  revalidatePath(`/secretariat/ai-reports/${applicationId}`);
  return { success: true };
}

export async function approveAndReleaseReport(applicationId: string, approverName: string): Promise<ReportActionResult> {
  const denied = await requireSecretariat();
  if (denied) return denied;

  const user = await getCurrentUser();
  const supabase = await createClient();
  const now = new Date().toISOString();
  const { data: existing } = await supabase.from("application_reports").select("id").eq("application_id", applicationId).maybeSingle();
  if (!existing) return { success: false, error: "No report to approve — generate one first." };

  const { error } = await supabase
    .from("application_reports")
    .update({ status: "approved", reviewed_by: user?.id, reviewed_at: now, released_at: now, updated_at: now })
    .eq("id", existing.id);
  if (error) return { success: false, error: "Could not approve report." };

  const { data: app } = await supabase.from("applications").select("organization_id").eq("id", applicationId).maybeSingle();
  const { data: org } = app ? await supabase.from("organizations").select("name").eq("id", app.organization_id).maybeSingle() : { data: null };

  await logAction(approverName, "Approved and released report for", org?.name ?? applicationId);
  revalidatePath("/secretariat/ai-reports");
  revalidatePath("/applicant/report");
  return { success: true };
}

export async function sendBackReport(applicationId: string, reviewerName: string): Promise<ReportActionResult> {
  const denied = await requireSecretariat();
  if (denied) return denied;

  const supabase = await createClient();
  const { data: existing } = await supabase.from("application_reports").select("id").eq("application_id", applicationId).maybeSingle();
  if (!existing) return { success: false, error: "No report to send back." };

  const { error } = await supabase.from("application_reports").update({ status: "sent_back", updated_at: new Date().toISOString() }).eq("id", existing.id);
  if (error) return { success: false, error: "Could not send report back." };

  const { data: app } = await supabase.from("applications").select("organization_id").eq("id", applicationId).maybeSingle();
  const { data: org } = app ? await supabase.from("organizations").select("name").eq("id", app.organization_id).maybeSingle() : { data: null };

  await logAction(reviewerName, "Sent report back for revision:", org?.name ?? applicationId);
  revalidatePath("/secretariat/ai-reports");
  return { success: true };
}
