import { store } from "@/lib/mock/store";
import type { InterviewAvailabilitySlot, InterviewRequest } from "@/types/domain";

export async function getJurorAvailability(jurorId: string): Promise<InterviewAvailabilitySlot[]> {
  return store.availability.filter((s) => s.jurorId === jurorId);
}

export async function getInterviewRequest(applicationId: string): Promise<InterviewRequest | null> {
  return store.interviewRequests.find((r) => r.applicationId === applicationId) ?? null;
}

/**
 * Open (unbooked) slots for the juror panel assigned to an application's
 * sector. Deliberately empty until an interview has actually been
 * requested (see lib/actions/interviews.ts's requestInterview) — booking
 * is per-applicant and juror-initiated, not tied to any general
 * application-status change.
 */
export async function getBookableSlotsForApplication(applicationId: string): Promise<InterviewAvailabilitySlot[]> {
  const request = await getInterviewRequest(applicationId);
  if (!request) return [];

  const app = store.applications.find((a) => a.id === applicationId);
  if (!app) return [];
  const jurorIds = store.jurorAssignments.filter((a) => a.sectorId === app.sectorId).map((a) => a.jurorId);
  return store.availability.filter((s) => jurorIds.includes(s.jurorId) && !s.booked);
}

export async function getBookedSlotForApplication(applicationId: string): Promise<InterviewAvailabilitySlot | null> {
  return store.availability.find((s) => s.bookedByApplicationId === applicationId) ?? null;
}

/** Don't re-send the same reminder more than once in this window. */
const REMINDER_INTERVAL_MS = 24 * 60 * 60 * 1000;

function dueForReminder(lastSentAt: string | null): boolean {
  if (!lastSentAt) return true;
  return Date.now() - new Date(lastSentAt).getTime() >= REMINDER_INTERVAL_MS;
}

export interface ReminderCandidate {
  applicationId: string;
}

/**
 * Interview requests where the applicant hasn't booked a slot yet and it's
 * been at least REMINDER_INTERVAL_MS since the last booking reminder (or
 * none has gone out). Consumed by app/api/cron/interview-reminders.
 */
export async function getBookingReminderCandidates(): Promise<ReminderCandidate[]> {
  return store.interviewRequests
    .filter((r) => !store.availability.some((s) => s.bookedByApplicationId === r.applicationId))
    .filter((r) => dueForReminder(r.lastBookingReminderAt))
    .map((r) => ({ applicationId: r.applicationId }));
}

/**
 * Interview requests with a booked slot whose date/time is still in the
 * future (there's no explicit "attended" flag in the domain model, so a
 * slot moving into the past is the closest proxy we have for "stop
 * reminding" — see the docstring on sendAttendanceReminder), and where
 * it's been at least REMINDER_INTERVAL_MS since the last attendance
 * reminder (or none has gone out).
 */
export async function getAttendanceReminderCandidates(): Promise<ReminderCandidate[]> {
  const now = Date.now();
  return store.interviewRequests
    .filter((r) => {
      const slot = store.availability.find((s) => s.bookedByApplicationId === r.applicationId);
      if (!slot) return false;
      const slotStart = new Date(`${slot.date}T${slot.startTime}`).getTime();
      return slotStart >= now;
    })
    .filter((r) => dueForReminder(r.lastAttendanceReminderAt))
    .map((r) => ({ applicationId: r.applicationId }));
}
