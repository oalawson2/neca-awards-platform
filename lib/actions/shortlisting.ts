"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/session";
import { logAction } from "@/lib/data/audit";
import { getShortlistCategories } from "@/lib/data/shortlisting";
import type { OrgSizeTier, ShortlistMode } from "@/types/domain";

export interface ShortlistActionResult {
  success: boolean;
  error?: string;
}

/**
 * shortlist_config write requires secretariat_super_admin specifically
 * (RLS: shortlist_config_write_super_admin, is_super_admin()) — a
 * stricter gate than panels, which either tier can manage. No hardcoded
 * default value anywhere: NECA hasn't decided this yet (doc section 13).
 * Upserts rather than updates an existing row, since shortlist_config
 * starts empty by design — there's no pre-seeded row per category the
 * way the mock had.
 */
export async function setShortlistConfig(sectorId: string, sizeTier: OrgSizeTier, mode: ShortlistMode, value: number): Promise<ShortlistActionResult> {
  const user = await getCurrentUser();
  if (!user || user.role !== "secretariat_super_admin") {
    return { success: false, error: "Only a Secretariat super admin can configure shortlist cutoffs." };
  }
  if (value <= 0) return { success: false, error: "Value must be greater than zero." };

  const supabase = await createClient();
  const cycleYear = new Date().getFullYear();
  const { error } = await supabase.from("shortlist_config").upsert(
    { sector_id: sectorId, org_size_tier: sizeTier, basis: mode, value, cycle_year: cycleYear, updated_at: new Date().toISOString() },
    { onConflict: "sector_id,org_size_tier,cycle_year" }
  );
  if (error) return { success: false, error: "Could not save shortlist configuration." };

  await logAction(user.fullName || user.email, `Set shortlist ${mode} to ${value} for`, `${sectorId} (${sizeTier})`);
  revalidatePath("/secretariat/shortlisting");
  return { success: true };
}

/**
 * Applies the configured cutoff for one (sector, size tier) category:
 * top-N (or top-N%) by Stage 1 score become "shortlisted" and proceed to
 * Stage 2; the rest become "not_shortlisted" (doc section 13). Re-running
 * after a late submission or a config change simply recomputes from
 * scratch — it isn't a one-way gate.
 */
export async function applyShortlist(sectorId: string, sizeTier: OrgSizeTier): Promise<ShortlistActionResult> {
  const user = await getCurrentUser();
  if (!user || (user.role !== "secretariat" && user.role !== "secretariat_super_admin")) {
    return { success: false, error: "Only Secretariat can apply a shortlist." };
  }

  const categories = await getShortlistCategories();
  const category = categories.find((c) => c.sectorId === sectorId && c.sizeTier === sizeTier);
  if (!category) return { success: false, error: "No submitted applications in this category yet." };
  if (category.cutoffCount === null) {
    return { success: false, error: "Set a shortlist count or percentage for this category before applying it." };
  }

  const supabase = await createClient();
  for (const ranked of category.ranked) {
    const shortlisted = ranked.rank <= category.cutoffCount;
    await supabase
      .from("applications")
      .update({ status: shortlisted ? "shortlisted" : "not_shortlisted" })
      .eq("id", ranked.id);
  }

  await logAction(user.fullName || user.email, `Applied shortlist (top ${category.cutoffCount}) for`, `${category.sectorName} (${sizeTier})`);
  revalidatePath("/secretariat/shortlisting");
  revalidatePath("/secretariat");
  revalidatePath("/applicant");
  return { success: true };
}
