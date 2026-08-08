"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { logAction } from "@/lib/data/audit";
import { sendEmail } from "@/lib/email/send";
import { getStage2aReviewerIds } from "@/lib/data/interviews";
import { itemById } from "@/lib/mock/framework";
import type { PillarCode } from "@/types/domain";

async function orgForApplication(supabase: Awaited<ReturnType<typeof createClient>>, applicationId: string) {
  const { data: app } = await supabase.from("applications").select("organization_id").eq("id", applicationId).maybeSingle();
  if (!app) return null;
  const { data: org } = await supabase.from("organizations").select("name, contact_email").eq("id", app.organization_id).maybeSingle();
  return org;
}

/**
 * Juror-initiated, per-applicant, gated on this juror having finished
 * their own Stage 2a document review for this applicant (doc section
 * 11.3). Assigns the requesting juror's whole panel as participants,
 * recording did_stage2a_review per juror — the "at least one non-2a-
 * reviewer" rule (doc: "to reduce single-reviewer bias") is then an app-
 * level check at interview time, same as the mock version; the schema
 * stores the fact but doesn't hard-enforce the rule itself.
 */
export async function requestInterview(applicationId: string, requestingJurorId: string, jurorName: string) {
  const supabase = await createClient();

  const { data: existing } = await supabase.from("interviews").select("id").eq("application_id", applicationId).maybeSingle();
  if (existing) return { success: false, error: "An interview has already been requested for this applicant." };

  const { data: myPanel } = await supabase.from("panel_memberships").select("panel_id").eq("juror_id", requestingJurorId).maybeSingle();
  if (!myPanel) return { success: false, error: "You aren't assigned to a panel." };

  const { data: panelMembers } = await supabase.from("panel_memberships").select("juror_id").eq("panel_id", myPanel.panel_id);
  const panelJurorIds = (panelMembers ?? []).map((m) => m.juror_id);

  const stage2aReviewerIds = new Set(await getStage2aReviewerIds(applicationId));

  const { data: interview, error: interviewError } = await supabase
    .from("interviews")
    .insert({ application_id: applicationId, panel_id: myPanel.panel_id, requested_by: requestingJurorId, status: "requested" })
    .select("id")
    .single();
  if (interviewError || !interview) return { success: false, error: "Could not create the interview." };

  const participantRows = panelJurorIds.map((jurorId) => ({
    interview_id: interview.id,
    juror_id: jurorId,
    did_stage2a_review: stage2aReviewerIds.has(jurorId),
  }));
  const { error: participantsError } = await supabase.from("interview_participants").insert(participantRows);
  if (participantsError) {
    await supabase.from("interviews").delete().eq("id", interview.id);
    return { success: false, error: "Could not assign the panel to this interview." };
  }

  const org = await orgForApplication(supabase, applicationId);
  if (org) {
    await sendEmail({
      to: org.contact_email,
      subject: "You're invited to book your NECA Excellence Awards panel interview",
      template: "interview-invite",
      context: { organizationName: org.name, applicationId },
    });
  }
  await supabase.from("interviews").update({ initial_email_sent_at: new Date().toISOString() }).eq("id", interview.id);

  await logAction(jurorName, "Requested interview for", org?.name ?? applicationId);
  revalidatePath("/jury/documents/" + applicationId);
  revalidatePath("/jury/availability");
  revalidatePath("/applicant/interview");
  return { success: true };
}

/**
 * Records the agreed time directly — no self-service booking flow exists
 * (real schema has no availability-slot table, and applicants have no
 * write access to `interviews` under RLS), so coordination happens
 * off-platform and a juror on the panel enters the outcome here.
 */
export async function scheduleInterview(applicationId: string, scheduledAtIso: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("interviews")
    .update({ scheduled_at: scheduledAtIso, status: "scheduled" })
    .eq("application_id", applicationId);
  if (error) return { success: false, error: "Could not schedule the interview." };

  revalidatePath("/jury/availability");
  revalidatePath("/applicant/interview");
  return { success: true };
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
