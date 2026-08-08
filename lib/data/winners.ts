import { createClient } from "@/lib/supabase/server";
import { PILLARS, SECTION_DB_IDS } from "@/lib/mock/framework";
import { applicantVerifiedScore, jurorVerifiedScore } from "@/lib/scoring/stage2";
import type { EmployerOfYearResult, EmployerOfYearValidation, PillarCode, PillarScorecard } from "@/types/domain";

const SCORED_PILLARS = PILLARS.filter((p) => p.scored);
const SECTION_ID_TO_PILLAR = new Map(Object.entries(SECTION_DB_IDS).map(([code, id]) => [id, code as PillarCode]));

function mapCard(row: {
  id: string;
  application_id: string;
  juror_id: string;
  section_id: string;
  policy_exists: number | null;
  implementation: number | null;
  evidence_quality: number | null;
  measurable_impact: number | null;
  submitted_at: string | null;
}): PillarScorecard {
  return {
    id: row.id,
    applicationId: row.application_id,
    jurorId: row.juror_id,
    pillarCode: SECTION_ID_TO_PILLAR.get(row.section_id)!,
    round: "sector",
    policyExists: row.policy_exists,
    implementation: row.implementation,
    evidenceQuality: row.evidence_quality,
    measurableImpact: row.measurable_impact,
    submittedAt: row.submitted_at,
  };
}

export interface ScoredApplicationRow {
  applicationId: string;
  organizationName: string;
  verifiedScore: number;
  isSectorWinner: boolean;
}

export interface SectorWinnerGroup {
  sectorId: string;
  sectorName: string;
  scored: ScoredApplicationRow[];
}

const SECTOR_WINNER_ELIGIBLE_STATUSES = ["stage2_scored", "sector_finalist", "sector_winner", "eoy_finalist", "eoy_winner"];
const IS_SECTOR_WINNER_STATUSES = ["sector_winner", "eoy_finalist", "eoy_winner"];

/** Every scored application, ranked by panel-averaged Verified Score within its sector (doc section 11.5: "one sectoral winner per assigned sector"). */
export async function getSectorWinnerGroups(): Promise<SectorWinnerGroup[]> {
  const supabase = await createClient();
  const { data: apps } = await supabase
    .from("applications")
    .select("id, status, organizations(name, sector_id, sectors(name))")
    .in("status", SECTOR_WINNER_ELIGIBLE_STATUSES);
  if (!apps || apps.length === 0) return [];

  const { data: scores } = await supabase
    .from("juror_scores")
    .select("*")
    .eq("is_eoy_joint_score", false)
    .in("application_id", apps.map((a) => a.id));

  const groups = new Map<string, SectorWinnerGroup>();
  for (const app of apps) {
    const org = Array.isArray(app.organizations) ? app.organizations[0] : app.organizations;
    if (!org) continue;
    const sector = Array.isArray(org.sectors) ? org.sectors[0] : org.sectors;

    const cards = (scores ?? []).filter((s) => s.application_id === app.id).map(mapCard);
    const { overall } = applicantVerifiedScore(PILLARS, cards);

    const group: SectorWinnerGroup = groups.get(org.sector_id) ?? { sectorId: org.sector_id, sectorName: sector?.name ?? org.sector_id, scored: [] };
    group.scored.push({
      applicationId: app.id,
      organizationName: org.name,
      verifiedScore: overall,
      isSectorWinner: IS_SECTOR_WINNER_STATUSES.includes(app.status),
    });
    groups.set(org.sector_id, group);
  }

  for (const group of groups.values()) group.scored.sort((a, b) => b.verifiedScore - a.verifiedScore);
  return [...groups.values()];
}

export async function getEmployerOfYearFinalists() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("applications")
    .select(
      "id, organization_id, cycle_year, status, stage1_score, submitted_at, eligibility_review_needed, organizations(id, name, rc_number, year_established_band, sector_id, org_size_tier, geographical_coverage, ownership_structure, is_local_or_multinational, is_unionised, contact_name, contact_email, previous_participation, eligibility_declarations)"
    )
    .in("status", ["eoy_finalist", "eoy_winner"]);

  return (data ?? []).map((row) => {
    const org = Array.isArray(row.organizations) ? row.organizations[0] : row.organizations;
    return {
      id: row.id,
      referenceNo: `EEA-${row.cycle_year}-${row.id.slice(0, 8).toUpperCase()}`,
      organizationId: row.organization_id,
      status: row.status,
      eligibilityDeclarations: {
        legallyRegistered: !!org?.eligibility_declarations?.legally_registered_nigeria,
        taxCompliant: !!org?.eligibility_declarations?.tax_compliant,
        notUnderSanction: !!org?.eligibility_declarations?.no_regulatory_sanction,
        infoAccurate: !!org?.eligibility_declarations?.information_accurate,
      },
      eligibilityFlagged: row.eligibility_review_needed,
      submittedAt: row.submitted_at,
      stage1Score: row.stage1_score,
      isShortlisted: true,
      isSectorWinner: true,
      isEmployerOfYearFinalist: true,
      isEmployerOfYear: row.status === "eoy_winner",
      organization: org
        ? {
            id: org.id,
            name: org.name,
            rcNumber: org.rc_number,
            yearEstablishedBand: (org.year_established_band ?? "") as never,
            sectorId: org.sector_id,
            sizeTier: org.org_size_tier as never,
            geographicalCoverage: (org.geographical_coverage ?? "") as never,
            ownershipStructure: (org.ownership_structure ?? "") as never,
            localOrMultinational: (org.is_local_or_multinational ?? "local") as never,
            isUnionised: org.is_unionised,
            primaryContactName: org.contact_name,
            primaryContactEmail: org.contact_email,
            primaryContactPhone: "",
            previousParticipation: { participated: org.previous_participation, years: [] },
          }
        : ({} as never),
    };
  });
}

/**
 * Overall Verified Score per finalist = mean of ALL 9 jurors' individual
 * Verified Scores (doc section 11.6, step 3) — not a panel average like
 * the sector round, since every juror scores every finalist here,
 * including jurors from the finalist's own panel. Reads is_eoy_joint_score=true
 * juror_scores rows, which every juror can write for any application
 * regardless of panel (RLS: scores_write_own allows this specifically
 * when is_eoy_joint_score is true — the one deliberate cross-panel hole).
 */
export async function getEmployerOfYearResults(): Promise<EmployerOfYearResult[]> {
  const supabase = await createClient();
  const finalists = await getEmployerOfYearFinalists();
  if (finalists.length === 0) return [];

  const { data: jurorProfiles } = await supabase.from("profiles").select("id").eq("role", "jury");
  const allJurorIds = (jurorProfiles ?? []).map((p) => p.id);

  const { data: scores } = await supabase
    .from("juror_scores")
    .select("*")
    .eq("is_eoy_joint_score", true)
    .in("application_id", finalists.map((f) => f.id));

  const results = finalists.map((finalist) => {
    const individualScores = allJurorIds
      .map((jurorId) => {
        const cards = (scores ?? [])
          .filter((s) => s.application_id === finalist.id && s.juror_id === jurorId)
          .map(mapCard);
        return jurorVerifiedScore(cards, PILLARS);
      })
      .filter((s): s is number => s !== null);

    const overallVerifiedScore =
      individualScores.length > 0 ? Math.round((individualScores.reduce((a, b) => a + b, 0) / individualScores.length) * 100) / 100 : 0;

    return { applicationId: finalist.id, overallVerifiedScore, individualScores, rank: 0 };
  });

  return results.sort((a, b) => b.overallVerifiedScore - a.overallVerifiedScore).map((r, idx) => ({ ...r, rank: idx + 1 }));
}

export async function getEmployerOfYearJurorProgress() {
  const supabase = await createClient();
  const finalists = await getEmployerOfYearFinalists();
  const { data: jurors } = await supabase.from("profiles").select("id, full_name").eq("role", "jury");
  if (!jurors || finalists.length === 0) {
    return (jurors ?? []).map((j) => ({ jurorId: j.id, jurorName: j.full_name, submittedCount: 0, totalFinalists: finalists.length }));
  }

  const { data: scores } = await supabase
    .from("juror_scores")
    .select("application_id, juror_id, submitted_at")
    .eq("is_eoy_joint_score", true)
    .in("application_id", finalists.map((f) => f.id))
    .not("submitted_at", "is", null);

  return jurors.map((juror) => {
    const submittedCount = finalists.filter((f) => {
      const count = (scores ?? []).filter((s) => s.application_id === f.id && s.juror_id === juror.id).length;
      return count === SCORED_PILLARS.length;
    }).length;
    return { jurorId: juror.id, jurorName: juror.full_name, submittedCount, totalFinalists: finalists.length };
  });
}

/**
 * No real table exists for this at all (a genuine gap, not fixed with
 * another migration this time — see lib/actions/winners.ts's docstring
 * for why): derived entirely from application status. "Validated" simply
 * means one application has reached eoy_winner, which can only happen
 * through the human-confirmation action; who clicked confirm and exactly
 * when isn't separately persisted (audit_log will carry that once task
 * #55 wires real writes there).
 */
export async function getEmployerOfYearValidation(): Promise<EmployerOfYearValidation> {
  const supabase = await createClient();
  const { data } = await supabase.from("applications").select("id").eq("status", "eoy_winner").maybeSingle();
  return { validated: !!data, validatedByUserId: null, validatedAt: null, winnerApplicationId: data?.id ?? null };
}
