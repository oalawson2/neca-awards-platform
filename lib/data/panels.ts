import { createClient } from "@/lib/supabase/server";
import type { JurorConflict, Panel } from "@/types/domain";

export interface PanelWithDetails extends Panel {
  jurorNames: string[];
  sectorCategoryIds: string[];
  shortlistedCount: number;
}

const IN_OR_PAST_STAGE2 = ["shortlisted", "in_stage2", "stage2_scored", "sector_finalist", "sector_winner", "eoy_finalist", "eoy_winner"];

/**
 * Panels with their assigned sector cluster and a shortlisted-applicant
 * count per panel — the Secretariat balances clusters by this volume,
 * not raw sector count (doc section 11.5), though the balancing itself
 * stays a human judgment call; this just surfaces the number to act on.
 *
 * Returns [] when panels haven't been created yet (real table starts
 * empty by design) — callers show a "create the 3 panels" prompt rather
 * than treating this as an error.
 */
export async function getPanelsWithDetails(): Promise<PanelWithDetails[]> {
  const supabase = await createClient();
  const { data: panels } = await supabase.from("panels").select("id, panel_number").order("panel_number");
  if (!panels || panels.length === 0) return [];

  const panelIds = panels.map((p) => p.id);
  const [{ data: memberships }, { data: clusters }, { data: applications }, { data: sectors }] = await Promise.all([
    supabase.from("panel_memberships").select("panel_id, juror_id, profiles(full_name)").in("panel_id", panelIds),
    supabase.from("panel_sector_clusters").select("panel_id, sector_category_id").in("panel_id", panelIds),
    supabase.from("applications").select("status, organizations(sector_id)"),
    supabase.from("sectors").select("id, category_id"),
  ]);

  // organizations only store the sub-sector (sectors.id); panel clusters are
  // assigned at the top-level category (sector_categories.id) — this maps
  // one to the other so shortlisted counts can compare like with like.
  const categoryIdBySectorId = new Map((sectors ?? []).map((s) => [s.id, s.category_id]));

  return panels.map((panel) => {
    const panelMemberships = (memberships ?? []).filter((m) => m.panel_id === panel.id);
    const jurorIds = panelMemberships.map((m) => m.juror_id);
    const jurorNames = panelMemberships.map((m) => {
      const profile = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
      return profile?.full_name ?? m.juror_id;
    });
    const sectorCategoryIds = (clusters ?? []).filter((c) => c.panel_id === panel.id).map((c) => c.sector_category_id);
    const shortlistedCount = (applications ?? []).filter((a) => {
      if (!IN_OR_PAST_STAGE2.includes(a.status)) return false;
      const org = Array.isArray(a.organizations) ? a.organizations[0] : a.organizations;
      if (!org) return false;
      const categoryId = categoryIdBySectorId.get(org.sector_id);
      return categoryId && sectorCategoryIds.includes(categoryId);
    }).length;
    return { id: panel.id, name: `Panel ${panel.panel_number}`, jurorIds, jurorNames, sectorCategoryIds, shortlistedCount };
  });
}

export async function getJurorConflicts(): Promise<JurorConflict[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("juror_conflicts")
    .select("id, juror_id, application_id, reason, resolution, created_at")
    .order("created_at", { ascending: false });
  return (data ?? []).map((c) => ({
    id: c.id,
    jurorId: c.juror_id,
    applicationId: c.application_id,
    reason: c.reason,
    resolution: c.resolution as JurorConflict["resolution"],
    createdAt: c.created_at,
  }));
}

/** jurorId -> panel display name, for the Users page's PANEL column. */
export async function getPanelNamesByJuror(): Promise<Record<string, string>> {
  const supabase = await createClient();
  const { data } = await supabase.from("panel_memberships").select("juror_id, panels(panel_number)");
  const result: Record<string, string> = {};
  for (const row of data ?? []) {
    const panel = Array.isArray(row.panels) ? row.panels[0] : row.panels;
    if (panel) result[row.juror_id] = `Panel ${panel.panel_number}`;
  }
  return result;
}

/** Which top-level sector categories have no panel assigned yet — surfaced so the Secretariat notices gaps before Stage 2 opens. */
export async function getUnassignedSectorCategoryIds(): Promise<string[]> {
  const supabase = await createClient();
  const [{ data: categories }, { data: clusters }] = await Promise.all([
    supabase.from("sector_categories").select("id"),
    supabase.from("panel_sector_clusters").select("sector_category_id"),
  ]);
  const assigned = new Set((clusters ?? []).map((c) => c.sector_category_id));
  return (categories ?? []).filter((c) => !assigned.has(c.id)).map((c) => c.id);
}
