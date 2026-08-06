import { store } from "@/lib/mock/store";
import type { InterviewAvailabilitySlot, InterviewSession, LiveEvidenceRequest, PillarCode } from "@/types/domain";

export async function getInterviewSession(applicationId: string): Promise<InterviewSession | null> {
  return store.interviewSessions.find((s) => s.applicationId === applicationId) ?? null;
}

export async function getJurorAvailability(jurorId: string): Promise<InterviewAvailabilitySlot[]> {
  return store.availability.filter((s) => s.jurorId === jurorId);
}

/**
 * Open (unbooked) slots published by either of this applicant's two
 * assigned interview jurors (doc section 11.3: min 2 jurors per
 * interview, one of whom didn't do the Stage 2a review). Empty until an
 * InterviewSession exists — booking is per-applicant and juror-initiated,
 * not tied to any general application-status change.
 */
export async function getBookableSlotsForApplication(applicationId: string): Promise<InterviewAvailabilitySlot[]> {
  const session = await getInterviewSession(applicationId);
  if (!session || session.status !== "awaiting_booking") return [];
  return store.availability.filter((s) => session.assignedJurorIds.includes(s.jurorId) && !s.booked);
}

export async function getBookedSlotForApplication(applicationId: string): Promise<InterviewAvailabilitySlot | null> {
  return store.availability.find((s) => s.bookedByApplicationId === applicationId) ?? null;
}

export async function getLiveEvidenceRequests(applicationId: string): Promise<LiveEvidenceRequest[]> {
  return store.liveEvidenceRequests.filter((r) => r.applicationId === applicationId);
}

/** Which jurors on this application's panel already did a Stage 2a document review — used to satisfy the "one non-2a-reviewer" interview-panel rule. */
export async function getStage2aReviewerIds(applicationId: string): Promise<string[]> {
  const documentIds = new Set(store.documents.filter((d) => d.applicationId === applicationId).map((d) => d.id));
  return Array.from(new Set(store.documentVerifications.filter((v) => documentIds.has(v.documentId)).map((v) => v.jurorId)));
}

const REMINDER_INTERVAL_MS = 24 * 60 * 60 * 1000;

function dueForReminder(lastSentAt: string | null): boolean {
  if (!lastSentAt) return true;
  return Date.now() - new Date(lastSentAt).getTime() >= REMINDER_INTERVAL_MS;
}

export interface ReminderCandidate {
  applicationId: string;
}

/** Interview sessions awaiting booking, due for a reminder (not sent in the last 24h) — consumed by app/api/cron/interview-reminders. */
export async function getBookingReminderCandidates(): Promise<ReminderCandidate[]> {
  return store.interviewSessions
    .filter((s) => s.status === "awaiting_booking")
    .filter((s) => dueForReminder(s.lastBookingReminderAt))
    .map((s) => ({ applicationId: s.applicationId }));
}

/** Scheduled interviews whose slot is still upcoming, due for a reminder. There's no explicit "attended" flag, so a slot moving into the past is the cutoff — see lib/actions/interviews.ts's sendAttendanceReminder. */
export async function getAttendanceReminderCandidates(): Promise<ReminderCandidate[]> {
  const now = Date.now();
  return store.interviewSessions
    .filter((s) => s.status === "scheduled" && s.scheduledAt && new Date(s.scheduledAt).getTime() >= now)
    .filter((s) => dueForReminder(s.lastAttendanceReminderAt))
    .map((s) => ({ applicationId: s.applicationId }));
}

export const SAMPLE_PROBES: Record<Exclude<PillarCode, "A">, string> = {
  B: "Walk us through the last time your Board/advisory body reviewed its own performance — what changed as a result?",
  C: "Describe how a recent performance appraisal cycle actually ran, from setting objectives to the final review conversation.",
  D: "Tell us about the last significant issue raised through your employee voice mechanism, and how it was resolved.",
  E: "Show us (screen-share) the HR system in use, or describe what changed for employees since it was introduced.",
  F: "What is one number you track monthly to know whether the organisation is performing, and who reviews it?",
  G: "Describe your most recent CSR/ESG initiative end-to-end — what problem it addressed and what changed.",
  H: "Talk us through your most recent workplace safety incident or near-miss, and what came out of the review.",
  I: "How does your organisation actually verify a new employee's or intern's age and eligibility to work?",
};
