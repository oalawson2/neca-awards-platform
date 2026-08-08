import { createClient } from "@/lib/supabase/server";
import type { JurorConflict, Panel } from "@/types/domain";

export interface PanelWithDetails extends Panel {
  jurorNames: string[];
  sectorIds: string[];
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
  const [{ data: memberships }, { data: clusters }, { data: applications }] = await Promise.all([
    supabase.from("panel_memberships").select("panel_id, juror_id, profiles(full_name)").in("panel_id", panelIds),
    supabase.from("panel_sector_clusters").select("panel_id, sector_id").in("panel_id", panelIds),
    supabase.from("applications").select("status, organizations(sector_id)"),
  ]);

  return panels.map((panel) => {
    const panelMemberships = (memberships ?? []).filter((m) => m.panel_id === panel.id);
    const jurorIds = panelMemberships.map((m) => m.juror_id);
    const jurorNames = panelMemberships.map((m) => {
      const profile = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
      return profile?.full_name ?? m.juror_id;
    });
    const sectorIds = (clusters ?? []).filter((c) => c.panel_id === panel.id).map((c) => c.sector_id);
    const shortlistedCount = (applications ?? []).filter((a) => {
      if (!IN_OR_PAST_STAGE2.includes(a.status)) return false;
      const org = Array.isArray(a.organizations) ? a.organizations[0] : a.organizations;
      return org && sectorIds.includes(org.sector_id);
    }).length;
    return { id: panel.id, name: `Panel ${panel.panel_number}`, jurorIds, jurorNames, sectorIds, shortlistedCount };
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

/** Which sectors have no panel assigned yet — surfaced so the Secretariat notices gaps before Stage 2 opens. */
export async function getUnassignedSectorIds(): Promise<string[]> {
  const supabase = await createClient();
  const [{ data: sectors }, { data: clusters }] = await Promise.all([
    supabase.from("sectors").select("id").eq("is_active", true),
    supabase.from("panel_sector_clusters").select("sector_id"),
  ]);
  const assigned = new Set((clusters ?? []).map((c) => c.sector_id));
  return (sectors ?? []).filter((s) => !assigned.has(s.id)).map((s) => s.id);
}
