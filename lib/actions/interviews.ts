"use server";

import { revalidatePath } from "next/cache";
import { store, generateId } from "@/lib/mock/store";
import { logAction } from "@/lib/data/audit";
import { getOutstandingDocuments } from "@/lib/data/documents";
import { sendEmail } from "@/lib/email/send";

export async function setAvailability(
  jurorId: string,
  slots: { date: string; startTime: string; endTime: string }[]
) {
  // Replace this juror's unbooked slots with the new set; keep booked ones untouched.
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
  logAction(organizationName, "Booked interview slot for", `${slot.date} ${slot.startTime}`);
  revalidatePath("/applicant/interview");
  return { success: true };
}

function orgForApplication(applicationId: string) {
  const app = store.applications.find((a) => a.id === applicationId);
  return app ? store.organizations.find((o) => o.id === app.organizationId) : undefined;
}

/**
 * Juror-initiated, per-applicant: called once a juror has certified or
 * rejected every uploaded document for this applicant (enforced here too,
 * not just hidden by the UI). Creates the InterviewRequest that unlocks
 * booking on the applicant side, and sends the "initial invite" email.
 *
 * No email provider is wired up yet — sendEmail() (lib/email/send.ts) just
 * logs what would have gone out. sendBookingReminder and
 * sendAttendanceReminder below are the matching trigger points for the
 * periodic follow-ups; they're invoked on a schedule by
 * app/api/cron/interview-reminders, which needs an external trigger (e.g.
 * a cPanel Cron Job) to actually hit that route periodically — see the
 * README.
 */
export async function requestInterview(applicationId: string, jurorId: string, jurorName: string) {
  const existing = store.interviewRequests.find((r) => r.applicationId === applicationId);
  if (existing) return { success: false, error: "An interview has already been requested for this applicant." };

  const outstanding = await getOutstandingDocuments(applicationId, jurorId);
  if (outstanding.length > 0) {
    return {
      success: false,
      error: `Certify or mark not compliant every uploaded document before requesting an interview. Outstanding: ${outstanding.map((d) => d.name).join(", ")}`,
    };
  }

  const now = new Date().toISOString();
  store.interviewRequests.push({
    id: generateId("interview-request"),
    applicationId,
    requestedByJurorId: jurorId,
    requestedAt: now,
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

/**
 * Sends (mock-sends, via sendEmail) a reminder to book, for a
 * requested-but-not-yet-booked interview. Called by
 * app/api/cron/interview-reminders on a schedule, not directly from the UI.
 */
export async function sendBookingReminder(applicationId: string) {
  const request = store.interviewRequests.find((r) => r.applicationId === applicationId);
  if (!request) return { success: false, error: "No interview has been requested for this applicant." };
  const alreadyBooked = store.availability.some((s) => s.bookedByApplicationId === applicationId);
  if (alreadyBooked) return { success: false, error: "This applicant has already booked — send an attendance reminder instead." };

  const org = orgForApplication(applicationId);
  if (org) {
    await sendEmail({
      to: org.primaryContactEmail,
      subject: "Reminder: book your NECA Excellence Awards panel interview",
      template: "interview-booking-reminder",
      context: { organizationName: org.name, applicationId },
    });
  }
  request.lastBookingReminderAt = new Date().toISOString();
  logAction("System", "Sent interview-booking reminder email to", org?.name ?? applicationId);
  return { success: true };
}

/**
 * Sends (mock-sends, via sendEmail) a reminder ahead of a booked interview.
 * Called by app/api/cron/interview-reminders on a schedule, not directly
 * from the UI. Stops being a candidate once the booked slot's start time
 * has passed — see getAttendanceReminderCandidates in lib/data/interviews.ts
 * for why that's used as the "until attended" cutoff (there's no explicit
 * attendance-tracking field in the domain model yet).
 */
export async function sendAttendanceReminder(applicationId: string) {
  const request = store.interviewRequests.find((r) => r.applicationId === applicationId);
  if (!request) return { success: false, error: "No interview has been requested for this applicant." };
  const bookedSlot = store.availability.find((s) => s.bookedByApplicationId === applicationId);
  if (!bookedSlot) return { success: false, error: "This applicant hasn't booked a slot yet — send a booking reminder instead." };

  const org = orgForApplication(applicationId);
  if (org) {
    await sendEmail({
      to: org.primaryContactEmail,
      subject: "Reminder: your upcoming NECA Excellence Awards panel interview",
      template: "interview-attendance-reminder",
      context: {
        organizationName: org.name,
        applicationId,
        date: bookedSlot.date,
        startTime: bookedSlot.startTime,
      },
    });
  }
  request.lastAttendanceReminderAt = new Date().toISOString();
  logAction("System", "Sent interview-attendance reminder email to", org?.name ?? applicationId);
  return { success: true };
}
