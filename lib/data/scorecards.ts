import { createClient } from "@/lib/supabase/server";
import { PILLARS, SECTION_DB_IDS } from "@/lib/mock/framework";
import { jurorVerifiedScore, applicantVerifiedScore } from "@/lib/scoring/stage2";
import type { PillarCode, PillarScorecard, ScorecardRound } from "@/types/domain";

const SCORED_PILLARS = PILLARS.filter((p) => p.scored);
const SECTION_ID_TO_PILLAR = new Map(Object.entries(SECTION_DB_IDS).map(([code, id]) => [id, code as PillarCode]));

function mapRow(row: {
  id: string;
  application_id: string;
  juror_id: string;
  section_id: string;
  policy_exists: number | null;
  implementation: number | null;
  evidence_quality: number | null;
  measurable_impact: number | null;
  narrative_notes: string | null;
  is_eoy_joint_score: boolean;
  submitted_at: string | null;
}): PillarScorecard {
  return {
    id: row.id,
    applicationId: row.application_id,
    jurorId: row.juror_id,
    pillarCode: SECTION_ID_TO_PILLAR.get(row.section_id)!,
    round: row.is_eoy_joint_score ? "employer_of_year" : "sector",
    policyExists: row.policy_exists,
    implementation: row.implementation,
    evidenceQuality: row.evidence_quality,
    measurableImpact: row.measurable_impact,
    interviewFinding: row.narrative_notes ?? undefined,
    submittedAt: row.submitted_at,
  };
}

export async function getJurorScorecards(applicationId: string, jurorId: string, round: ScorecardRound = "sector"): Promise<PillarScorecard[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("juror_scores")
    .select("*")
    .eq("application_id", applicationId)
    .eq("juror_id", jurorId)
    .eq("is_eoy_joint_score", round === "employer_of_year");
  return (data ?? []).map(mapRow);
}

export interface ScorecardProgress {
  totalPillars: number;
  submittedPillars: number;
  isComplete: boolean;
}

export async function getScorecardProgress(applicationId: string, jurorId: string, round: ScorecardRound = "sector"): Promise<ScorecardProgress> {
  const cards = await getJurorScorecards(applicationId, jurorId, round);
  const submitted = cards.filter((c) => c.submittedAt !== null);
  return { totalPillars: SCORED_PILLARS.length, submittedPillars: submitted.length, isComplete: submitted.length === SCORED_PILLARS.length };
}

export async function getMyVerifiedScore(applicationId: string, jurorId: string, round: ScorecardRound = "sector"): Promise<number | null> {
  const cards = await getJurorScorecards(applicationId, jurorId, round);
  return jurorVerifiedScore(cards, PILLARS);
}

/**
 * Blind scoring is enforced by RLS itself now, which changes what this
 * function can see depending on who's calling it: a juror's own session
 * only ever sees their own juror_scores rows until
 * applications.stage2_scoring_closed=true (scores_select_panel_after_close);
 * Secretariat's session sees everyone's, unconditionally
 * (scores_select_secretariat). Called from the Secretariat's live-scoring
 * page, this returns real panel-wide progress. Called from a juror's own
 * submit flow, it will under-count peers — by design, not a bug — which
 * is exactly why lib/actions/scorecards.ts's submitScorecard no longer
 * tries to auto-detect "whole panel done" from a juror's own session; see
 * closeStage2Scoring for the (Secretariat-only) real trigger.
 */
export async function getPanelSubmissionCount(applicationId: string, round: ScorecardRound = "sector"): Promise<{ submitted: number; total: number }> {
  const supabase = await createClient();
  const { data: app } = await supabase.from("applications").select("organization_id").eq("id", applicationId).maybeSingle();
  if (!app) return { submitted: 0, total: 0 };
  const { data: org } = await supabase.from("organizations").select("sector_id").eq("id", app.organization_id).maybeSingle();
  if (!org) return { submitted: 0, total: 0 };
  const { data: cluster } = await supabase.from("panel_sector_clusters").select("panel_id").eq("sector_id", org.sector_id).maybeSingle();
  if (!cluster) return { submitted: 0, total: 0 };
  const { data: members } = await supabase.from("panel_memberships").select("juror_id").eq("panel_id", cluster.panel_id);
  const jurorIds = (members ?? []).map((m) => m.juror_id);
  if (jurorIds.length === 0) return { submitted: 0, total: 0 };

  const { data: scores } = await supabase
    .from("juror_scores")
    .select("juror_id, submitted_at")
    .eq("application_id", applicationId)
    .eq("is_eoy_joint_score", round === "employer_of_year")
    .in("juror_id", jurorIds)
    .not("submitted_at", "is", null);

  const submittedJurorIds = new Set<string>();
  for (const jurorId of jurorIds) {
    const count = (scores ?? []).filter((s) => s.juror_id === jurorId).length;
    if (count === SCORED_PILLARS.length) submittedJurorIds.add(jurorId);
  }
  return { submitted: submittedJurorIds.size, total: jurorIds.length };
}

/** Only meaningful (and only fully visible) from a Secretariat session — see getPanelSubmissionCount's docstring. */
export async function getVerifiedScoreIfComplete(applicationId: string, round: ScorecardRound = "sector") {
  const { submitted, total } = await getPanelSubmissionCount(applicationId, round);
  if (total === 0 || submitted < total) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("juror_scores")
    .select("*")
    .eq("application_id", applicationId)
    .eq("is_eoy_joint_score", round === "employer_of_year");
  return applicantVerifiedScore(PILLARS, (data ?? []).map(mapRow));
}
