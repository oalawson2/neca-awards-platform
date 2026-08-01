"use server";

import { revalidatePath } from "next/cache";
import { store } from "@/lib/mock/store";
import { logAction } from "@/lib/data/audit";

/** Secretariat super-admin only — enforced in the UI layer, not here. */
export async function setAdvancementThreshold(value: number) {
  store.settings.advancementThresholdScore = value;
  logAction("Funke Adeyemi", "Updated advancement threshold to", String(value));
  revalidatePath("/secretariat/settings");
  return { success: true };
}
