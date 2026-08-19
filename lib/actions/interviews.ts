"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/session";
import { logAction } from "@/lib/data/audit";
import { sendEmail } from "@/lib/email/send";
import { getStage2aReviewerIds } from "@/lib/data/interviews";
import { getShortlistedApplicationsForPanel } from "@/lib/data/panels";
import { itemById } from "@/lib/mock/framework";
import type { PillarCode } from "@/types/domain";

async function orgForApplication(supabase: Awaited<ReturnType<typeof createClient>>, applicationId: string) {
  const { data: app } = await supabase.from("applications").select("organization_id").eq("id", applicationId).maybeSingle();
  if (!app) return null;
  const { data: org } = await supabase.from("organizations").select("name, contact_email").eq("id", app.organization_id).maybeSingle();
  return org;
}

export interface BulkInterviewRequestResult {
  success: boolean;
  error?: string;
  requestedCount?: number;
  alreadyRequestedCount?: number;
}

/**
 * Secretariat-initiated, per-panel, bulk — supersedes the old juror-
 * initiated, per-applicant requestInterview. That version gated on the
 * requesting juror having finished their own Stage 2a document review
 * (doc section 11.3); there's no equivalent gate here since Secretariat
 * isn't the one reviewing documents. did_stage2a_review is still recorded
 * per juror on each interview_participants row (via getStage2aReviewerIds)
 * so the "at least one non-2a-reviewer on the interview panel" rule (doc:
 * "to reduce single-reviewer bias") still has the data it needs at
 * interview time — that rule was always an app-level check on top of the
 * schema, not something the schema enforces itself, and that's unchanged.
 *
 * Idempotent per applicant: one with an interviews row already (an
 * earlier click, or a leftover from the old flow) is skipped, not
 * duplicated — safe to click again as more applicants get shortlisted.
 */
export async function requestInterviewsForPanel(panelId: string): Promise<BulkInterviewRequestResult> {
  const user = await getCurrentUser();
  if (!user || (user.role !== "secretariat" && user.role !== "secretariat_super_admin")) {
    return { success: false, error: "Only Secretariat can request interviews." };
  }

  const supabase = await createClient();
  const [{ data: panelMembers }, candidates] = await Promise.all([
    supabase.from("panel_memberships").select("juror_id").eq("panel_id", panelId),
    getShortlistedApplicationsForPanel(panelId),
  ]);
  const panelJurorIds = (panelMembers ?? []).map((m) => m.juror_id);
  if (candidates.length === 0) return { success: true, requestedCount: 0, alreadyRequestedCount: 0 };

  const { data: existingInterviews } = await supabase
    .from("interviews")
    .select("application_id")
    .in("application_id", candidates.map((c) => c.id));
  const alreadyRequested = new Set((existingInterviews ?? []).map((i) => i.application_id));
  const toRequest = candidates.filter((c) => !alreadyRequested.has(c.id));

  let requestedCount = 0;
  for (const candidate of toRequest) {
    const stage2aReviewerIds = new Set(await getStage2aReviewerIds(candidate.id));

    const { data: interview, error: interviewError } = await supabase
      .from("interviews")
      .insert({ application_id: candidate.id, panel_id: panelId, requested_by: user.id, status: "requested" })
      .select("id")
      .single();
    if (interviewError || !interview) continue;

    if (panelJurorIds.length > 0) {
      const { error: participantsError } = await supabase.from("interview_participants").insert(
        panelJurorIds.map((jurorId) => ({
          interview_id: interview.id,
          juror_id: jurorId,
          did_stage2a_review: stage2aReviewerIds.has(jurorId),
        }))
      );
      if (participantsError) {
        await supabase.from("interviews").delete().eq("id", interview.id);
        continue;
      }
    }

    const org = await orgForApplication(supabase, candidate.id);
    if (org) {
      await sendEmail({
        to: org.contact_email,
        subject: "You're invited to book your NECA Excellence Awards panel interview",
        template: "interview-invite",
        context: { organizationName: org.name, applicationId: candidate.id },
      });
    }
    await supabase.from("interviews").update({ initial_email_sent_at: new Date().toISOString() }).eq("id", interview.id);
    requestedCount++;
  }

  if (requestedCount > 0) {
    await logAction(user.fullName || user.email, `Requested interviews for ${requestedCount} shortlisted applicant(s), panel`, panelId);
  }
  revalidatePath("/secretariat/interviews");
  revalidatePath("/jury/availability");
  return { success: true, requestedCount, alreadyRequestedCount: candidates.length - requestedCount };
}

export async function markInterviewCompleted(applicationId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("interviews").update({ status: "completed" }).eq("application_id", applicationId);
  if (error) return { success: false, error: "Could not update the interview." };

  revalidatePath(`/jury/interview/${applicationId}`);
  revalidatePath("/applicant/interview");
  return { success: true };
}

export async function saveConsistencyNote(applicationId: string, pillarCode: PillarCode, note: string) {
  const supabase = await createClient();
  const { data: interview } = await supabase.from("interviews").select("id, consistency_notes").eq("application_id", applicationId).maybeSingle();
  if (!interview) return { success: false, error: "No interview session found." };

  const notes = { ...(interview.consistency_notes as Partial<Record<PillarCode, string>>), [pillarCode]: note };
  const { error } = await supabase.from("interviews").update({ consistency_notes: notes }).eq("id", interview.id);
  if (error) return { success: false, error: "Could not save note." };

  revalidatePath(`/jury/interview/${applicationId}`);
  return { success: true };
}

/** itemCode identifies which assessment item the live-requested document supports — the real schema keys evidence requests to a specific item, not free text. */
export async function addLiveEvidenceRequest(applicationId: string, itemCode: string, notes?: string, deadlineDays = 5) {
  const supabase = await createClient();
  const { data: interview } = await supabase.from("interviews").select("id").eq("application_id", applicationId).maybeSingle();
  if (!interview) return { success: false, error: "No interview session found." };

  const item = itemById(itemCode);
  const deadline = new Date();
  deadline.setDate(deadline.getDate() + deadlineDays);

  const { error } = await supabase.from("interview_evidence_requests").insert({
    interview_id: interview.id,
    item_id: item.dbId,
    deadline_at: deadline.toISOString(),
    notes,
  });
  if (error) return { success: false, error: "Could not record the request." };

  await logAction("Jury", "Requested additional evidence during interview:", item.evidenceName ?? item.id);
  revalidatePath(`/jury/interview/${applicationId}`);
  return { success: true };
}

export async function markEvidenceReceived(requestId: string, applicationId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("interview_evidence_requests").update({ fulfilled_at: new Date().toISOString() }).eq("id", requestId);
  if (error) return { success: false, error: "Could not update the request." };

  revalidatePath(`/jury/interview/${applicationId}`);
  return { success: true };
}

/** Sends (mock-sends, via sendEmail) a reminder to book. Meant to be called on a schedule by app/api/cron/interview-reminders. */
export async function sendBookingReminder(applicationId: string) {
  const supabase = await createClient();
  const { data: interview } = await supabase.from("interviews").select("id, status").eq("application_id", applicationId).maybeSingle();
  if (!interview) return { success: false, error: "No interview has been requested for this applicant." };
  if (interview.status !== "requested") return { success: false, error: "This applicant isn't awaiting scheduling." };

  const org = await orgForApplication(supabase, applicationId);
  if (org) {
    await sendEmail({
      to: org.contact_email,
      subject: "Reminder: book your NECA Excellence Awards panel interview",
      template: "interview-booking-reminder",
      context: { organizationName: org.name, applicationId },
    });
  }
  await supabase.from("interviews").update({ last_booking_reminder_at: new Date().toISOString() }).eq("id", interview.id);
  await logAction("System", "Sent interview-booking reminder email to", org?.name ?? applicationId);
  return { success: true };
}

/** Sends (mock-sends, via sendEmail) a reminder ahead of a scheduled interview. Meant to be called on a schedule by app/api/cron/interview-reminders. */
export async function sendAttendanceReminder(applicationId: string) {
  const supabase = await createClient();
  const { data: interview } = await supabase.from("interviews").select("id, status, scheduled_at").eq("application_id", applicationId).maybeSingle();
  if (!interview) return { success: false, error: "No interview has been requested for this applicant." };
  if (interview.status !== "scheduled") return { success: false, error: "This applicant hasn't been scheduled yet." };

  const org = await orgForApplication(supabase, applicationId);
  if (org) {
    await sendEmail({
      to: org.contact_email,
      subject: "Reminder: your upcoming NECA Excellence Awards panel interview",
      template: "interview-attendance-reminder",
      context: { organizationName: org.name, applicationId, scheduledAt: interview.scheduled_at ?? "" },
    });
  }
  await supabase.from("interviews").update({ last_attendance_reminder_at: new Date().toISOString() }).eq("id", interview.id);
  await logAction("System", "Sent interview-attendance reminder email to", org?.name ?? applicationId);
  return { success: true };
}
