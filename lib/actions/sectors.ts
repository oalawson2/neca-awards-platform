"use server";

import { revalidatePath } from "next/cache";
import { store, generateId } from "@/lib/mock/store";
import { logAction } from "@/lib/data/audit";

/** Secretariat-managed — no NECA sector list exists yet, so this is the real add path, not a placeholder. */
export async function addSector(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return { success: false, error: "Sector name is required." };
  if (store.sectors.some((s) => s.name.toLowerCase() === trimmed.toLowerCase())) {
    return { success: false, error: "A sector with this name already exists." };
  }
  store.sectors.push({ id: generateId("sector"), name: trimmed, order: store.sectors.length + 1 });
  logAction("Funke Adeyemi", "Added sector", trimmed);
  revalidatePath("/secretariat/framework");
  return { success: true };
}

export async function removeSector(sectorId: string) {
  const inUse = store.organizations.some((o) => o.sectorId === sectorId);
  if (inUse) return { success: false, error: "This sector has organisations assigned to it and can't be removed." };
  const sector = store.sectors.find((s) => s.id === sectorId);
  store.sectors = store.sectors.filter((s) => s.id !== sectorId);
  if (sector) logAction("Funke Adeyemi", "Removed sector", sector.name);
  revalidatePath("/secretariat/framework");
  return { success: true };
}
