import { store } from "@/lib/mock/store";
import type { JurorConflict, Panel } from "@/types/domain";

export interface PanelWithDetails extends Panel {
  jurorNames: string[];
  sectorIds: string[];
  shortlistedCount: number;
}

/**
 * Panels with their assigned sector cluster and a shortlisted-applicant
 * count per panel — the Secretariat balances clusters by this volume,
 * not raw sector count (doc section 11.5), though the balancing itself
 * stays a human judgment call; this just surfaces the number to act on.
 */
export async function getPanelsWithDetails(): Promise<PanelWithDetails[]> {
  return store.panels.map((panel) => {
    const jurorNames = panel.jurorIds.map((id) => store.users.find((u) => u.id === id)?.name ?? id);
    const sectorIds = store.panelSectorAssignments.filter((a) => a.panelId === panel.id).map((a) => a.sectorId);
    const shortlistedCount = store.applications.filter((app) => {
      if (!app.isShortlisted) return false;
      const org = store.organizations.find((o) => o.id === app.organizationId);
      return org && sectorIds.includes(org.sectorId);
    }).length;
    return { ...panel, jurorNames, sectorIds, shortlistedCount };
  });
}

export async function getJurorConflicts(): Promise<JurorConflict[]> {
  return [...store.jurorConflicts].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

/** Which sectors have no panel assigned yet — surfaced so the Secretariat notices gaps before Stage 2 opens. */
export async function getUnassignedSectorIds(): Promise<string[]> {
  const assigned = new Set(store.panelSectorAssignments.map((a) => a.sectorId));
  return store.sectors.filter((s) => !assigned.has(s.id)).map((s) => s.id);
}
