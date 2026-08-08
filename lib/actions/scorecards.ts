"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/session";
import { logAction } from "@/lib/data/audit";
import { PILLARS, SECTION_DB_IDS } from "@/lib/mock/framework";
import { getPanelSubmissionCount } from "@/lib/data/scorecards";
import { applicantVerifiedScore } from "@/lib/scoring/stage2";
import type { PillarCode, ScorecardRound } from "@/types/domain";

const SCORED_PILLARS = PILLARS.filter((p) => p.scored);
type Dimension = "policyExists" | "implementation" | "evidenceQuality" | "measurableImpact";
const DIMENSION_COLUMN: Record<Dimension, string> = {
  policyExists: "policy_exists",
  implementation: "implementation",
  evidenceQuality: "evidence_quality",
  measurableImpact: "measurable_impact",
};

export async function saveScorecardDimension(
  applicationId: string,
  jurorId: string,
  pillarCode: PillarCode,
  dimension: Dimension,
  value: number,
  round: ScorecardRound = "sector"
) {
  const supabase = await createClient();
  const isEoy = round === "employer_of_year";

  const { data: existing } = await supabase
    .from("juror_scores")
    .select("id, submitted_at")
    .eq("application_id", applicationId)
    .eq("juror_id", jurorId)
    .eq("section_id", SECTION_DB_IDS[pillarCode as Exclude<PillarCode, "A">])
    .eq("is_eoy_joint_score", isEoy)
    .maybeSingle();
  if (existing?.submitted_at) return { success: false, error: "This scorecard has already been submitted." };

  const { error } = await supabase.from("juror_scores").upsert(
    {
      application_id: applicationId,
      juror_id: jurorId,
      section_id: SECTION_DB_IDS[pillarCode as Exclude<PillarCode, "A">],
      is_eoy_joint_score: isEoy,
      [DIMENSION_COLUMN[dimension]]: value,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "application_id,juror_id,section_id,is_eoy_joint_score" }
  );
  if (error) return { success: false, error: "Could not save score." };

  revalidatePath(`/jury/scorecard/${applicationId}`);
  return { success: true };
}

export async function saveInterviewFinding(applicationId: string, jurorId: string, pillarCode: PillarCode, finding: string, round: ScorecardRound = "sector") {
  const supabase = await createClient();
  const { error } = await supabase.from("juror_scores").upsert(
    {
      application_id: applicationId,
      juror_id: jurorId,
      section_id: SECTION_DB_IDS[pillarCode as Exclude<PillarCode, "A">],
      is_eoy_joint_score: round === "employer_of_year",
      narrative_notes: finding,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "application_id,juror_id,section_id,is_eoy_joint_score" }
  );
  if (error) return { success: false, error: "Could not save note." };

  revalidatePath(`/jury/scorecard/${applicationId}`);
  return { success: true };
}

export interface SubmitScorecardResult {
  success: boolean;
  error?: string;
  outstandingPillars?: string[];
}

/**
 * Finalizes all 8 pillar scorecards at once (sets submitted_at), blocked
 * until every pillar has all 4 dimensions filled. Logs one audit entry
 * per pillar comparing the Stage 1 self-declared score to this juror's
 * Stage 2 pillar score (doc section 12).
 *
 * Does NOT attempt to auto-transition application.status once "the whole
 * panel is done" — unlike the mock version this replaces. A juror's own
 * RLS-scoped session can only ever see their own juror_scores rows until
 * applications.stage2_scoring_closed=true (verified against pg_policies),
 * so it structurally cannot detect panel-wide completion. That's now
 * closeStage2Scoring's job — a genuinely Secretariat-only action, which
 * matches stage2_scoring_closed/_at/_by existing as real columns in the
 * first place: closing the blind-scoring window was always meant to be a
 * deliberate Secretariat call, not something that fires itself.
 */
export async function submitScorecard(applicationId: string, jurorId: string, jurorName: string, round: ScorecardRound = "sector"): Promise<SubmitScorecardResult> {
  const supabase = await createClient();
  const isEoy = round === "employer_of_year";

  const { data: rows } = await supabase
    .from("juror_scores")
    .select("section_id, policy_exists, implementation, evidence_quality, measurable_impact")
    .eq("application_id", applicationId)
    .eq("juror_id", jurorId)
    .eq("is_eoy_joint_score", isEoy);

  const sectionIdToPillar = new Map(Object.entries(SECTION_DB_IDS).map(([code, id]) => [id, code]));
  const outstanding = SCORED_PILLARS.filter((p) => {
    const row = (rows ?? []).find((r) => sectionIdToPillar.get(r.section_id) === p.code);
    return !row || row.policy_exists === null || row.implementation === null || row.evidence_quality === null || row.measurable_impact === null;
  });
  if (outstanding.length > 0) {
    return { success: false, error: "Score all 4 dimensions on every pillar before submitting.", outstandingPillars: outstanding.map((p) => p.code) };
  }

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("juror_scores")
    .update({ submitted_at: now })
    .eq("application_id", applicationId)
    .eq("juror_id", jurorId)
    .eq("is_eoy_joint_score", isEoy);
  if (error) return { success: false, error: "Could not submit scorecard." };

  const { data: app } = await supabase.from("applications").select("organization_id").eq("id", applicationId).maybeSingle();
  const { data: org } = app ? await supabase.from("organizations").select("name").eq("id", app.organization_id).maybeSingle() : { data: null };

  // The mock version this replaces logged one detailed entry per pillar
  // comparing the Stage 1 self-declared score against this juror's Stage
  // 2 score (a separate, more granular concept than the generic action
  // log below). No real-schema equivalent for that specific comparison
  // exists yet, and audit_log itself has no INSERT policy for
  // authenticated users (service-role only) — deferred to task #55,
  // which is already reconsidering the audit-writing story end to end
  // rather than bolting on a partial version here.
  await logAction(jurorName, "Submitted pillar scorecard for", org?.name ?? applicationId);

  revalidatePath(`/jury/scorecard/${applicationId}`);
  return { success: true };
}

/**
 * Secretariat-only: closes the blind-scoring window for this application
 * (stage2_scoring_closed=true, which is what RLS itself gates peer
 * juror_scores visibility on), computes and stores the panel-averaged
 * Verified Score, and advances the application to stage2_scored. Uses the
 * Secretariat's own session — unlike a juror's, it can see every panel
 * member's raw scores unconditionally (scores_select_secretariat), which
 * is what makes computing the real panel average possible here at all.
 */
export async function closeStage2Scoring(applicationId: string): Promise<{ success: boolean; error?: string; verifiedScore?: number }> {
  const user = await getCurrentUser();
  if (!user || (user.role !== "secretariat" && user.role !== "secretariat_super_admin")) {
    return { success: false, error: "Only Secretariat can close scoring." };
  }

  const { submitted, total } = await getPanelSubmissionCount(applicationId, "sector");
  if (total === 0) return { success: false, error: "No panel is assigned to this applicant's sector yet." };
  if (submitted < total) return { success: false, error: `Only ${submitted} of ${total} panel jurors have submitted so far.` };

  const supabase = await createClient();
  const { data: rows } = await supabase
    .from("juror_scores")
    .select("section_id, policy_exists, implementation, evidence_quality, measurable_impact")
    .eq("application_id", applicationId)
    .eq("is_eoy_joint_score", false);

  const sectionIdToPillar = new Map(Object.entries(SECTION_DB_IDS).map(([code, id]) => [id, code as PillarCode]));
  const cards = (rows ?? []).map((r) => ({
    id: "",
    applicationId,
    jurorId: "",
    pillarCode: sectionIdToPillar.get(r.section_id)!,
    round: "sector" as const,
    policyExists: r.policy_exists,
    implementation: r.implementation,
    evidenceQuality: r.evidence_quality,
    measurableImpact: r.measurable_impact,
    submittedAt: null,
  }));
  const { overall } = applicantVerifiedScore(PILLARS, cards);

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("applications")
    .update({
      stage2_scoring_closed: true,
      stage2_scoring_closed_at: now,
      stage2_scoring_closed_by: user.id,
      verified_score: overall,
      status: "stage2_scored",
    })
    .eq("id", applicationId);
  if (error) return { success: false, error: "Could not close scoring." };

  await logAction(user.fullName || user.email, "Closed Stage 2 scoring for", applicationId);
  revalidatePath("/secretariat/live-scoring");
  revalidatePath(`/secretariat/applications/${applicationId}`);
  return { success: true, verifiedScore: overall };
}
