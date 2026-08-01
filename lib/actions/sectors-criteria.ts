"use server";

import { revalidatePath } from "next/cache";
import { store, generateId } from "@/lib/mock/store";
import { logAction } from "@/lib/data/audit";

export async function updateCriterionWeight(criterionId: string, weightPoints: number) {
  const criterion = store.criteria.find((c) => c.id === criterionId);
  if (!criterion) return { success: false, error: "Criterion not found." };
  criterion.weightPoints = weightPoints;
  logAction("Funke Adeyemi", "Updated criterion weight for", criterion.name);
  revalidatePath("/secretariat/criteria");
  return { success: true };
}

export async function addSector(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return { success: false, error: "Sector name is required." };
  store.sectors.push({ id: generateId("sector"), name: trimmed });
  logAction("Funke Adeyemi", "Added sector", trimmed);
  revalidatePath("/secretariat/criteria");
  return { success: true };
}
