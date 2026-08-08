import { store } from "@/lib/mock/store";
import type { ApplicationWithOrg } from "@/lib/data/applications";
import type { OrgSizeTier, ShortlistConfig } from "@/types/domain";

export async function getShortlistConfigs(): Promise<ShortlistConfig[]> {
  return [...store.shortlistConfigs];
}

export interface RankedApplication extends ApplicationWithOrg {
  rank: number;
}

export interface ShortlistCategory {
  sectorId: string;
  sectorName: string;
  sizeTier: OrgSizeTier | "all";
  config: ShortlistConfig | null;
  ranked: RankedApplication[];
  cutoffCount: number | null;
}

function withOrg(app: (typeof store.applications)[number]) {
  const organization = store.organizations.find((o) => o.id === app.organizationId)!;
  return { ...app, organization };
}

/**
 * Ranks submitted applications by Stage 1 score within each sector (the
 * mock shortlist configs are all sizeTier "all" — see store.ts — so
 * categories are effectively per-sector for now; the sizeTier axis is
 * modeled and ready once the Secretariat configures finer categories).
 */
export async function getShortlistCategories(): Promise<ShortlistCategory[]> {
  const submitted = store.applications.filter((a) => a.submittedAt && a.stage1Score !== null).map(withOrg);

  const categories: ShortlistCategory[] = [];
  for (const sector of store.sectors) {
    const inSector = submitted.filter((a) => a.organization.sectorId === sector.id);
    if (inSector.length === 0) continue;

    const ranked = [...inSector]
      .sort((a, b) => (b.stage1Score ?? 0) - (a.stage1Score ?? 0))
      .map((a, idx) => ({ ...a, rank: idx + 1 }));

    const config = store.shortlistConfigs.find((c) => c.sectorId === sector.id && c.sizeTier === "all") ?? null;
    const cutoffCount =
      config?.mode === "count"
        ? config.value
        : config?.mode === "percentage" && config.value !== null
        ? Math.max(1, Math.ceil((config.value / 100) * ranked.length))
        : null;

    categories.push({ sectorId: sector.id, sectorName: sector.name, sizeTier: "all", config, ranked, cutoffCount });
  }
  return categories;
}
