"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/session";
import { logAction } from "@/lib/data/audit";

export interface SectorActionResult {
  success: boolean;
  error?: string;
}

/**
 * Real schema requires secretariat_super_admin for any write to `sectors`
 * (RLS: sectors_write_super_admin, checked via is_super_admin()) — this
 * check is a friendly early return, not the actual enforcement; the
 * regular (non-admin) Supabase client is used below, so RLS is the real
 * gate either way.
 */
async function requireSuperAdmin(): Promise<SectorActionResult | null> {
  const user = await getCurrentUser();
  if (!user || user.role !== "secretariat_super_admin") {
    return { success: false, error: "Only a Secretariat super admin can manage sectors." };
  }
  return null;
}

export async function addSector(name: string, categoryId: string): Promise<SectorActionResult> {
  const denied = await requireSuperAdmin();
  if (denied) return denied;

  const trimmed = name.trim();
  if (!trimmed) return { success: false, error: "Sector name is required." };
  if (!categoryId) return { success: false, error: "Choose a category." };

  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("sectors")
    .select("id")
    .eq("category_id", categoryId)
    .ilike("name", trimmed)
    .maybeSingle();
  if (existing) return { success: false, error: "A sector with this name already exists in this category." };

  const { count } = await supabase
    .from("sectors")
    .select("id", { count: "exact", head: true })
    .eq("category_id", categoryId);

  const { error } = await supabase.from("sectors").insert({
    name: trimmed,
    category_id: categoryId,
    sort_order: (count ?? 0) + 1,
  });
  if (error) return { success: false, error: "Could not add sector — you may not have permission." };

  await logAction("Secretariat", "Added sector", trimmed);
  revalidatePath("/secretariat/criteria");
  return { success: true };
}

/**
 * Real schema has no delete path for sectors that are already in use
 * elsewhere (organizations.sector_id, panel_sector_clusters.sector_id
 * both FK to it) — deactivating (is_active=false) is the real operation,
 * matching the schema reference doc's own "add/edit/deactivate" framing.
 * A deactivated sector drops out of getSectors()'s default list (Section
 * A's dropdown) but existing organizations keep their reference to it.
 */
export async function deactivateSector(sectorId: string): Promise<SectorActionResult> {
  const denied = await requireSuperAdmin();
  if (denied) return denied;

  const supabase = await createClient();
  const { data: sector } = await supabase.from("sectors").select("name").eq("id", sectorId).maybeSingle();

  const { error } = await supabase.from("sectors").update({ is_active: false }).eq("id", sectorId);
  if (error) return { success: false, error: "Could not deactivate sector — you may not have permission." };

  if (sector) await logAction("Secretariat", "Deactivated sector", sector.name);
  revalidatePath("/secretariat/criteria");
  return { success: true };
}

export async function reactivateSector(sectorId: string): Promise<SectorActionResult> {
  const denied = await requireSuperAdmin();
  if (denied) return denied;

  const supabase = await createClient();
  const { data: sector } = await supabase.from("sectors").select("name").eq("id", sectorId).maybeSingle();

  const { error } = await supabase.from("sectors").update({ is_active: true }).eq("id", sectorId);
  if (error) return { success: false, error: "Could not reactivate sector — you may not have permission." };

  if (sector) await logAction("Secretariat", "Reactivated sector", sector.name);
  revalidatePath("/secretariat/criteria");
  return { success: true };
}
