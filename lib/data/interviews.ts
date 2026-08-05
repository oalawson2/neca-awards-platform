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
