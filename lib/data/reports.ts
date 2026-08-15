import { createClient } from "@/lib/supabase/server";
import { PILLARS, SECTION_DB_IDS } from "@/lib/mock/framework";
import { applicantVerifiedScore } from "@/lib/scoring/stage2";
import { computeStage1Score } from "@/lib/scoring/stage1";
import { getAnswers } from "@/lib/data/answers";
import type { NonShortlistedReport, PillarCode, PillarScorecard, ReportStatus, ShortlistedReport } from "@/types/domain";

const SCORED_PILLARS = PILLARS.filter((p) => p.scored);
const SECTION_ID_TO_PILLAR = new Map(Object.entries(SECTION_DB_IDS).map(([code, id]) => [id, code as PillarCode]));

const DECIDED_STATUSES = [
  "shortlisted",
  "not_shortlisted",
  "in_stage2",
  "stage2_scored",
  "sector_finalist",
  "sector_winner",
  "eoy_finalist",
  "eoy_winner",
];

export async function getShortlistedReport(applicationId: string): Promise<ShortlistedReport | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("application_reports")
    .select("*")
    .eq("application_id", applicationId)
    .eq("kind", "shortlisted")
    .maybeSingle();
  if (!data) return null;
  return {
    id: data.id,
    applicationId: data.application_id,
    status: data.status as ReportStatus,
    verifiedScore: data.pillar_breakdown.reduce((sum: number, p: { contributionPercent: number }) => sum + p.contributionPercent, 0),
    pillarBreakdown: data.pillar_breakdown,
    narrative: data.narrative ?? "",
    strengths: data.strengths ?? [],
    improvements: data.improvements ?? [],
    createdAt: data.created_at,
    releasedAt: data.released_at,
  };
}

export async function getNonShortlistedReport(applicationId: string): Promise<NonShortlistedReport | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("application_reports")
    .select("*")
    .eq("application_id", applicationId)
    .eq("kind", "non_shortlisted")
    .maybeSingle();
  if (!data) return null;
  return {
    id: data.id,
    applicationId: data.application_id,
    status: data.status as ReportStatus,
    pillarSummary: data.pillar_breakdown,
    createdAt: data.created_at,
    releasedAt: data.released_at,
  };
}

export interface ReportQueueRow {
  applicationId: string;
  organizationName: string;
  variant: "shortlisted" | "non_shortlisted";
  status: "pending_approval" | "approved" | "sent_back" | "not_generated";
}

/** Every application eligible for a report (submitted, decided one way or the other) with its current report state. */
export async function getReportQueue(): Promise<ReportQueueRow[]> {
  const supabase = await createClient();
  const { data: apps } = await supabase
    .from("applications")
    .select("id, status, organizations(name)")
    .in("status", DECIDED_STATUSES)
    .not("submitted_at", "is", null);
  if (!apps || apps.length === 0) return [];

  const { data: reports } = await supabase
    .from("application_reports")
    .select("application_id, status")
    .in("application_id", apps.map((a) => a.id));

  return apps.map((app) => {
    const org = Array.isArray(app.organizations) ? app.organizations[0] : app.organizations;
    const variant: "shortlisted" | "non_shortlisted" = app.status === "not_shortlisted" ? "non_shortlisted" : "shortlisted";
    const report = (reports ?? []).find((r) => r.application_id === app.id);
    return { applicationId: app.id, organizationName: org?.name ?? app.id, variant, status: (report?.status as ReportQueueRow["status"]) ?? "not_generated" };
  });
}

/** Deterministic from real score data, not a live Anthropic call (not wired up yet). Picks the 2 strongest/weakest pillars by contribution for the narrative. */
export async function buildShortlistedReportContent(applicationId: string) {
  const supabase = await createClient();
  const { data: rows } = await supabase.from("juror_scores").select("*").eq("application_id", applicationId).eq("is_eoy_joint_score", false);
  const cards: PillarScorecard[] = (rows ?? []).map((row) => ({
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
  }));

  const { overall, byPillar } = applicantVerifiedScore(PILLARS, cards);
  const sorted = [...byPillar].sort(
    (a, b) =>
      b.contributionPercent / SCORED_PILLARS.find((p) => p.code === b.pillarCode)!.weightPoints -
      a.contributionPercent / SCORED_PILLARS.find((p) => p.code === a.pillarCode)!.weightPoints
  );

  const pillarName = (code: string) => SCORED_PILLARS.find((p) => p.code === code)?.name ?? code;
  const strengths = sorted.slice(0, 2).map((p) => `Strong, well-evidenced practice in ${pillarName(p.pillarCode)}.`);
  const improvements = sorted
    .slice(-2)
    .reverse()
    .map((p) => `${pillarName(p.pillarCode)} is an area with room to strengthen practice and evidence.`);

  return {
    verifiedScore: overall,
    pillarBreakdown: byPillar.map((p) => ({ pillarCode: p.pillarCode, panelPillarScore: p.panelPillarScore, contributionPercent: p.contributionPercent })),
    narrative: `This organisation's Verified Score reflects consistent, evidence-backed practice across most pillars of the Assessment Framework, with particular strength where documentation and interview findings closely matched declared practice.`,
    strengths,
    improvements,
  };
}

export async function buildNonShortlistedReportContent(applicationId: string) {
  const supabase = await createClient();
  const { data: app } = await supabase.from("applications").select("organization_id").eq("id", applicationId).maybeSingle();
  if (!app) return { pillarSummary: [] };
  const { data: org } = await supabase
    .from("organizations")
    .select("is_unionised, sector_id")
    .eq("id", app.organization_id)
    .maybeSingle();
  if (!org) return { pillarSummary: [] };

  const answers = await getAnswers(applicationId);
  const { pillars } = computeStage1Score(PILLARS, org.is_unionised, answers, [], org.sector_id);

  const sorted = [...pillars].sort((a, b) => b.scorePercent - a.scorePercent);
  const pillarName = (code: string) => SCORED_PILLARS.find((p) => p.code === code)?.name ?? code;

  const pillarSummary = sorted.map((p) => ({
    pillarCode: p.pillarCode,
    stage1ScorePercent: p.scorePercent,
    strengths: p.scorePercent >= 60 ? [`${pillarName(p.pillarCode)}: self-assessment indicates established practice.`] : [],
    gaps: p.scorePercent < 60 ? [`${pillarName(p.pillarCode)}: self-assessment indicates this is an area to develop before the next cycle.`] : [],
  }));

  return { pillarSummary };
}
