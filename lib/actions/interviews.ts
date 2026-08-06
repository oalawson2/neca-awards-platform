"use server";

import { revalidatePath } from "next/cache";
import { store, generateId } from "@/lib/mock/store";
import { logAction } from "@/lib/data/audit";
import { sendEmail } from "@/lib/email/send";
import { getStage2aReviewerIds } from "@/lib/data/interviews";
import type { PillarCode } from "@/types/domain";

function orgForApplication(applicationId: string) {
  const app = store.applications.find((a) => a.id === applicationId);
  return app ? store.organizations.find((o) => o.id === app.organizationId) : undefined;
}

export async function setAvailability(jurorId: string, slots: { date: string; startTime: string; endTime: string }[]) {
  store.availability = store.availability.filter((s) => s.jurorId !== jurorId || s.booked);
  for (const slot of slots) {
    store.availability.push({ id: generateId("slot"), jurorId, ...slot, booked: false });
  }
  revalidatePath("/jury/availability");
  return { success: true };
}

export async function bookInterviewSlot(applicationId: string, slotId: string, organizationName: string) {
  const slot = store.availability.find((s) => s.id === slotId);
  if (!slot || slot.booked) return { success: false, error: "That slot is no longer available." };

  slot.booked = true;
  slot.bookedByApplicationId = applicationId;
  const session = store.interviewSessions.find((s) => s.applicationId === applicationId);
  if (session) {
    session.status = "scheduled";
    session.scheduledAt = `${slot.date}T${slot.startTime}:00`;
  }
  logAction(organizationName, "Booked interview slot for", `${slot.date} ${slot.startTime}`);
  revalidatePath("/applicant/interview");
  return { success: true };
}

/**
 * Juror-initiated, per-applicant, gated on this juror having finished
 * their own Stage 2a document review for this applicant — carried
 * forward from the earlier single-juror interview trigger, now re-scoped
 * to the panel model (doc section 11.3): assigns 2 jurors from the
 * panel, preferring at least one who did NOT do the Stage 2a review, as
 * the doc requires ("to reduce single-reviewer bias").
 */
export async function requestInterview(applicationId: string, requestingJurorId: string, jurorName: string) {
  const existing = store.interviewSessions.find((s) => s.applicationId === applicationId);
  if (existing) return { success: false, error: "An interview has already been requested for this applicant." };

  const uploadedDocIds = new Set(
    store.documents.filter((d) => d.applicationId === applicationId && d.status === "uploaded").map((d) => d.id)
  );
  const reviewedByMe = new Set(
    store.documentVerifications.filter((v) => v.jurorId === requestingJurorId && uploadedDocIds.has(v.documentId)).map((v) => v.documentId)
  );
  const outstanding = Array.from(uploadedDocIds).filter((id) => !reviewedByMe.has(id));
  if (outstanding.length > 0) {
    return { success: false, error: "Finish verifying every uploaded document for this applicant before requesting an interview." };
  }

  const panel = store.panels.find((p) => p.jurorIds.includes(requestingJurorId));
  if (!panel) return { success: false, error: "You aren't assigned to a panel." };

  const stage2aReviewerIds = new Set(await getStage2aReviewerIds(applicationId));
  const nonReviewers = panel.jurorIds.filter((id) => !stage2aReviewerIds.has(id));
  const reviewers = panel.jurorIds.filter((id) => stage2aReviewerIds.has(id));
  const assignedJurorIds = [...nonReviewers, ...reviewers].slice(0, 2);
  if (assignedJurorIds.length < 2) assignedJurorIds.push(...panel.jurorIds.filter((id) => !assignedJurorIds.includes(id)));

  const now = new Date().toISOString();
  store.interviewSessions.push({
    id: generateId("interview"),
    applicationId,
    panelId: panel.id,
    assignedJurorIds: assignedJurorIds.slice(0, 2),
    scheduledAt: null,
    format: "virtual",
    status: "awaiting_booking",
    consistencyNotes: {},
    probeQuestions: {},
    requestedAt: now,
    requestedByJurorId: requestingJurorId,
    initialEmailSentAt: now,
    lastBookingReminderAt: null,
    lastAttendanceReminderAt: null,
  });

  const org = orgForApplication(applicationId);
  if (org) {
    await sendEmail({
      to: org.primaryContactEmail,
      subject: "You're invited to book your NECA Excellence Awards panel interview",
      template: "interview-invite",
      context: { organizationName: org.name, applicationId },
    });
  }
  logAction(jurorName, "Requested interview for", org?.name ?? applicationId);

  revalidatePath("/jury/documents/" + applicationId);
  revalidatePath("/applicant/interview");
  return { success: true };
}

export async function saveConsistencyNote(applicationId: string, pillarCode: PillarCode, note: string) {
  const session = store.interviewSessions.find((s) => s.applicationId === applicationId);
  if (!session) return { success: false, error: "No interview session found." };
  session.consistencyNotes[pillarCode] = note;
  revalidatePath(`/jury/interview/${applicationId}`);
  return { success: true };
}

export async function addLiveEvidenceRequest(applicationId: string, description: string, deadlineDays = 5) {
  const session = store.interviewSessions.find((s) => s.applicationId === applicationId);
  if (!session) return { success: false, error: "No interview session found." };

  const deadline = new Date();
  deadline.setDate(deadline.getDate() + deadlineDays);

  store.liveEvidenceRequests.push({
    id: generateId("live-evidence"),
    interviewSessionId: session.id,
    applicationId,
    description,
    requestedAt: new Date().toISOString(),
    deadline: deadline.toISOString(),
    receivedAt: null,
  });

  logAction("Jury", "Requested additional evidence during interview:", description);
  revalidatePath(`/jury/interview/${applicationId}`);
  return { success: true };
}

export async function markEvidenceReceived(requestId: string) {
  const request = store.liveEvidenceRequests.find((r) => r.id === requestId);
  if (!request) return { success: false, error: "Request not found." };
  request.receivedAt = new Date().toISOString();
  revalidatePath(`/jury/interview/${request.applicationId}`);
  return { success: true };
}

/** Sends (mock-sends, via sendEmail) a reminder to book. Meant to be called on a schedule by app/api/cron/interview-reminders. */
export async function sendBookingReminder(applicationId: string) {
  const session = store.interviewSessions.find((s) => s.applicationId === applicationId);
  if (!session) return { success: false, error: "No interview has been requested for this applicant." };
  if (session.status !== "awaiting_booking") return { success: false, error: "This applicant isn't awaiting booking." };

  const org = orgForApplication(applicationId);
  if (org) {
    await sendEmail({
      to: org.primaryContactEmail,
      subject: "Reminder: book your NECA Excellence Awards panel interview",
      template: "interview-booking-reminder",
      context: { organizationName: org.name, applicationId },
    });
  }
  session.lastBookingReminderAt = new Date().toISOString();
  logAction("System", "Sent interview-booking reminder email to", org?.name ?? applicationId);
  return { success: true };
}

/** Sends (mock-sends, via sendEmail) a reminder ahead of a booked interview. Meant to be called on a schedule by app/api/cron/interview-reminders. */
export async function sendAttendanceReminder(applicationId: string) {
  const session = store.interviewSessions.find((s) => s.applicationId === applicationId);
  if (!session) return { success: false, error: "No interview has been requested for this applicant." };
  if (session.status !== "scheduled") return { success: false, error: "This applicant hasn't booked a slot yet." };

  const org = orgForApplication(applicationId);
  if (org) {
    await sendEmail({
      to: org.primaryContactEmail,
      subject: "Reminder: your upcoming NECA Excellence Awards panel interview",
      template: "interview-attendance-reminder",
      context: { organizationName: org.name, applicationId, scheduledAt: session.scheduledAt ?? "" },
    });
  }
  session.lastAttendanceReminderAt = new Date().toISOString();
  logAction("System", "Sent interview-attendance reminder email to", org?.name ?? applicationId);
  return { success: true };
}
