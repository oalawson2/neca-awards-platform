"use server";

import { revalidatePath } from "next/cache";
import { store, generateId } from "@/lib/mock/store";
import { logAction } from "@/lib/data/audit";
import { getOutstandingDocuments } from "@/lib/data/documents";

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

/**
 * Juror-initiated, per-applicant: called once a juror has certified or
 * rejected every uploaded document for this applicant (enforced here too,
 * not just hidden by the UI). Creates the InterviewRequest that unlocks
 * booking on the applicant side, and is the trigger point for the
 * "initial invite" email.
 *
 * No email provider is wired up yet (no credentials exist) — this records
 * that the email *would* go out (initialEmailSentAt) and logs it, ready to
 * swap for a real send later without changing any caller. sendBookingReminder
 * and sendAttendanceReminder below are the matching trigger points for the
 * periodic follow-ups; none of these three functions are invoked on a
 * schedule anywhere yet, since this app has no background job runner —
 * once real email exists, something with a scheduler (a cron hitting a
 * route handler, a Supabase scheduled Edge Function, etc.) needs to call
 * them periodically.
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
    initialEmailSentAt: now, // mock send — see docstring above
    lastBookingReminderAt: null,
    lastAttendanceReminderAt: null,
  });

  const app = store.applications.find((a) => a.id === applicationId);
  const orgName = app ? store.organizations.find((o) => o.id === app.organizationId)?.name : undefined;
  logAction(jurorName, "Requested interview for", orgName ?? applicationId);
  logAction("System", "Sent interview-invite email to", orgName ?? applicationId);

  revalidatePath("/jury/documents/" + applicationId);
  revalidatePath("/applicant/interview");
  return { success: true };
}

/** Mock — sends (logs) a reminder to book, for a requested-but-not-yet-booked interview. Not called on a schedule yet; see requestInterview's docstring. */
export async function sendBookingReminder(applicationId: string) {
  const request = store.interviewRequests.find((r) => r.applicationId === applicationId);
  if (!request) return { success: false, error: "No interview has been requested for this applicant." };
  const alreadyBooked = store.availability.some((s) => s.bookedByApplicationId === applicationId);
  if (alreadyBooked) return { success: false, error: "This applicant has already booked — send an attendance reminder instead." };

  request.lastBookingReminderAt = new Date().toISOString();
  const app = store.applications.find((a) => a.id === applicationId);
  const orgName = app ? store.organizations.find((o) => o.id === app.organizationId)?.name : undefined;
  logAction("System", "Sent interview-booking reminder email to", orgName ?? applicationId);
  return { success: true };
}

/** Mock — sends (logs) a reminder ahead of a booked interview. Not called on a schedule yet; see requestInterview's docstring. */
export async function sendAttendanceReminder(applicationId: string) {
  const request = store.interviewRequests.find((r) => r.applicationId === applicationId);
  if (!request) return { success: false, error: "No interview has been requested for this applicant." };
  const bookedSlot = store.availability.find((s) => s.bookedByApplicationId === applicationId);
  if (!bookedSlot) return { success: false, error: "This applicant hasn't booked a slot yet — send a booking reminder instead." };

  request.lastAttendanceReminderAt = new Date().toISOString();
  const app = store.applications.find((a) => a.id === applicationId);
  const orgName = app ? store.organizations.find((o) => o.id === app.organizationId)?.name : undefined;
  logAction("System", "Sent interview-attendance reminder email to", orgName ?? applicationId);
  return { success: true };
}
