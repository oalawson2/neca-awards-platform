import { store } from "@/lib/mock/store";
import type { InterviewAvailabilitySlot } from "@/types/domain";

export async function getJurorAvailability(jurorId: string): Promise<InterviewAvailabilitySlot[]> {
  return store.availability.filter((s) => s.jurorId === jurorId);
}

/** Open (unbooked) slots for the juror panel assigned to an application's sector. */
export async function getBookableSlotsForApplication(applicationId: string): Promise<InterviewAvailabilitySlot[]> {
  const app = store.applications.find((a) => a.id === applicationId);
  if (!app) return [];
  const jurorIds = store.jurorAssignments.filter((a) => a.sectorId === app.sectorId).map((a) => a.jurorId);
  return store.availability.filter((s) => jurorIds.includes(s.jurorId) && !s.booked);
}

export async function getBookedSlotForApplication(applicationId: string): Promise<InterviewAvailabilitySlot | null> {
  return store.availability.find((s) => s.bookedByApplicationId === applicationId) ?? null;
}
