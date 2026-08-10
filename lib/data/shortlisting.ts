import { createClient } from "@/lib/supabase/server";
import type { ApplicationWithOrg } from "@/lib/data/applications";
import type { OrgSizeTier, ShortlistConfig, ShortlistMode } from "@/types/domain";

export async function getShortlistConfigs(): Promise<ShortlistConfig[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("shortlist_config").select("id, sector_id, org_size_tier, basis, value");
  return (data ?? []).map((c) => ({
    id: c.id,
    sectorId: c.sector_id,
    sizeTier: c.org_size_tier as OrgSizeTier,
    mode: c.basis as ShortlistMode,
    value: c.value,
  }));
}

export interface RankedApplication extends ApplicationWithOrg {
  rank: number;
}

export interface ShortlistCategory {
  sectorId: string;
  sectorName: string;
  sizeTier: OrgSizeTier;
  config: ShortlistConfig | null;
  ranked: RankedApplication[];
  cutoffCount: number | null;
}

/**
 * Ranks submitted applications by Stage 1 score within each (sector,
 * size tier) pair — the real schema's shortlist_config is genuinely
 * 2-dimensional (org_size_tier is a required column, no "all sizes"
 * sentinel the way the mock modeled it), so categories are real
 * (sector, size) combinations, not sector-only. shortlist_config starts
 * empty by design (Secretariat configuration work, not fabricated here)
 * — a category with no matching config row just has cutoffCount: null,
 * same "not yet configured" signal as before.
 */
export async function getShortlistCategories(): Promise<ShortlistCategory[]> {
  const supabase = await createClient();
  const [{ data: apps }, configs] = await Promise.all([
    supabase
      .from("applications")
      .select(
        "id, organization_id, cycle_year, status, stage1_score, submitted_at, eligibility_review_needed, red_flag_count, organizations(id, name, rc_number, year_established_band, sector_id, org_size_tier, employee_count, geographical_coverage, ownership_structure, is_local_or_multinational, is_unionised, contact_name, contact_email, previous_participation, eligibility_declarations, sectors(name))"
      )
      .not("submitted_at", "is", null)
      .not("stage1_score", "is", null),
    getShortlistConfigs(),
  ]);

  const byCategory = new Map<string, RankedApplication[]>();
  const sectorNames = new Map<string, string>();
  for (const row of apps ?? []) {
    const org = Array.isArray(row.organizations) ? row.organizations[0] : row.organizations;
    if (!org) continue;
    const sector = Array.isArray(org.sectors) ? org.sectors[0] : org.sectors;
    const key = `${org.sector_id}::${org.org_size_tier}`;
    sectorNames.set(org.sector_id, sector?.name ?? org.sector_id);
    const list = byCategory.get(key) ?? [];
    list.push({
      id: row.id,
      referenceNo: `EEA-${row.cycle_year}-${row.id.slice(0, 8).toUpperCase()}`,
      organizationId: row.organization_id,
      status: row.status,
      eligibilityDeclarations: {
        legallyRegistered: !!org.eligibility_declarations?.legally_registered_nigeria,
        taxCompliant: !!org.eligibility_declarations?.tax_compliant,
        notUnderSanction: !!org.eligibility_declarations?.no_regulatory_sanction,
        infoAccurate: !!org.eligibility_declarations?.information_accurate,
      },
      eligibilityFlagged: row.eligibility_review_needed,
      submittedAt: row.submitted_at,
      stage1Score: row.stage1_score,
      isShortlisted: row.status === "not_shortlisted" ? false : row.status === "draft" || row.status === "submitted" || row.status === "eligibility_flagged" ? null : true,
      organization: {
        id: org.id,
        name: org.name,
        rcNumber: org.rc_number,
        yearEstablishedBand: (org.year_established_band ?? "") as never,
        sectorId: org.sector_id,
        sizeTier: org.org_size_tier as OrgSizeTier,
        employeeCount: org.employee_count,
        geographicalCoverage: (org.geographical_coverage ?? "") as never,
        ownershipStructure: (org.ownership_structure ?? "") as never,
        localOrMultinational: (org.is_local_or_multinational ?? "local") as never,
        isUnionised: org.is_unionised,
        primaryContactName: org.contact_name,
        primaryContactEmail: org.contact_email,
        primaryContactPhone: "",
        previousParticipation: { participated: org.previous_participation, years: [] },
      },
      rank: 0,
    });
    byCategory.set(key, list);
  }

  const categories: ShortlistCategory[] = [];
  for (const [key, list] of byCategory) {
    const [sectorId, sizeTier] = key.split("::") as [string, OrgSizeTier];
    const ranked = [...list]
      .sort((a, b) => (b.stage1Score ?? 0) - (a.stage1Score ?? 0))
      .map((a, idx) => ({ ...a, rank: idx + 1 }));

    const config = configs.find((c) => c.sectorId === sectorId && c.sizeTier === sizeTier) ?? null;
    const cutoffCount =
      config?.mode === "count"
        ? config.value
        : config?.mode === "percentage" && config.value !== null
          ? Math.max(1, Math.ceil((config.value / 100) * ranked.length))
          : null;

    categories.push({ sectorId, sectorName: sectorNames.get(sectorId) ?? sectorId, sizeTier, config, ranked, cutoffCount });
  }
  return categories;
}
