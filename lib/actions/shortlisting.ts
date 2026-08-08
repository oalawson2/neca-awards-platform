"use server";

import { revalidatePath } from "next/cache";
import { store } from "@/lib/mock/store";
import { logAction } from "@/lib/data/audit";
import { getShortlistCategories } from "@/lib/data/shortlisting";
import type { ShortlistMode } from "@/types/domain";

/** Secretariat-configurable, no hardcoded default — NECA hasn't decided this yet (doc section 13). */
export async function setShortlistConfig(sectorId: string, mode: ShortlistMode, value: number) {
  const config = store.shortlistConfigs.find((c) => c.sectorId === sectorId && c.sizeTier === "all");
  if (!config) return { success: false, error: "Category not found." };
  if (value <= 0) return { success: false, error: "Value must be greater than zero." };

  config.mode = mode;
  config.value = value;

  const sector = store.sectors.find((s) => s.id === sectorId);
  logAction("Funke Adeyemi", `Set shortlist ${mode} to ${value} for`, sector?.name ?? sectorId);
  revalidatePath("/secretariat/shortlisting");
  return { success: true };
}

/**
 * Applies the configured cutoff for one sector category: top-N (or
 * top-N%) by Stage 1 score become "shortlisted" and proceed to Stage 2;
 * the rest become "not_shortlisted" (doc section 13). Re-running after a
 * late submission or a config change simply recomputes from scratch —
 * it isn't a one-way gate.
 */
export async function applyShortlist(sectorId: string) {
  const categories = await getShortlistCategories();
  const category = categories.find((c) => c.sectorId === sectorId);
  if (!category) return { success: false, error: "No submitted applications in this sector yet." };
  if (category.cutoffCount === null) {
    return { success: false, error: "Set a shortlist count or percentage for this sector before applying it." };
  }

  for (const ranked of category.ranked) {
    const app = store.applications.find((a) => a.id === ranked.id);
    if (!app) continue;
    const shortlisted = ranked.rank <= category.cutoffCount;
    app.isShortlisted = shortlisted;
    app.status = shortlisted ? "shortlisted" : "not_shortlisted";
  }

  logAction("Funke Adeyemi", `Applied shortlist (top ${category.cutoffCount}) for`, category.sectorName);
  revalidatePath("/secretariat/shortlisting");
  revalidatePath("/secretariat");
  revalidatePath("/applicant");
  return { success: true };
}
