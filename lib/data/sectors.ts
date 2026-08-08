import { createClient } from "@/lib/supabase/server";
import type { Sector } from "@/types/domain";

/**
 * Real query against sector_categories + sectors (21 categories, 183
 * sectors, already seeded). Only lib/data/sectors.ts + lib/actions/sectors.ts
 * are swapped in this pass (task #44) — panels.ts, shortlisting.ts and
 * winners.ts still read the mock store's 3 placeholder sectors until their
 * own swap tasks land (#48/#52/#53), so this list and theirs will
 * legitimately disagree until then.
 *
 * `includeInactive` exists for the Secretariat admin screen, which needs
 * to show deactivated sectors too (to reactivate them); every other
 * caller (Section A's dropdown, etc.) should leave it false.
 */
export async function getSectors(includeInactive = false): Promise<Sector[]> {
  const supabase = await createClient();
  let query = supabase
    .from("sectors")
    .select("id, name, sort_order, is_active, category_id, sector_categories(name, sort_order)")
    .order("sort_order", { ascending: true });
  if (!includeInactive) query = query.eq("is_active", true);

  const { data, error } = await query;
  if (error || !data) return [];

  return data
    .map((row) => {
      const category = Array.isArray(row.sector_categories) ? row.sector_categories[0] : row.sector_categories;
      return {
        id: row.id,
        name: row.name,
        order: row.sort_order,
        isActive: row.is_active,
        categoryId: row.category_id,
        categoryName: category?.name ?? "",
        categorySortOrder: category?.sort_order ?? 0,
      };
    })
    .sort((a, b) => a.categorySortOrder - b.categorySortOrder || a.order - b.order)
    .map(({ categorySortOrder: _categorySortOrder, ...sector }) => sector);
}

export interface SectorCategoryOption {
  id: string;
  name: string;
}

/** For the "add sector" admin control's category picker. */
export async function getSectorCategories(): Promise<SectorCategoryOption[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("sector_categories").select("id, name").order("sort_order", { ascending: true });
  if (error || !data) return [];
  return data;
}
