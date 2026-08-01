"use server";

import { revalidatePath } from "next/cache";
import { store, generateId } from "@/lib/mock/store";
import { logAction } from "@/lib/data/audit";

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
